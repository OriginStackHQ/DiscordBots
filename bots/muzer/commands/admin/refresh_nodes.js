const { SlashCommandBuilder, EmbedBuilder, MessageFlags, PermissionFlagsBits } = require("discord.js");
const icons = require("../../icons");
const config = require("../../config");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("refresh_nodes")
    .setDescription("Refresh Lavalink nodes")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const nodes = config.nodes.map((nodeConfig) => ({
      identifier: `${nodeConfig.host}:${nodeConfig.port}`,
      host: nodeConfig.host,
      port: nodeConfig.port,
      password: nodeConfig.password,
      secure: nodeConfig.secure,
      retryDelay: 5000,
      retryAmount: 10,
    }));

    const nodeInstances = interaction.client.manager.nodes;

    for (const node of nodes) {
      // Moonlink throws when adding a duplicate identifier — remove the
      // existing connection first so each configured node is re-added fresh.
      nodeInstances.remove(node.identifier);
      nodeInstances.add(node);
    }

    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setAuthor({
        name: "Nodes Refreshed",
        iconURL: icons.headerIcon,
      })
      .setDescription("All Lavalink nodes have been refreshed.")
      .setFooter({ text: "Enjoy your music", iconURL: icons.footerIcon })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
  permissions: PermissionFlagsBits.ManageGuild,
};
