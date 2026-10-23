require("dotenv").config();

module.exports = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  logging: false,
  port: process.env.PORT || 8080,
  mongodbUri: process.env.MONGODB_URI,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiBaseUrl: process.env.OPENAI_BASE_URL,
  openAiModel: process.env.OPENAI_MODEL,
};
