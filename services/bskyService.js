const { AtpAgent, RichText } = require('@atproto/api');
const axios = require('axios');

// Inicialize o agente da API do Bluesky
const agent = new AtpAgent({
    service: 'https://bsky.social' // URL do serviço do Bluesky
});

async function postToBsky(message, imageUrl, title) {
    if (!process.env.BSKY_HANDLE || !process.env.BSKY_APP_PASSWORD) {
        throw new Error('BSKY_HANDLE and BSKY_APP_PASSWORD must be set');
    }

    // Faça o login no Bluesky
    await agent.login({
        identifier: process.env.BSKY_HANDLE,
        password: process.env.BSKY_APP_PASSWORD,
    });

    // Baixe a imagem e converta para base64
    const imageBase64 = await downloadImage(imageUrl);

    // Faça o upload da imagem
    const { data } = await agent.uploadBlob(Buffer.from(imageBase64, 'base64'), {
        encoding: 'image/jpeg',
    });

    // Crie o texto enriquecido com facetas
    const rt = new RichText({ text: message });
    await rt.detectFacets(agent);

    // Crie o post
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

    // Publique no Bluesky
    await agent.post(postRecord);
    console.log("Just posted an image to Bsky!");
}

async function downloadImage(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
}

module.exports = { postToBsky, downloadImage };
