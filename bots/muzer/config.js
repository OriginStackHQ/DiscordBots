require("dotenv").config();

module.exports = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  logging: false,
  port: process.env.PORT || 8080,
  mongodbUri: process.env.MONGODB_URI,
  nodes: [
    {
      host: "lavalink.serenetia.com",
      password: "https://dsc.gg/ajidevserver",
      port: 443,
      secure: true,
    },
    {
      host: "lavalinkv4.serenetia.com",
      port: 443,
      password: "https://seretia.link/discord",
      secure: true,
    },
  ],
};
