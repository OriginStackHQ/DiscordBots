const { Client, GatewayIntentBits, Collection, GatewayDispatchEvents } = require("discord.js");
const fs = require("fs");
const { deployCommands } = require("./deploy-commands");
const { log } = require("./utils/common");
const config = require("./config");
const express = require("express");
const { connectToDatabase } = require("./mongodb");
const { initializePlayer } = require("./player");

const client = new Client({
  intents: Object.keys(GatewayIntentBits).map((a) => {
    return GatewayIntentBits[a];
  }),
});

client.commands = new Collection();

console.log("                   \x1b[35mStarting the Discord bot...\x1b[0m");

console.log("\x1b[34m");
console.log(`
    ██████╗  ██████╗ ████████╗    ██████╗  █████╗ ███████╗███████╗
    ██╔══██╗██╔═══██╗╚══██╔══╝    ██╔══██╗██╔══██╗██╔════╝██╔════╝
    ██████╔╝██║   ██║   ██║       ██████╔╝███████║███████╗█████╗  
    ██╔══██╗██║   ██║   ██║       ██╔══██╗██╔══██║╚════██║██╔══╝  
    ██████╔╝╚██████╔╝   ██║       ██████╔╝██║  ██║███████║███████╗
    ╚═════╝  ╚═════╝    ╚═╝       ╚═════╝ ╚═╝  ╚═╝╚══════╝╚══════╝
`);
console.log("\x1b[0m");

log("INFO", "Loading commands...");
const commandFolders = fs.readdirSync("./commands");

for (const folder of commandFolders) {
  if (!fs.statSync(`./commands/${folder}`).isDirectory()) continue;
  log("INFO", `Loading commands from folder: ${folder}`);
  const commandFiles = fs.readdirSync(`./commands/${folder}`).filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(`./commands/${folder}/${file}`);
    client.commands.set(command.data.name, command);
    log("SUCCESS", `Command loaded: ${command.data.name}`);
  }
}

log("INFO", "Loading events...");
const eventFiles = fs.readdirSync("./events").filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const event = require(`./events/${file}`);
  client.on(event.name, (...args) => event.execute(...args));
  log("SUCCESS", `Event loaded: ${file.replace(".js", "")}`);
}

initializePlayer(client);

// Forward voice packets as soon as they arrive (Moonlink ignores early ones)
client.on("raw", (d) => {
  if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
  client.manager.packetUpdate(d);
});

async function main() {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Login to Discord
    await client.login(config.token);
    log("INFO", "Logged in to Discord.");

    // Deploy slash commands
    await deployCommands();
    log("SUCCESS", `Bot ready as ${client.user.tag}`);
  } catch (err) {
    log("ERROR", `Startup failed: ${err.message}`);
    console.error(err);
    process.exit(1);
  }
}

main();

const app = express();
const port = config.port;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: `${client.user.username} is running!` });
});

app.listen(port, () => {
  log("SUCCESS", `Server started on port ${port}`);
});
