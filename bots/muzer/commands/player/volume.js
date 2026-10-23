const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const icons = require("../../icons");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("volume")
    .setDescription("Set the volume (0-100)")
    .addIntegerOption((option) =>
      option.setName("level").setDescription("Volume level").setRequired(true).setMinValue(0).setMaxValue(100),
    ),

  async execute(interaction) {
    const client = interaction.client;
    const volume = interaction.options.getInteger("level");

    const player = client.manager.players.get(interaction.guildId);

    if (!player) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({ name: "No active player", iconURL: icons.headerIcon })
        .setDescription("There is no music currently playing.")
        .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    player.setVolume(volume);

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setAuthor({ name: "Volume Updated", iconURL: icons.headerIcon })
      .setDescription(`The volume is now set to **${volume}%**.`)
      .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
