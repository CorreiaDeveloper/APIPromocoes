const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
const { acionarApiMercadoLivre, addEmojis } = require('./helpers');
const { AtpAgent, RichText } = require('@atproto/api');
const Queue = require('./queue.js');
require('dotenv').config();

const PUBLISHED_PRODUCTS_FILE = './published_products.txt'; // Caminho do arquivo para armazenar os produtos publicados

class MercadoLibre {
    constructor() {
        this.baseUrl = "https://api.mercadolibre.com/sites/MLB/search";
        this.agent = new AtpAgent({
            service: 'https://bsky.social'
        });
        this.productQueue = new Queue();
        this.lastPostTime = 0; 
        this.POST_INTERVAL = 15 * 60 * 1000; 
    }

    async fetchProducts(category) {
        let offset = 0;
        const totalGet = category.get;
        const pages = Math.ceil(totalGet / 50);
        let limit = Math.min(totalGet, 50);

        for (let i = 0; i < pages; i++) {
            if (i === pages - 1) {
                limit = totalGet - offset;
            }

            const url = `${this.baseUrl}?category=${category.id}&attributes=price,original_price,permalink,thumbnail&status=active&product_identifier=GTIN&limit=${limit}&offset=${offset}`;

            try {
                const res = await axios.get(url);
                const data = res.data;
                const products = data.results || [];

                const newProducts = products.filter(product => {
                    return this.isDiscounted(product) && this.discountThreshold(product);
                });

                newProducts.forEach(product => {
                    product.category_id = category.id;
                    this.productQueue.enqueue(product);
                });

                offset += limit;
            } catch (error) {
                console.error(`Request failed for category ${category.id}: ${error}`);
                break;
            }
        }
    }

    isDiscounted(product) {
        const originalPrice = product.original_price;
        const price = product.price;
        return originalPrice && price < originalPrice;
    }

    discountThreshold(product) {
        const price = product.price;
        const originalPrice = product.original_price;
        const discountPercentage = Math.round(100 - (price * 100 / originalPrice));

        return (
            (price < 500 && discountPercentage >= 50) ||
            (price >= 500 && price < 2000 && discountPercentage >= 40) ||
            (price >= 2000 && price < 10000 && discountPercentage >= 50) ||
            (price >= 10000 && discountPercentage >= 20)
        );
    }

    async isCoupon(url) {
        const headers = {
            'User-Agent': process.env.USER_AGENT,
            'Cookie': process.env.COOKIE
        };
        try {
            const response = await axios.get(url, { headers });
            const $ = cheerio.load(response.data);
            const label = $('#coupon-awareness-row-label').text().trim();
            return label || null;
        } catch (error) {
            console.error(`Error checking coupon: ${error}`);
            return null;
        }
    }

    async publishProduct() {
        const now = Date.now();
        if (now - this.lastPostTime < this.POST_INTERVAL) {
            console.log('Ainda não é hora de postar. Aguardando o próximo intervalo.');
            return;
        }

        const product = await this.getUniqueProduct();
        if (!product) {
            console.log('Nenhum produto novo para publicar.');
            return;
        }

        const discount = Math.round(100 - (product.price * 100 / product.original_price));

        product.price = Math.round(product.price);
        product.original_price = Math.round(product.original_price);

        const affiliateLink = await acionarApiMercadoLivre(product.permalink, 'correiashop');
        const hasCoupon = await this.isCoupon(product.permalink);

        if (!affiliateLink) {
            console.error(`Erro ao gerar link de afiliado para o produto: ${product.id}`);
            return;
        }

        const header = addEmojis(product.title, product.category_id, discount);
        const message = `${header}\n\nDe R$${product.original_price} Por R$${product.price} - ${discount}% De desconto!!\n${product.shipping?.free_shipping ? '🚚 (Frete Grátis)\n' : ''}${hasCoupon ? `Cupom na tela: ${hasCoupon} 🎟\n` : ''}\n${affiliateLink}`;

        const imageUrl = product.thumbnail.replace(/\.jpg|\.png|\.jpeg/, 'C$&');
        await this.postToBsky(message, imageUrl, product.title);

        // Salvando o produto no arquivo
        await this.savePublishedProduct(product.id);

        // Atualiza o tempo da última postagem
        this.lastPostTime = now;
    }

    async getUniqueProduct() {
        while (!this.productQueue.isEmpty()) {
            const product = await this.productQueue.dequeue();

            // Verifica se o produto já foi publicado nas últimas 24 horas
            const alreadyPublished = await this.isProductAlreadyPublished(product.id);
            if (!alreadyPublished) {
                return product;
            }
        }
        return null;
    }

    async isProductAlreadyPublished(productId) {
        try {
            const data = await fs.readFile(PUBLISHED_PRODUCTS_FILE, 'utf8');
            const publishedProducts = data.split('\n').filter(Boolean);
            return publishedProducts.includes(productId);
        } catch (err) {
            console.log('Erro ao ler o arquivo de produtos publicados:', err);
            return false;
        }
    }

    async savePublishedProduct(productId) {
        try {
            await fs.appendFile(PUBLISHED_PRODUCTS_FILE, `${productId}\n`);
        } catch (err) {
            console.log('Erro ao salvar o produto no arquivo:', err);
        }
    }

    async clearPublishedProducts() {
        try {
            await fs.writeFile(PUBLISHED_PRODUCTS_FILE, '');
        } catch (err) {
            console.log('Erro ao limpar o arquivo de produtos publicados:', err);
        }
    }

    async postToBsky(message, imageUrl, title) {
        if (!process.env.BSKY_HANDLE || !process.env.BSKY_APP_PASSWORD) {
            throw new Error('BSKY_HANDLE and BSKY_APP_PASSWORD must be set');
        }

        await this.agent.login({
            identifier: process.env.BSKY_HANDLE,
            password: process.env.BSKY_APP_PASSWORD,
        });

        const imageBase64 = await this.downloadImage(imageUrl);

        const { data } = await this.agent.uploadBlob(Buffer.from(imageBase64, 'base64'), {
            encoding: 'image/jpeg',
        });

        const rt = new RichText({ text: message });
        await rt.detectFacets(this.agent);

        const postRecord = {
            $type: 'app.bsky.feed.post',
            text: rt.text,
            facets: rt.facets,
            embed: {
                $type: 'app.bsky.embed.images',
                images: [{ alt: title, image: data.blob }],
            },
            createdAt: new Date().toISOString(),
        };

        await this.agent.post(postRecord);
        console.log("Just posted an image to Bsky!");
    }

    async downloadImage(url) {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        return Buffer.from(response.data, 'binary').toString('base64');
    }
}

async function botHandler() {
    try {
        const data = JSON.parse(await fs.readFile('./categories.json', 'utf8'));
        const categories = data.categories;

        const ml = new MercadoLibre();

        // Limpa o arquivo de produtos publicados a cada 24 horas
        setTimeout(() => ml.clearPublishedProducts(), 24 * 60 * 60 * 1000);

        // Buscar produtos de todas as categorias
        for (const category of categories) {
            await ml.fetchProducts(category);
        }

        // Publica um produto após a coleta
        await ml.publishProduct();
    } catch (error) {
        console.error(`Error in bot handler: ${error}`);
    }
}

// Função para rodar o bot a cada 15 minutos
setInterval(botHandler, 15 * 60 * 1000);

botHandler();
