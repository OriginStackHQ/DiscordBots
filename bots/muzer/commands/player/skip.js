const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require("discord.js");
const icons = require("../../icons");

module.exports = {
  data: new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),

  async execute(interaction) {
    const client = interaction.client;

    const player = client.manager.players.get(interaction.guildId);

    if (!player) {
      const embed = new EmbedBuilder()
        .setColor("#ff0000")
        .setAuthor({ name: "No active player", iconURL: icons.headerIcon })
        .setDescription("There is no music playing to skip.")
        .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

      return await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }

    // Moonlink: `skip()` plays the next queued track, while `stop()` just
    // halts playback. When nothing is left in the queue the player is
    // stopped and destroyed to keep the old session behavior.
    const hadQueuedTracks = player.queue.size > 0;
    await player.skip();

    if (!hadQueuedTracks) {
      await player.destroy("Skip with empty queue");
    }

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setAuthor({ name: "Song Skipped", iconURL: icons.headerIcon })
      .setDescription("The current song has been skipped.")
      .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon });

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
