const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const icons = require("../../icons");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("remove")
    .setDescription("Remove a song from the queue by its position")
    .addIntegerOption((option) =>
      option.setName("position").setDescription("Position of the song to remove from the queue").setRequired(true),
    ),

  async execute(interaction) {
    const client = interaction.client;

    const position = interaction.options.getInteger("position");
    const player = client.manager.players.get(interaction.guildId);

    if (!player || !player.queue || player.queue.size === 0) {
      const emptyQueueEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "Queue is empty",
          iconURL: icons.headerIcon,
        })
        .setDescription("There are no songs in the queue to remove.")
        .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

      await interaction.reply({
        embeds: [emptyQueueEmbed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (position < 1 || position > player.queue.size) {
      const invalidPositionEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "Invalid position",
          iconURL: icons.headerIcon,
        })
        .setDescription(`Please provide a valid position between 1 and ${player.queue.size}.`)
        .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

      await interaction.reply({
        embeds: [invalidPositionEmbed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const removedTrack = player.queue.remove(position - 1);

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setAuthor({
        name: "Song removed",
        iconURL: icons.headerIcon,
      })
      .setDescription(`Removed **${removedTrack.title}** from the queue.`)
      .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
