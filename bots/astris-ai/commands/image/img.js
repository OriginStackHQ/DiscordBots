const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { generateImage } = require("../../helper/imgGeneration");
const { CHANNELS } = require("../../constants");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("img")
    .setDescription("Image Generation using Cloudflare FLUX.1")
    .addStringOption((option) =>
      option.setName("prompt").setDescription("Prompt for image generation").setRequired(true),
    )
    .addNumberOption((option) =>
      option
        .setName("steps")
        .setDescription("Number of generation steps (1-8, default 4)")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(8),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const prompt = interaction.options.getString("prompt") || "A random image";
    const steps = interaction.options.getNumber("steps") || 4;
    const userTag = interaction.user.tag;

    const base64Image = await generateImage(prompt, steps);

    const attachment = new AttachmentBuilder(Buffer.from(base64Image, "base64")).setName("image.png");

    await interaction.editReply({
      content: `**Prompt**\n*${prompt}*\n**Requester**\n*@${userTag}*`,
      files: [attachment],
    });
  },
  requiresSpecificChannel: CHANNELS.img_generation.dbField,
};
