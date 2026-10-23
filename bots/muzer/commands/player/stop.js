const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const icons = require("../../icons");

module.exports = {
  data: new SlashCommandBuilder().setName("stop").setDescription("Stop the current song and destroy the player"),

  async execute(interaction) {
    const client = interaction.client;

    const player = client.manager.players.get(interaction.guildId);

    if (!player) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({ name: "No active player", iconURL: icons.headerIcon })
        .setDescription("There is no music currently playing.")
        .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    await player.destroy("Stop command");

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setAuthor({ name: "Music Stopped", iconURL: icons.headerIcon })
      .setDescription("Playback has been stopped and the player has been destroyed.")
      .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
