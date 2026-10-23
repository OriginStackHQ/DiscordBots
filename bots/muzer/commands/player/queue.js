const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const icons = require("../../icons");
const { createQueuePagination } = require("../../helper/pagination");

module.exports = {
  data: new SlashCommandBuilder().setName("queue").setDescription("Show the current song queue"),

  async execute(interaction) {
    const client = interaction.client;

    const player = client.manager.players.get(interaction.guildId);

    if (!player || (player.queue.size === 0)) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({
          name: "The queue is empty",
          iconURL: icons.headerIcon,
        })
        .setDescription("There are no songs currently in the queue.")
        .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

      await interaction.reply({
        embeds: [embed],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await createQueuePagination(interaction, player);
  },
};
