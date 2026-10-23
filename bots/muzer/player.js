const { Manager } = require("moonlink.js");
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require("discord.js");
const config = require("./config.js");
const icons = require("./icons");
const axios = require("axios");
const { getCollection } = require("./mongodb.js");
const { log } = require("./utils/common.js");
const { VibeSync } = require("vibesync");

// Constants and configurations
const PERMISSIONS_REQUIRED = [
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.EmbedLinks,
  PermissionsBitField.Flags.AttachFiles,
  PermissionsBitField.Flags.UseExternalEmojis,
];

const CONTROL_BUTTONS = {
  ROW_ONE: ["loopToggle", "disableLoop", "skipTrack", "showLyrics", "clearQueue"],
  ROW_TWO: ["stopTrack", "pauseTrack", "resumeTrack", "volumeUp", "volumeDown"],
};

const VOLUME_LIMITS = { MIN: 10, MAX: 100, STEP: 10 };
const COLLECTOR_TIMEOUT = 600000; // 10 minutes
const MESSAGE_DELETE_DELAY = 3000; // 3 seconds

// Utility functions
const timeFormatter = {
  msToReadable: (milliseconds) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);

    return parts.join(" ");
  },
};

const permissionValidator = {
  checkBotPermissions: (channel) => {
    const botPermissions = channel.permissionsFor(channel.guild.members.me);
    return PERMISSIONS_REQUIRED.every((permission) => botPermissions?.has(permission));
  },
};

const messageManager = {
  sendNotification: async (channel, content) => {
    const notification = new EmbedBuilder()
      .setColor("#fe8a7a")
      .setAuthor({ name: "Music Notification", iconURL: icons.headerIcon })
      .setDescription(content)
      .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });
    try {
      const message = await channel.send({ embeds: [notification] });
      setTimeout(() => message.delete().catch(() => {}), MESSAGE_DELETE_DELAY);
      return message;
    } catch (error) {
      console.error("Failed to send notification:", error.message);
    }
  },

  sendPlayerMessage: async (channel, embedData, controls) => {
    if (!permissionValidator.checkBotPermissions(channel)) {
      console.error("Insufficient permissions for channel:", channel.name);
      return null;
    }

    try {
      const message = await channel.send({
        embeds: [embedData],
        components: controls,
      });
      return message;
    } catch (error) {
      console.error("Failed to send player message:", error.message);
      messageManager.sendNotification(channel, "⚠️ **Failed to display player interface.**");
      return null;
    }
  },
};

const embedCreator = {
  buildTrackEmbed: (trackInfo, requesterInfo, thumbnail) => {
    return new EmbedBuilder()
      .setColor("#fe8a7a")
      .setAuthor({
        name: "Now Playing",
        iconURL: icons.headerIcon,
      })
      .setThumbnail(thumbnail)
      .addFields(
        {
          name: "Track",
          value: `[${trackInfo.title}](${trackInfo.uri})`,
          inline: false,
        },
        {
          name: "Artist",
          value: trackInfo.author || "Unknown Artist",
          inline: true,
        },
        {
          name: "Duration",
          value: timeFormatter.msToReadable(trackInfo.duration),
          inline: true,
        },
        {
          name: "Platform",
          value: trackInfo.sourceName,
          inline: true,
        },
        {
          name: "Requested by",
          value: requesterInfo,
          inline: false,
        },
      )
      .setFooter({
        text: "Enjoy your music",
        iconURL: icons.footerIcon,
      })
      .setTimestamp();
  },
};

const controlsBuilder = {
  createButtonRows: (isDisabled = false) => {
    const firstRowButtons = [
      { id: "stopTrack", emoji: "⏹️", label: "Stop", style: ButtonStyle.Danger },
      { id: "resumeTrack", emoji: "▶️", label: "Resume", style: ButtonStyle.Secondary },
      { id: "pauseTrack", emoji: "⏸️", label: "Pause", style: ButtonStyle.Secondary },
    ];

    const secondRowButtons = [
      { id: "volumeUp", emoji: "🔊", label: "Vol Up", style: ButtonStyle.Secondary },
      { id: "volumeDown", emoji: "🔉", label: "Vol Down", style: ButtonStyle.Secondary },
      { id: "skipTrack", emoji: "⏭️", label: "Skip", style: ButtonStyle.Secondary },
    ];

    const thirdRowButtons = [
      { id: "clearQueue", emoji: "🗑️", label: "Clear Queue", style: ButtonStyle.Secondary },
      { id: "showLyrics", emoji: "🎤", label: "Lyrics", style: ButtonStyle.Secondary },
    ];

    const fourthRowButtons = [
      { id: "loopToggle", emoji: "🔁", label: "Track/Queue Loop", style: ButtonStyle.Secondary },
      { id: "disableLoop", emoji: "❌", label: "Disable Loop", style: ButtonStyle.Secondary },
    ];

    const firstRow = new ActionRowBuilder().addComponents(
      firstRowButtons.map((btn) =>
        new ButtonBuilder()
          .setCustomId(btn.id)
          .setEmoji(btn.emoji)
          .setLabel(btn.label)
          .setStyle(btn.style)
          .setDisabled(isDisabled),
      ),
    );

    const secondRow = new ActionRowBuilder().addComponents(
      secondRowButtons.map((btn) =>
        new ButtonBuilder()
          .setCustomId(btn.id)
          .setEmoji(btn.emoji)
          .setLabel(btn.label)
          .setStyle(btn.style)
          .setDisabled(isDisabled),
      ),
    );

    const thirdRow = new ActionRowBuilder().addComponents(
      thirdRowButtons.map((btn) =>
        new ButtonBuilder()
          .setCustomId(btn.id)
          .setEmoji(btn.emoji)
          .setLabel(btn.label)
          .setStyle(btn.style)
          .setDisabled(isDisabled),
      ),
    );

    const fourthRow = new ActionRowBuilder().addComponents(
      fourthRowButtons.map((btn) =>
        new ButtonBuilder()
          .setCustomId(btn.id)
          .setEmoji(btn.emoji)
          .setLabel(btn.label)
          .setStyle(btn.style)
          .setDisabled(isDisabled),
      ),
    );

    return [firstRow, secondRow, thirdRow, fourthRow];
  },
};

const databaseManager = {
  storeTrackMessage: async (guildId, messageId, channelId, messageType = "track") => {
    try {
      await getCollection("trackMessages").insertOne({
        guildId,
        messageId,
        channelId,
        type: messageType,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Failed to store track message:", error.message);
    }
  },

  cleanupGuildMessages: async (guildId) => {
    try {
      const messagesToClean = await getCollection("trackMessages").find({ guildId }).toArray();

      await getCollection("trackMessages").deleteMany({ guildId });
      return messagesToClean;
    } catch (error) {
      console.error("Failed to cleanup guild messages:", error.message);
      return [];
    }
  },
};

const messageCleanup = {
  removePreviousMessages: async (client, guildId, reason = "unspecified") => {
    const messagesToDelete = await databaseManager.cleanupGuildMessages(guildId);

    if (!messagesToDelete.length) return;

    const ids = messagesToDelete.map((m) => m.messageId).join(", ");
    log("DEBUG", `Deleting ${messagesToDelete.length} tracked message(s) for guild ${guildId} (reason: ${reason}) [${ids}]`);

    for (const msgInfo of messagesToDelete) {
      try {
        const targetChannel = client.channels.cache.get(msgInfo.channelId);
        if (!targetChannel) continue;

        const targetMessage = await targetChannel.messages.fetch(msgInfo.messageId).catch(() => null);

        if (targetMessage) {
          await targetMessage.delete().catch(() => {});
        }
      } catch (error) {
        console.error("Message deletion error:", error.message);
      }
    }
  },
};

const volumeController = {
  adjustPlayerVolume: (player, channel, adjustment) => {
    const currentVolume = player.volume;
    const targetVolume = Math.min(VOLUME_LIMITS.MAX, Math.max(VOLUME_LIMITS.MIN, currentVolume + adjustment));

    if (targetVolume === currentVolume) {
      const message =
        adjustment > 0 ? "🔊 **Volume already at maximum level!**" : "🔉 **Volume already at minimum level!**";
      messageManager.sendNotification(channel, message);
    } else {
      player.setVolume(targetVolume);
      messageManager.sendNotification(channel, `🔊 **Volume adjusted to ${targetVolume}%**`);
    }
  },
};

const loopManager = {
  toggleLoopMode: (player, channel) => {
    const newMode = player.loop === "track" ? "queue" : "track";
    player.setLoop(newMode);

    const message = newMode === "track" ? "🔁 **Single track loop enabled!**" : "🔁 **Queue loop enabled!**";
    messageManager.sendNotification(channel, message);
  },

  disableLoop: (player, channel) => {
    player.setLoop("off");
    messageManager.sendNotification(channel, "❌ **Loop mode disabled!**");
  },
};

const lyricsService = {
  sanitizeSearchTerms: (title, artist) => {
    const cleanTitle = title
      .replace(
        /\b(Official|Audio|Video|Lyrics|Theme|Soundtrack|Music|Full Version|HD|4K|Visualizer|Radio Edit|Live|Remix|Mix|Extended|Cover|Parody|Performance|Version|Unplugged|Reupload)\b/gi,
        "",
      )
      .replace(/\s*[-_/|]\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const cleanArtist = artist
      .replace(/\b(Topic|VEVO|Records|Label|Productions|Entertainment|Ltd|Inc|Band|DJ|Composer|Performer)\b/gi, "")
      .replace(/ x /gi, " & ")
      .replace(/\s+/g, " ")
      .trim();

    return { cleanTitle, cleanArtist };
  },

  fetchLyrics: async (trackTitle, artistName, trackDuration) => {
    const { cleanTitle, cleanArtist } = lyricsService.sanitizeSearchTerms(trackTitle, artistName);

    try {
      // First attempt with duration
      let response = await axios.get("https://lrclib.net/api/get", {
        params: {
          track_name: cleanTitle,
          artist_name: cleanArtist,
          duration: trackDuration,
        },
      });

      if (response.data.syncedLyrics || response.data.plainLyrics) {
        return response.data.syncedLyrics || response.data.plainLyrics;
      }

      // Second attempt without duration
      response = await axios.get("https://lrclib.net/api/get", {
        params: {
          track_name: cleanTitle,
          artist_name: cleanArtist,
        },
      });

      return response.data.syncedLyrics || response.data.plainLyrics;
    } catch (error) {
      console.error("Lyrics fetch error:", error.response?.data?.message || error.message);
      return null;
    }
  },

  displayLyrics: async (channel, player) => {
    const currentTrack = player?.current;

    if (!currentTrack) {
      messageManager.sendNotification(channel, "🚫 **No active track found.**");
      return;
    }

    const lyricsContent = await lyricsService.fetchLyrics(
      currentTrack.title,
      currentTrack.author,
      Math.floor(currentTrack.duration / 1000),
    );

    if (!lyricsContent) {
      messageManager.sendNotification(channel, "❌ **Lyrics unavailable for this track.**");
      return;
    }

    const lyricsLines = lyricsContent
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const trackDurationSeconds = Math.floor(currentTrack.duration / 1000);

    const lyricsEmbed = new EmbedBuilder()
      .setColor("#fe8a7a")
      .setAuthor({ name: "Lyrics", iconURL: icons.headerIcon })
      .setTitle(`🎵 Live Lyrics: ${currentTrack.title}`)
      .setDescription("🔄 Synchronizing lyrics...")
      .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

    const controlButtons = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("fullLyrics").setLabel("Show Full").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId("stopLyrics").setLabel("Stop").setStyle(ButtonStyle.Danger),
    );

    const lyricsMessage = await channel.send({
      embeds: [lyricsEmbed],
      components: [controlButtons],
    });

    await databaseManager.storeTrackMessage(player.guildId, lyricsMessage.id, channel.id, "lyrics");

    const updateLyricsDisplay = async () => {
      if (!player.current) return;

      const currentPosition = Math.floor((player.current.position ?? 0) / 1000);
      const linesPerSecond = lyricsLines.length / trackDurationSeconds;
      const currentLineIndex = Math.floor(currentPosition * linesPerSecond);

      const startIndex = Math.max(0, currentLineIndex - 3);
      const endIndex = Math.min(lyricsLines.length, currentLineIndex + 3);
      const visibleLyrics = lyricsLines.slice(startIndex, endIndex).join("\n");

      try {
        lyricsEmbed.setDescription(visibleLyrics);
        await lyricsMessage.edit({ embeds: [lyricsEmbed] });
      } catch (error) {
        // Message deleted (track change / cleanup) — stop updating
        clearInterval(lyricsUpdateInterval);
      }
    };

    const lyricsUpdateInterval = setInterval(updateLyricsDisplay, 3000);
    updateLyricsDisplay();

    const lyricsCollector = lyricsMessage.createMessageComponentCollector({
      time: COLLECTOR_TIMEOUT,
    });

    lyricsCollector.on("collect", async (interaction) => {
      await interaction.deferUpdate();

      switch (interaction.customId) {
        case "stopLyrics":
          clearInterval(lyricsUpdateInterval);
          await lyricsMessage.delete();
          break;
        case "fullLyrics":
          clearInterval(lyricsUpdateInterval);
          lyricsEmbed.setDescription(lyricsLines.join("\n"));

          const deleteButton = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId("deleteLyrics").setLabel("Delete").setStyle(ButtonStyle.Danger),
          );

          await lyricsMessage.edit({
            embeds: [lyricsEmbed],
            components: [deleteButton],
          });
          break;
        case "deleteLyrics":
          await lyricsMessage.delete();
          break;
      }
    });

    lyricsCollector.on("end", () => {
      clearInterval(lyricsUpdateInterval);
      lyricsMessage.delete().catch(() => {});
    });
  },
};

const playerControls = {
  handleUserInteraction: async (interaction, player, channel) => {
    const controlActions = {
      loopToggle: () => loopManager.toggleLoopMode(player, channel),
      skipTrack: async () => {
        await player.skip();
        await messageManager.sendNotification(channel, "⏭️ **Skipping to next track!**");
      },
      disableLoop: () => loopManager.disableLoop(player, channel),
      showLyrics: () => lyricsService.displayLyrics(channel, player),
      clearQueue: async () => {
        player.queue.clear();
        await messageManager.sendNotification(channel, "🗑️ **Queue cleared successfully!**");
      },
      stopTrack: async () => {
        await player.destroy("Player controls: Stop");
        await messageManager.sendNotification(channel, "⏹️ **Playback stopped and player destroyed!**");
      },
      pauseTrack: async () => {
        if (player.paused) {
          await messageManager.sendNotification(channel, "⏸️ **Already paused!**");
        } else {
          await player.pause();
          await messageManager.sendNotification(channel, "⏸️ **Playback paused!**");
        }
      },
      resumeTrack: async () => {
        if (!player.paused) {
          await messageManager.sendNotification(channel, "▶️ **Already playing!**");
        } else {
          await player.resume();
          await messageManager.sendNotification(channel, "▶️ **Playback resumed!**");
        }
      },
      volumeUp: () => volumeController.adjustPlayerVolume(player, channel, VOLUME_LIMITS.STEP),
      volumeDown: () => volumeController.adjustPlayerVolume(player, channel, -VOLUME_LIMITS.STEP),
    };

    const action = controlActions[interaction.customId];
    if (action) await action();
  },

  setupMessageCollector: (client, player, channel, message) => {
    const interactionFilter = (interaction) =>
      [...CONTROL_BUTTONS.ROW_ONE, ...CONTROL_BUTTONS.ROW_TWO].includes(interaction.customId);

    const armCollector = () => {
      const collector = message.createMessageComponentCollector({
        filter: interactionFilter,
        time: COLLECTOR_TIMEOUT,
      });

      collector.on("collect", async (interaction) => {
        await interaction.deferUpdate();

        const userVoiceChannel = interaction.member.voice.channel;
        const playerVoiceChannel = player.voiceChannelId;

        if (!userVoiceChannel || userVoiceChannel.id !== playerVoiceChannel) {
          messageManager.sendNotification(channel, "**Join the same voice channel to use controls!**");
          return;
        }

        playerControls.handleUserInteraction(interaction, player, channel);
      });

      collector.on("end", () => {
        log("INFO", "Message collector ended.");
        // Keep controls alive for long tracks — re-arm until the player is gone
        if (!player.destroyed) armCollector();
      });
    };

    armCollector();
  },
};

const autoplayHandler = {
  handleQueueEnd: async (client, player, lastTrack) => {
    const channel = client.channels.cache.get(player.textChannelId);
    const guildId = player.guildId;

    try {
      const autoplayConfig = await getCollection("guildConfigs").findOne({ guildId });

      if (autoplayConfig?.autoplay) {
        let autoplayed = false;

        try {
          // Moonlink autoplay resolves against the finished track directly
          autoplayed = lastTrack ? await player.node.handleAutoPlay(player, lastTrack) : false;
        } catch (error) {
          log("ERROR", `Autoplay error: ${error.message}`);
        }

        if (!autoplayed) {
          await messageCleanup.removePreviousMessages(client, guildId, "queueEnd");
          await player.destroy("Autoplay unavailable");
          messageManager.sendNotification(channel, "**No more autoplay tracks available.**");
        }
      } else {
        await messageCleanup.removePreviousMessages(client, guildId, "queueEnd");
        log("INFO", `Autoplay disabled for guild: ${guildId}`);
        await player.destroy("Queue ended");
        messageManager.sendNotification(channel, "**Queue ended. Autoplay is disabled.**");
      }
    } catch (error) {
      log("ERROR", `Autoplay error: ${error.message}`);
      await messageCleanup.removePreviousMessages(client, guildId, "queueEnd");
      await player.destroy("Queue end error").catch(() => {});
      messageManager.sendNotification(channel, "**Queue empty! Disconnecting...**");
    }
  },
};

const nodeManager = {
  configureNodes: (config) => {
    return config.nodes.map((nodeConfig) => ({
      identifier: `${nodeConfig.host}:${nodeConfig.port}`,
      host: nodeConfig.host,
      port: nodeConfig.port,
      password: nodeConfig.password,
      secure: nodeConfig.secure,
      retryDelay: 5000,
      retryAmount: 10,
    }));
  },
};

function initializePlayer(client) {
  log("INFO", "Setting up Moonlink music system...");

  const nodeConfiguration = nodeManager.configureNodes(config);

  client.manager = new Manager({
    nodes: nodeConfiguration,
    options: {
      clientName: "muzer/1.0.0",
      // Same as Riffy's ytmsearch default
      search: { defaultPlatform: "youtubemusic" },
      voiceConnection: {
        timeout: 30000,
        autoReconnect: true,
      },
    },
    // Moonlink hands us the guildId + the voice payload directly
    send: (guildId, payload) => {
      const targetGuild = client.guilds.cache.get(guildId);
      if (targetGuild) targetGuild.shard.send(payload);
    },
  });

  const vcStatus = new VibeSync(client);

  // Deferred disconnect cleanups — NodeLink's ConnectionStatusEvent carries
  // network quality ("good"/"bad"), which Moonlink misreads as a voice disconnect
  const pendingDisconnects = new Map(); // guildId → grace timer
  const cancelPendingDisconnect = (guildId) => {
    const timer = pendingDisconnects.get(guildId);
    if (timer) {
      clearTimeout(timer);
      pendingDisconnects.delete(guildId);
    }
  };

  // Node connection events
  client.manager.on("nodeConnect", (node) => {
    log("SUCCESS", `Music node connected ✅ | ${node.host}:${node.port}`);
  });

  client.manager.on("nodeDisconnect", (node, code, reason) => {
    log("WARN", `Music node disconnected ⚠️ | ${node.host}:${node.port} | code: ${code} ${reason || ""}`);
  });

  client.manager.on("nodeError", (node, error) => {
    log("ERROR", `Music node error ❌ | ${error.message}`);
  });

  // Track playback events
  client.manager.on("trackStart", async (player, track) => {
    cancelPendingDisconnect(player.guildId);

    const channel = client.channels.cache.get(player.textChannelId);
    const voice = client.channels.cache.get(player.voiceChannelId);
    const guildId = player.guildId;
    const requesterInfo = track.requester || track.userData?.requester || "Autoplay";
    const status = `${track.title} - ${track.author}`;

    await messageCleanup.removePreviousMessages(client, guildId, "trackStart");

    const thumbnail = track.thumbnail || client.user.displayAvatarURL({ dynamic: true });

    const trackEmbed = embedCreator.buildTrackEmbed(track, requesterInfo, thumbnail);
    const [firstRow, secondRow, thirdRow, fourthRow] = controlsBuilder.createButtonRows(false);

    const playerMessage = await messageManager.sendPlayerMessage(channel, trackEmbed, [
      firstRow,
      secondRow,
      thirdRow,
      fourthRow,
    ]);

    if (playerMessage) {
      await databaseManager.storeTrackMessage(guildId, playerMessage.id, channel.id);
      playerControls.setupMessageCollector(client, player, channel, playerMessage);

      await vcStatus
        .setVoiceStatus(voice.id, status)
        .then(() => log("SUCCESS", `Voice channel status updated: ${status}`))
        .catch((err) => log("ERROR", `Failed to update voice status: ${err.message}`));
    }
  });

  client.manager.on("trackEnd", async (player) => {
    await messageCleanup.removePreviousMessages(client, player.guildId, "trackEnd");
  });

  client.manager.on("playerDisconnected", (player) => {
    // Don't tear down immediately — wait and verify the node still has us playing
    if (pendingDisconnects.has(player.guildId)) return;
    pendingDisconnects.set(
      player.guildId,
      setTimeout(async () => {
        pendingDisconnects.delete(player.guildId);
        try {
          if (player.destroyed) return; // playerDestroy cleanup already ran
          if (player.current && player.playing) {
            log("DEBUG", `Ignoring spurious playerDisconnected for guild ${player.guildId} — track still active.`);
            return;
          }
          await messageCleanup.removePreviousMessages(client, player.guildId, "playerDisconnected");
          const voice = client.channels.cache.get(player.voiceChannelId);
          if (voice) {
            await vcStatus
              .setVoiceStatus(voice.id, "Enjoy your music!")
              .catch((err) => log("ERROR", `Failed to update voice status: ${err.message}`));
          }
        } catch (error) {
          log("ERROR", `playerDisconnected cleanup error: ${error.message}`);
        }
      }, 10000)
    );
  });

  client.manager.on("playerConnected", (player) => {
    cancelPendingDisconnect(player.guildId);
  });

  // Cleanup pinned messages + voice status after destroy (/stop, queue end)
  client.manager.on("playerDestroy", async (player) => {
    if (player?.guildId) {
      cancelPendingDisconnect(player.guildId);
      await messageCleanup.removePreviousMessages(client, player.guildId, "playerDestroy");
    }

    const voice = client.channels.cache.get(player?.voiceChannelId);
    if (voice) {
      await vcStatus
        .setVoiceStatus(voice.id, "Enjoy your music!")
        .catch((err) => log("ERROR", `Failed to update voice status: ${err.message}`));
    }
  });

  client.manager.on("queueEnd", async (player, lastTrack) => {
    const voice = client.channels.cache.get(player.voiceChannelId);
    const status = "Enjoy your music!";

    if (voice) {
      await vcStatus
        .setVoiceStatus(voice.id, status)
        .then(() => log("SUCCESS", `Voice channel status updated: ${status}`))
        .catch((err) => log("ERROR", `Failed to update voice status: ${err.message}`));
    }
    await autoplayHandler.handleQueueEnd(client, player, lastTrack);
  });

  // Rebuild the interactive player UI after restarts or node failures
  // (Moonlink emits playerResumed on bot restart, playerRecoverySuccess on node recovery)
  const restorePlayerUI = async (player) => {
    try {
      cancelPendingDisconnect(player?.guildId);
      const track = player.current;
      if (!track || player.destroyed) return;

      const channel = client.channels.cache.get(player.textChannelId);
      if (!channel) return;

      await messageCleanup.removePreviousMessages(client, player.guildId, "playerRecovery");

      const requesterInfo = track.requester || track.userData?.requester || "Autoplay";
      const thumbnail = track.thumbnail || client.user.displayAvatarURL({ dynamic: true });

      const trackEmbed = embedCreator.buildTrackEmbed(track, requesterInfo, thumbnail);
      const [firstRow, secondRow, thirdRow, fourthRow] = controlsBuilder.createButtonRows(false);

      const playerMessage = await messageManager.sendPlayerMessage(channel, trackEmbed, [
        firstRow,
        secondRow,
        thirdRow,
        fourthRow,
      ]);

      if (playerMessage) {
        await databaseManager.storeTrackMessage(player.guildId, playerMessage.id, channel.id);
        playerControls.setupMessageCollector(client, player, channel, playerMessage);
      }
    } catch (error) {
      log("ERROR", `Failed to restore player UI: ${error.message}`);
    }
  };

  client.manager.on("playerResumed", restorePlayerUI);
  client.manager.on("playerRecoverySuccess", restorePlayerUI);
}

module.exports = { initializePlayer };
