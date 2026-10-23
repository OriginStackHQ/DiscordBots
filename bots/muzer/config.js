require("dotenv").config();

module.exports = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,
  logging: false,
  port: process.env.PORT || 8080,
  mongodbUri: process.env.MONGODB_URI,
  nodes: [
    {
      host: "127.0.0.1",
      port: 3000,
      password: "youshallnotpass",
      secure: false,
    },
  ],
};
