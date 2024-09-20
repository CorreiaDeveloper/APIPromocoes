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

    // Extraindo o short_url da resposta
    if (response.data.urls && response.data.urls.length > 0) {
      return response.data.urls[0].short_url;  // Acessando o short_url do primeiro item
    } else {
      console.error("Nenhum URL de afiliado retornado");
      return null;
    }

  } catch (error) {
    console.error("Erro ao acionar a API:", error.response ? error.response.data : error.message);
    return null;
  }
}


const emojis = {
  "MLB5672": "🚗", // Acessórios para Veículos
  "MLB271599": "🎁", // Agro
  "MLB1403": "🍔", // Alimentos e Bebidas
  "MLB1071": "🐶", // Animais
  "MLB1367": "🕰️", // Antiguidades e Coleções
  "MLB1368": "🎨", // Arte, Papelaria e Armarinho
  "MLB1384": "👶", // Bebês
  "MLB1246": "💄", // Beleza e Cuidado Pessoal
  "MLB1132": "🎲", // Brinquedos e Hobbies
  "MLB1430": "👗", // Calçados, Roupas e Bolsas
  "MLB1039": "📷", // Câmeras e Acessórios
  "MLB1743": "🚗", // Carros, Motos e Outros (Usando o emoji de "Acessórios para Veículos" como exemplo)
  "MLB1574": "🏡", // Casa, Móveis e Decoração
  "MLB1051": "📱", // Celulares e Telefones
  "MLB1500": "🚧", // Construção
  "MLB5726": "🔧", // Eletrodomésticos
  "MLB1000": "🎧", // Eletrônicos, Áudio e Vídeo
  "MLB1276": "🏋️", // Esportes e Fitness
  "MLB263532": "🔨", // Ferramentas (Emoji de ferramentas genérico, você pode ajustar conforme necessário)
  "MLB12404": "🎉", // Festas e Lembrancinhas
  "MLB1144": "🎮", // Games
  "MLB1459": "🏠", // Imóveis
  "MLB1499": "🏢", // Indústria e Comércio
  "MLB1648": "💻", // Informática
  "MLB218519": "🎫", // Ingressos
  "MLB1182": "🎸", // Instrumentos Musicais
  "MLB3937": "⌚", // Joias e Relógios
  "MLB1196": "📚", // Livros, Revistas e Comics
  "MLB1168": "🎥", // Música, Filmes e Seriados
  "MLB264586": "💊", // Saúde (Emoji de saúde genérico, ajuste conforme necessário)
  "MLB1540": "🛠️", // Serviços (Emoji de ferramentas como exemplo)
  "MLB1953": "📦" // Mais Categorias (Emoji de caixa como exemplo)
};


function addEmojis(headerMessage, category, discount) {
  if (discount < 30) {
    return headerMessage;
  }

  const randomChoice = Math.floor(Math.random() * 2) + 1;
  let finalMessage;

  if (randomChoice === 1) {
    const exclamationWords = [" SUPER", " INCRÍVEL"];
    const discountWords = [" DESCONTO", " OFERTA", " PREÇO"];
    const exclamationWord = exclamationWords[Math.floor(Math.random() * exclamationWords.length)];
    const discountWord = discountWords[Math.floor(Math.random() * discountWords.length)];
    finalMessage = `${exclamationWord} ${discountWord}`;
  } else {
    const errorMessages = [" ERRO DE PREÇO", " CORRA JÁ", " CORRA, RÁPIDO!", " NO MENOR PREÇO"];
    finalMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
  }


  return `📢⚠️¡${finalMessage}!\n\n${headerMessage} ${emojis[category] || ''}`;
}

module.exports = { acionarApiMercadoLivre, addEmojis };
