const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const icons = require("../../icons");

module.exports = {
  data: new SlashCommandBuilder().setName("pause").setDescription("Pause the current song"),

  async execute(interaction) {
    const client = interaction.client;

    const player = client.manager.players.get(interaction.guildId);

    if (!player) {
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
        .setDescription("- No active player found.");

      await interaction.reply({
        embeds: [errorEmbed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await player.pause();

    const embed = new EmbedBuilder()
      .setColor("#fe8a7a")
      .setAuthor({
        name: "Paused!",
        iconURL: icons.headerIcon,
      })
      .setFooter({
        text: "Enjoy your music",
        iconURL: icons.footerIcon,
      })
      .setDescription("**- Player has been paused!**");

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
