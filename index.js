const fs = require('fs').promises;
const MercadoLibre = require('./services//mercadoLibreService'); // Importa o módulo MercadoLibre
require('dotenv').config();

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

// Executa imediatamente
botHandler();
