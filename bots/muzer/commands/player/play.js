const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const icons = require("../../icons");
const { getCollection } = require("../../mongodb");
const { log } = require("../../utils/common");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("play")
    .setDescription("Play a song from a name or link")
    .addStringOption((option) =>
      option.setName("name").setDescription("Enter song name / link or playlist").setRequired(true),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const query = interaction.options.getString("name");

    // Acknowledge instantly — voice handshakes and searches can exceed 3s
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const config = await getCollection("guildConfigs").findOne({ guildId: interaction.guild.id });

    if (!config || !config.channelId) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "Error",
          iconURL: icons.headerIcon,
        })
        .setFooter({
          text: "Enjoy your music",
          iconURL: icons.footerIcon,
        })
        .setDescription("Music channel is not set. Please contact moderator.");

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (!interaction.member.voice.channelId || interaction.member.voice.channelId !== config.channelId) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "Error",
          iconURL: icons.headerIcon,
        })
        .setFooter({
          text: "Enjoy your music",
          iconURL: icons.footerIcon,
        })
        .setDescription(`You must be in <#${config.channelId}> voice channel to use this command.`);

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (!client.manager.nodes?.hasOnlineNodes) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "Error",
          iconURL: icons.headerIcon,
        })
        .setFooter({
          text: "Enjoy your music",
          iconURL: icons.footerIcon,
        })
        .setDescription("No audio nodes (NodeLink/Lavalink) are available.");

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    let player = client.manager.players.get(interaction.guildId);

    if (!player) {
      player = client.manager.players.create({
        guildId: interaction.guildId,
        voiceChannelId: config.channelId,
        textChannelId: config.channelId,
        volume: 50,
        selfDeaf: true,
      });
    }

    if (!player.connected) {
      // Voice connects in the background — don't block the command on the handshake
      player.connect({ selfDeaf: true }).catch((err) => {
        log("ERROR", `Voice connection failed: ${err.message}`);
      });
    }

    const result = await client.manager.search({
      query,
      requester: interaction.user.username,
    });

    if (!result || typeof result !== "object" || !Array.isArray(result.tracks)) {
      throw new TypeError("Invalid response from Moonlink search.");
    }

    let addedTracks = 0;
    let isPlaylist = false;

    if (result.loadType === "playlist") {
      isPlaylist = true;
      for (const track of result.tracks) {
        track.requester = interaction.user.username;
        player.queue.add(track);
        addedTracks++;
      }
    } else if (result.loadType === "search" || result.loadType === "track") {
      const track = result.tracks[0];
      if (track) {
        track.requester = interaction.user.username;
        player.queue.add(track);
        addedTracks = 1;
      }
    } else {
      const errorEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "Error",
          iconURL: icons.headerIcon,
        })
        .setFooter({
          text: "Enjoy your music",
          iconURL: icons.footerIcon,
        })
        .setDescription("No results found.");

      await interaction.followUp({ embeds: [errorEmbed] });
      return;
    }

    if (!player.playing && !player.paused) {
      await player.play();
    }

    const successEmbed = new EmbedBuilder()
      .setColor("#fe8a7a")
      .setAuthor({
        name: isPlaylist ? "Playlist added to queue!" : "Song added to queue!",
        iconURL: icons.headerIcon,
      })
      .setDescription(`${addedTracks} song${addedTracks !== 1 ? "s" : ""} added to the queue. \n Check <#${config.channelId}> for updates.`)
      .setFooter({
        text: "Enjoy your music",
        iconURL: icons.footerIcon,
      });

    await interaction.followUp({ embeds: [successEmbed] });
  },
};
