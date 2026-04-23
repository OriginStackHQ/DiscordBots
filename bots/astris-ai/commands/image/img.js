const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const { generateGoogleFxImage } = require("../../helper/imgGeneration");
const { CHANNELS } = require("../../constants");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("img")
    .setDescription("Image Generation using Google Image Fx")
    .addStringOption((option) =>
      option.setName("prompt").setDescription("Prompt for image generation").setRequired(true),
    )
    .addStringOption((option) =>
      option
        .setName("aspect-ratio")
        .setDescription("Aspect ratio for the generated images")
        .setRequired(false)
        .addChoices(
          { name: "Square", value: "IMAGE_ASPECT_RATIO_SQUARE" },
          { name: "Portrait (16:9)", value: "IMAGE_ASPECT_RATIO_PORTRAIT" },
          { name: "Landscape (9:16)", value: "IMAGE_ASPECT_RATIO_LANDSCAPE" },
          // { name: "Landscape (4:3)", value: "IMAGE_ASPECT_RATIO_LANDSCAPE_FOUR_THREE" },
          // { name: "Portrait (3:4)", value: "IMAGE_ASPECT_RATIO_PORTRAIT_THREE_FOUR" },
        ),
    )
    .addNumberOption((option) =>
      option
        .setName("image-count")
        .setDescription("Number of images to generate")
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(4),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const prompt = interaction.options.getString("prompt") || "A random image";
    const aspectRatio = interaction.options.getString("aspect-ratio");
    const imageCount = interaction.options.getNumber("image-count");
    const userTag = interaction.user.tag;

    const generatedImageBuffers = await generateGoogleFxImage(prompt, imageCount, aspectRatio);

    const attachments = generatedImageBuffers.map((base64Data, i) => {
      const buffer = Buffer.from(base64Data, "base64");
      return new AttachmentBuilder(buffer).setName(`image${i + 1}.jpg`);
    });

    await interaction.editReply({
      content: `**Prompt**\n*${prompt}*\n**Requester**\n*@${userTag}*`,
      files: attachments,
    });
  },
  requiresSpecificChannel: CHANNELS.img_generation.dbField,
};
