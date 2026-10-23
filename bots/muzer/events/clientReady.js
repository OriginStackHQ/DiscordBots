const { ActivityType } = require("discord.js");
const { log } = require("../utils/common");

function setBotStatus(client) {
  try {
    const activePlayers = Array.from(client.riffy.players.values()).filter((player) => player.playing);

    if (!activePlayers.length) {
      client.user.setPresence({
        activities: [
          {
            name: "Enjoy Your Music",
            type: ActivityType.Custom,
          },
        ],
        status: "online",
      });
      return;
    }

    client.user.setPresence({
      activities: [
        {
          name: `Currently Playing in ${activePlayers.length} server`,
          type: ActivityType.Custom,
        },
      ],
      status: "idle",
    });
  } catch (error) {
    log("ERROR", `Failed to set command status: ${error.message}`);
  }
}

module.exports = {
  name: "clientReady",
  once: true,
  execute(client) {
    try {
      client.user.setPresence({
        activities: [
          {
            name: "Enjoy your music",
            type: ActivityType.Custom,
          },
        ],
        status: "online",
      });

      setInterval(() => setBotStatus(client), 5000);

      client.riffy.init(client.user.id);
    } catch (error) {
      console.error("Error setting presence:", error);
    }
  },
};
