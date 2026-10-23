const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const { getCollection } = require("../../mongodb");
const icons = require("../../icons");
const { log } = require("../../utils/common");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("playlist_play")
    .setDescription("Play a custom playlist")
    .addStringOption((option) => option.setName("name").setDescription("Enter playlist name").setRequired(true)),

  async execute(interaction) {
    const client = interaction.client;
    const playlistName = interaction.options.getString("name");
    const userId = interaction.user.id;

    // Acknowledge instantly — voice joins and many song searches take > 3s
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

    const playlist = await getCollection("playlists").findOne({ name: playlistName });

    if (!playlist) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "Error",
          iconURL: icons.headerIcon,
        })
        .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon })
        .setDescription("Playlist not found.");

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (playlist.isPrivate && playlist.userId !== userId) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "Access Denied",
          iconURL: icons.headerIcon,
        })
        .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon })
        .setDescription("You do not have permission to play this private playlist.");

      await interaction.editReply({ embeds: [embed], flags: MessageFlags.Ephemeral });
      return;
    }

    if (!playlist.songs.length) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "Error",
          iconURL: icons.headerIcon,
        })
        .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon })
        .setDescription("The playlist is empty.");

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
      // Voice joins in the background, keep the command fast
      player.connect({ selfDeaf: true }).catch((err) => {
        log("ERROR", `Voice connection failed: ${err.message}`);
      });
    }

    for (const song of playlist.songs) {
      const query = song.url || song.name;
      const result = await client.manager.search({
        query,
        requester: interaction.user.username,
      });

      if (!result || typeof result !== "object") {
        throw new TypeError("Search response is not an object");
      }

      const { loadType, tracks } = result;
      if (loadType === "track" || loadType === "search") {
        const track = result.tracks[0];
        if (track) {
          track.requester = interaction.user.username;
          player.queue.add(track);
        }
      } else {
        const errorEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setAuthor({
            name: "Error",
            iconURL: icons.headerIcon,
          })
          .setDescription("Failed to resolve one or more songs in the playlist.")
          .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

        await interaction.followUp({ embeds: [errorEmbed] });
        return;
      }
    }

    if (!player.playing && !player.paused) await player.play();

    const embed = new EmbedBuilder()
      .setColor("#fe8a7a")
      .setAuthor({
        name: "Playing Custom Playlist",
        iconURL: icons.headerIcon,
      })
      .setDescription(`Now playing **${playlistName}** playlist. \n Check <#${config.channelId}> for updates.`)
      .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

    await interaction.followUp({ embeds: [embed] });
  },
};
