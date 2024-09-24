const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
const { acionarApiMercadoLivre, addEmojis } = require('./../utils/helpers.js');
const { AtpAgent } = require('@atproto/api');
const Queue = require('./../utils/queue.js');
const { postToBsky } = require('./../services/bskyService.js');
const errors = require('./../utils/errors.js');
const { PUBLISHED_PRODUCTS_FILE, IGNORED_PRODUCTS_FILE } = require('./../config/filePaths.js');
require('dotenv').config();

class MercadoLibre {
    constructor() {
        this.baseUrl = "https://api.mercadolibre.com/sites/MLB/search";
        this.agent = new AtpAgent({
            service: 'https://bsky.social'
        });
        this.productQueue = new Queue();
        this.lastPostTime = 0;
        this.POST_INTERVAL = 15 * 60 * 1000;
        this.ignoredProducts = new Map(); // Usando Map para armazenar produtos ignorados com mensagens de erro
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

            const url = `${this.baseUrl}?category=${category.id}&attributes=sale_price&status=active&product_identifier=GTIN&limit=${limit}&offset=${offset}`;

            try {
                const res = await axios.get(url);
                const data = res.data;
                const products = data.results || [];

                const newProducts = products.filter(product => {
                    return this.isDiscounted(product) && this.discountThreshold(product) && !this.ignoredProducts.has(product.id);
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
        const salePrice = product.sale_price || {};
        const regularAmount = salePrice.regular_amount;
        const amount = salePrice.amount;
        return regularAmount && amount < regularAmount;
    }

    discountThreshold(product) {
        const salePrice = product.sale_price || {};
        const amount = salePrice.amount;
        const regularAmount = salePrice.regular_amount;
        const discountPercentage = Math.round(100 - (amount * 100 / regularAmount));

        return (
            (amount < 500 && discountPercentage >= 30) ||
            (amount >= 500 && amount < 2000 && discountPercentage >= 25) ||
            (amount >= 2000 && amount < 10000 && discountPercentage >= 20) ||
            (amount >= 10000 && discountPercentage >= 10)
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

        while (!this.productQueue.isEmpty()) {
            const product = await this.getUniqueProduct();
            if (!product) {
                console.log('Nenhum produto novo para publicar.');
                return;
            }

            const salePrice = product.sale_price || {};
            const amount = salePrice.amount;
            const regularAmount = salePrice.regular_amount;
            const discount = Math.round(100 - (amount * 100 / regularAmount));

            // Formata valores monetários com vírgula como separador decimal
            const formattedAmount = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const formattedRegularAmount = regularAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            try {
                const affiliateLinkResponse = await acionarApiMercadoLivre(product.permalink, 'correiashop');

                if (affiliateLinkResponse && affiliateLinkResponse.status === 200 && affiliateLinkResponse.total_error === 0) {
                    const affiliateLink = affiliateLinkResponse.urls[0].short_url; // Ajuste se a estrutura da resposta for diferente
                    const hasCoupon = await this.isCoupon(product.permalink);

                    const header = addEmojis(product.title, product.category_id, discount);
                    const message = `${header}\n\nDe R$${formattedRegularAmount} Por R$${formattedAmount} - ${discount}% De desconto!!\n${product.shipping?.free_shipping ? '🚚 (Frete Grátis)\n' : ''}${hasCoupon ? `Cupom na tela: ${hasCoupon} 🎟\n` : ''}\n${affiliateLink}`;

                    const imageUrl = product.thumbnail.replace(/\.jpg|\.png|\.jpeg/, 'C$&');
                    await postToBsky(message, imageUrl, product.title);

                    // Salvando o produto no arquivo
                    await this.savePublishedProduct(product.id);

                    // Atualiza o tempo da última postagem
                    this.lastPostTime = now;
                    return; // Sai após publicar um produto com sucesso
                } else {
                    const errorCode = affiliateLinkResponse.urls[0].error_code;
                    throw new Error(`Erro ao gerar link de afiliado: ${errors[errorCode] || 'Erro desconhecido.'} - ${affiliateLinkResponse.urls[0].error_code}`);
                }
            } catch (error) {
                console.error(error.message);
                this.ignoredProducts.set(product.id, error.message); // Adiciona ou atualiza a mensagem de erro
                await this.saveIgnoredProduct(product.id, error.message);
                // Tenta o próximo produto da fila
                continue;
            }
        }
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
            console.log(`Saving product id: ${productId} in ${PUBLISHED_PRODUCTS_FILE}`);
            await fs.appendFile(PUBLISHED_PRODUCTS_FILE, `${productId}\n`);
        } catch (err) {
            console.log('Erro ao salvar o produto no arquivo:', err);
        }
    }

    async saveIgnoredProduct(productId, reason) {
        try {
            await fs.appendFile(IGNORED_PRODUCTS_FILE, `${productId} - ${reason}\n`);
        } catch (err) {
            console.log('Erro ao salvar o produto ignorado no arquivo:', err);
        }
    }

    async clearPublishedProducts() {
        try {
            await fs.writeFile(PUBLISHED_PRODUCTS_FILE, '');
        } catch (err) {
            console.log('Erro ao limpar o arquivo de produtos publicados:', err);
        }
    }
}

module.exports = MercadoLibre;
