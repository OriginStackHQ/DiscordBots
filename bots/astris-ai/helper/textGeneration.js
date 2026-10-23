const axios = require("axios");
const config = require("../config");
const { log } = require("../utils/common");

const chatCompletion = async (messages, model) => {
  const response = await axios.post(
    `${config.openAiBaseUrl}/chat/completions`,
    {
      model: model || config.openAiModel,
      messages,
      max_tokens: 1024,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.openAiApiKey}`,
      },
      timeout: 30000,
    },
  );

  if (response.data?.choices?.[0]?.message?.content) {
    return response.data.choices[0].message.content;
  }

  const apiError = JSON.stringify(response.data);
  throw new Error(apiError || "Invalid response from chat completions API");
};

const summarizeText = async (text) => {
  if (!text || text.trim() === "") {
    throw new Error("No text provided for summarization");
  }

  try {
    const summary = await chatCompletion([
      {
        role: "system",
        content: `You are a highly efficient assistant specializing in summarizing human-to-human group conversations. Your summaries are specifically designed to be concise and fit within platforms with strict character limits, such as Discord.

        Your primary goal is to provide an **extremely concise, 1-2 paragraph summary** that captures the absolute essence of the discussion, focusing solely on critical takeaways.

        When summarizing, ensure you:
        1. Identify and outline the **main topics discussed**.
        2. Pinpoint any **important decisions, questions, or conclusions**.
        3. Briefly describe the **overall tone and purpose** (e.g. informal, technical, planning).
        4. **Ruthlessly exclude filler, greetings, off-topic banter, and minor details** to prioritize critical information.

        Your summary must be original, avoid direct quotes, and accurately reflect the group's interaction. **Keep the summary as short as possible while retaining core meaning, aiming for brevity to fit character constraints.**`,
      },
      {
        role: "user",
        content: `Here is the group chat conversation for summarization:\n\n${text}`,
      },
    ]);

    log("INFO", `Text summarized successfully. Original length: ${text.length}, Summary length: ${summary.length}`);
    return summary.trim();
  } catch (error) {
    log("ERROR", `Error summarizing text: ${getErrorMessage(error)}`);
    throw new Error("Failed to generate summary. Please try again.");
  }
};

const describeImage = async (imageUrl) => {
  const messages = [
    {
      role: "system",
      content: `You are a visual intelligence assistant specialized in understanding and describing images in plain English.

      Your task is to generate a short and accurate description of the visual content in the image, as if explaining it to someone who cannot see it.

      Instructions:
      1. Describe the main objects or scene clearly and concisely.
      2. Avoid over-interpreting or making guesses — focus on what is visually obvious.
      3. Keep the output very short (1-2 sentences), suitable for use in a Discord bot.
      4. Be neutral and descriptive, not poetic or opinionated.`,
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Describe this image",
        },
        {
          type: "image_url",
          image_url: imageUrl,
        },
      ],
    },
  ];

  try {
    const description = await chatCompletion(messages, config.openAiVisionModel);
    log("INFO", "Image described successfully.");
    return description.trim();
  } catch (error) {
    log("ERROR", `Error describing image: ${getErrorMessage(error)}`);
    throw new Error("Failed to generate image description. Please try again.");
  }
};

const replyUserMessage = async (contents) => {
  try {
    // Convert Gemini-style contents ({ role, parts }) to OpenAI-style messages
    // Inline image attachments are dropped because text models cannot process them.
    const messages = [
      {
        role: "system",
        content: `
        You are Astris AI, a friendly, helpful assistant in the OriginStack Community Discord server. Use the following settings each time you generate a reply:

        • Tone & Style
          - Natural and conversational, as if you're another community member 😊
          - Polite and inclusive, reflecting OriginStack values: respect, learning, and inclusion
          - Keep replies under 1000 characters

        • Knowledge & Context
          - You can reference the current date/time via: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
          - Use the last 1-10 messages for context

        • Behavior & Scope
          - Never answer coding/programming questions. Instead, suggest they post in the appropriate channel #developers
          - Don't introduce yourself or claim opinions—stay neutral and factual
          - If you're unsure, recommend asking a moderator or another member

        Stay helpful, welcoming, and avoid sounding robotic or scripted.`,
      },
      ...contents.map((entry) => {
        const texts = (entry.parts || [])
          .filter((part) => typeof part.text === "string")
          .map((part) => part.text);

        const hasImage = (entry.parts || []).some((part) => part.inlineData);
        if (hasImage) {
          texts.push("(user attached an image)");
        }

        return {
          role: entry.role === "model" ? "assistant" : "user",
          content: texts.join("\n"),
        };
      }),
    ];

    const aiResponse = await chatCompletion(messages);

    log("INFO", "User message replied successfully.");
    return aiResponse.trim();
  } catch (error) {
    log("ERROR", `Error replying user: ${getErrorMessage(error)}`);
    return "Sorry, I couldn't process your message at the moment. Please try again later.";
  }
};

const getErrorMessage = (error) => {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.response?.data ||
    error?.message ||
    "Unknown error"
  );
};

module.exports = { summarizeText, describeImage, replyUserMessage };
