const axios = require('axios');
require('dotenv').config(); // Adicione isso se estiver usando variáveis de ambiente do arquivo .env

async function acionarApiMercadoLivre(url, tag) {
  try {
    const apiUrl = "https://www.mercadolivre.com.br/affiliate-program/api/affiliates/v1/createUrls";

    const body = {
      urls: [url],
      tag: tag
    };

    const headers = {
      'User-Agent': process.env.USER_AGENT,
      'Content-Type': 'application/json;charset=utf-8',
      'x-csrf-token': process.env.X_CSRF_TOKEN,
      'Cookie': process.env.COOKIE
    };

    const response = await axios.post(apiUrl, body, { headers });

    return response.data;
  }
  catch (error) {
    console.error("Erro ao acionar a API:", error.response ? error.response.data : error.message);
    return null;
  }
}

const emojis = {
  "MLB5672": "🚗", // Acessórios para Veículos
  "MLB271599": "🌱", // Agro
  "MLB1403": "🍔", // Alimentos e Bebidas
  "MLB1071": "🐶", // Animais
  "MLB1367": "🕰️", // Antiguidades e Coleções
  "MLB1368": "🎨", // Arte, Papelaria e Armarinho
  "MLB1384": "👶", // Bebês
  "MLB1246": "💄", // Beleza e Cuidado Pessoal
  "MLB1132": "🎲", // Brinquedos e Hobbies
  "MLB1430": "👗", // Calçados, Roupas e Bolsas
  "MLB1039": "📷", // Câmeras e Acessórios
  "MLB1743": "🏎️", // Carros, Motos e Outros (Emoji de carro esportivo para mais impacto)
  "MLB1574": "🏠", // Casa, Móveis e Decoração
  "MLB1051": "📱", // Celulares e Telefones
  "MLB1500": "🔨", // Construção (Emoji de martelo, mais apropriado que "🚧")
  "MLB5726": "🔧", // Eletrodomésticos
  "MLB1000": "🎧", // Eletrônicos, Áudio e Vídeo
  "MLB1276": "🏋️‍♂️", // Esportes e Fitness (Inclui emoji de pessoa levantando peso)
  "MLB263532": "🛠️", // Ferramentas
  "MLB12404": "🎉", // Festas e Lembrancinhas
  "MLB1144": "🎮", // Games
  "MLB1459": "🏡", // Imóveis (Emoji de casa com jardim)
  "MLB1499": "🏢", // Indústria e Comércio
  "MLB1648": "💻", // Informática
  "MLB218519": "🎫", // Ingressos
  "MLB1182": "🎸", // Instrumentos Musicais
  "MLB3937": "💎", // Joias e Relógios (Emoji de diamante para maior valor)
  "MLB1196": "📚", // Livros, Revistas e Comics
  "MLB1168": "🎬", // Música, Filmes e Seriados (Emoji de claquete de cinema)
  "MLB264586": "💊", // Saúde (Emoji de pílula para saúde)
  "MLB1540": "🔧", // Serviços (Já utilizado para serviços, manutenção)
  "MLB1953": "📦" // Mais Categorias
};

function addEmojis(headerMessage, category, discount) {
  // Define o emoji para a categoria
  const categoryEmoji = emojis[category] || '';

  // Cria uma mensagem de desconto baseada no valor
  const discountMessage = discount >= 50
    ? `🎉🎉 MAIOR DESCONTO! ${discount}% OFF! 🎉🎉`
    : '';

  // Cria uma mensagem de urgência ou exaltação
  const urgencyMessages = [
    "🚨 ATENÇÃO! NÃO PERCA!",
    "🔥 OFERTA IMPERDÍVEL!",
    "⚡ CORRA, É POR TEMPO LIMITADO!",
    "🎯 OFERTA EXCLUSIVA, APROVEITE!"
  ];
  const randomUrgencyMessage = urgencyMessages[Math.floor(Math.random() * urgencyMessages.length)];

  return `${randomUrgencyMessage}\n${discountMessage}\n${headerMessage} ${categoryEmoji}`;
}

module.exports = { acionarApiMercadoLivre, addEmojis };
