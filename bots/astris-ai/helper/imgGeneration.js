const axios = require("axios");
const config = require("../config");
const { log, getErrorMessage } = require("../utils/common");

const FLUX_MODEL = "@cf/black-forest-labs/flux-1-schnell";

const generateImage = async (prompt, steps = 8) => {
  const url = `${config.cloudflareApiUrl}/client/v4/accounts/${config.cloudflareAccountId}/ai/run/${FLUX_MODEL}`;

  const data = {
    prompt,
    steps: Math.min(Math.max(steps, 1), 8),
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${config.cloudflareApiToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response?.data?.success || !response?.data?.result?.image) {
      const apiError = JSON.stringify(response?.data?.errors);
      throw new Error(apiError || "Invalid response from Cloudflare Workers AI");
    }

    log("INFO", `Generated image with ${FLUX_MODEL} for prompt: ${prompt}`);
    return response.data.result.image;
  } catch (error) {
    const apiError = error?.response?.data?.errors?.map((e) => e.message).join("; ");
    log("ERROR", `Image Generation Error: ${apiError || getErrorMessage(error)}`);
    throw new Error("Failed to generate image. Please try again.");
  }
};

module.exports = { generateImage };
