const fs = require('fs').promises;
const axios = require('axios');
const cheerio = require('cheerio');
const { acionarApiMercadoLivre, addEmojis } = require('./helpers');
require('dotenv').config();
const Queue = require('./queue');

class MercadoLibre {
    constructor() {
        this.baseUrl = "https://api.mercadolibre.com/sites/MLB/search";
        this.productQueue = new Queue();
    }

    async fetchProducts(category) {

        let offset = 0;
        const totalGet = category.get;
        const pages = Math.ceil(totalGet / 50);
        let limit = Math.min(totalGet, 50);

        for (let i = 0; i < pages; i++) {
            if (i === pages - 1) { // Last page
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

                if (newProducts.length > 0) {
                    console.log(`${category.id} ${category.name}: Com desconto: ${newProducts.length}`);
                }

                // if (newProducts.length == 0) {
                //     console.log(`${category.id} ${category.name}: Sem desconto: ${newProducts.length}`);
                // }

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
        while (true) {
            const product = await this.productQueue.dequeue();

            const discount = Math.round(100 - (product.price * 100 / product.original_price));

            product.price = Math.round(product.price);
            product.original_price = Math.round(product.original_price);

            const affiliateLink = await acionarApiMercadoLivre(product.permalink, 'correiashop');
            const hasCoupon = await this.isCoupon(product.permalink);


            if (hasCoupon) {
                console.log(`Cupom encontrado: ${product.id} ${hasCoupon}`);
            } 
            // else {
            //     console.log(`Não há cupons encontrados para ${product.permalink}`);
            // }

            if (!affiliateLink) {
                console.error(`Erro ao gerar link de afiliado para o produto: ${product.id}`);
                continue;
            }

            const header = addEmojis(product.title, product.category_id, discount);
            const message = `${header}\nDe R$${product.original_price} Por R$${product.price} - ${discount}% De desconto!!\n${product.shipping.free_shipping ? '🚚 (Frete Grátis)\n' : ''}${hasCoupon ? `Cupom na tela: ${hasCoupon} 🎟\n` : ''}\n${affiliateLink}\n`;            
            
            const imageUrl = product.thumbnail.replace(/\.jpg|\.png|\.jpeg/, 'C$&');
            // console.log(`Publishing product: ${product.id} - ${product.permalink} - original: ${product.original_price} - ahora: ${product.price}\n`);

            console.log(message)

            // try {
            //     await this.bot.sendPhoto(CHANNEL_ID, imageUrl, { caption: message, parse_mode: 'HTML' });
            //     await saveProduct(product.id);
            //     this.productQueue.taskDone();
            //     await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
            // } catch (error) {
            //     console.error(`Error publishing product: ${error}`);
            //     this.productQueue.taskDone();
            // }
        }
    }
}

async function botHandler() {
    try {
        const data = JSON.parse(await fs.readFile('./categories.json', 'utf8'));
        const categories = data.categories;

        const ml = new MercadoLibre();

        const promises = categories.map(category => ml.fetchProducts(category));
        await Promise.all(promises);

        ml.publishProduct();

    } catch (error) {
        console.error(`Error in bot handler: ${error}`);
    }
}

botHandler();
