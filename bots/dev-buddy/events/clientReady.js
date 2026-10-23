const { ActivityType } = require("discord.js");
const { log } = require("../utils/common");

function setBotStatus(client, status) {
  try {
    client.user.setPresence({
      activities: [
        {
          name: status,
          type: ActivityType.Custom,
        },
      ],
      status: "idle",
    });

    setTimeout(() => {
      client.user.setPresence({
        activities: [
          {
            name: "Powered by creativity & code",
            type: ActivityType.Custom,
          },
        ],
        status: "online",
      });
    }, 8000);
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
            name: "Powered by creativity & code",
            type: ActivityType.Custom,
          },
        ],
        status: "online",
      });

      client.setBotStatus = setBotStatus;
    } catch (error) {
      console.error("Error setting presence:", error);
    }
  },
};
