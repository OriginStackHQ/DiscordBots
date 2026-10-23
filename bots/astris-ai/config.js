require("dotenv").config();

module.exports = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  logging: false,
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiBaseUrl: process.env.OPENAI_BASE_URL,
  openAiModel: process.env.OPENAI_MODEL,
  openAiVisionModel: process.env.OPENAI_VISION_MODEL,
  port: process.env.PORT || 8080,
  mongodbUri: process.env.MONGODB_URI,
  ignorePrefix: "!",
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiUrl: "https://api.cloudflare.com",
};
