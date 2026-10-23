const axios = require("axios");
const { decode } = require("html-entities");
const { log } = require("../utils/common");
const config = require("../config");

const formatHtmlToPrompt = (htmlString) => {
  const cleaned = htmlString
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .trim();

  return decode(cleaned);
};

const leetCodeDaily = async () => {
  try {
    const body = {
      query: `
        query questionOfToday {
            activeDailyCodingChallengeQuestion {
                date
                link
                question {
                    questionId
                    questionFrontendId
                    title
                    titleSlug
                    difficulty
                    topicTags { name }
                    content
                }
            }
        }
      `,
    };
    const response = await axios.post(`https://leetcode.com/graphql`, body);
    const data = response.data?.data;

    if (!data.activeDailyCodingChallengeQuestion) {
      throw new Error("No active daily coding challenge question found.");
    }

    return {
      id: data.activeDailyCodingChallengeQuestion.question.questionId,
      frontendId: data.activeDailyCodingChallengeQuestion.question.questionFrontendId,
      date: data.activeDailyCodingChallengeQuestion.date,
      title: data.activeDailyCodingChallengeQuestion.question.title,
      link: `https://leetcode.com${data.activeDailyCodingChallengeQuestion.link}`,
      titleSlug: data.activeDailyCodingChallengeQuestion.question.titleSlug,
      difficulty: data.activeDailyCodingChallengeQuestion.question.difficulty,
      topicTags: data.activeDailyCodingChallengeQuestion.question.topicTags.map((tag) => tag.name),
      content: formatHtmlToPrompt(data.activeDailyCodingChallengeQuestion.question.content),
    };
  } catch (error) {
    console.error("Error fetching website info:", error);
    throw new Error("Failed to fetch website info.");
  }
};

const solveLeetCode = async (titleSlug) => {
  try {
    const body = {
      query: `
            query questionData($titleSlug: String!) {
                question(titleSlug: $titleSlug) { 
                    questionId
                    questionFrontendId
                    title
                    titleSlug
                    difficulty
                    topicTags { name }
                    content
                    codeSnippets {
                        lang
                        langSlug
                        code
                    }
                }
            }
        `,
      variables: { titleSlug: titleSlug },
    };
    const response = await axios.post(`https://leetcode.com/graphql`, body);
    const data = response.data?.data;

    if (!data.question) {
      throw new Error("LeetCode problem not found.");
    }

    const systemPrompt = `You are an expert competitive programmer and software engineer.
    The user will provide:
    - A LeetCode problem description.
    - Base code templates in C++, Java, and Python.

    Your task is to:
    1. Read and understand the problem carefully.
    2. Implement a correct and efficient solution for the problem.
    3. Use the provided base code for each language.
    4. Return **three complete solutions**, one in each of the following languages:
    - **C++**
    - **Java**
    - **Python**

    **Requirements:**
    - Only modify inside the appropriate method or class provided in the base code.
    - Keep the function/class names and method signatures exactly as given.
    - Follow idiomatic practices for each language.
    - Ensure the logic is correct and optimized.
    - Do not add explanation unless specifically requested.

    Respond only with code blocks for each language, clearly labeled.`;

    const prompt = `LeetCode problem:\n${formatHtmlToPrompt(data.question.content)}\n\nBase code templates for each language:\n**C++:**\n${formatHtmlToPrompt(data.question.codeSnippets[0].code)}\n\n**Java:**\n${formatHtmlToPrompt(data.question.codeSnippets[1].code)}\n\n**Python:**\n${formatHtmlToPrompt(data.question.codeSnippets[2].code)}`;

    const solution = await aiResponse(systemPrompt, prompt);

    if (!solution) {
      throw new Error("Failed to solve LeetCode question");
    }

    // Extract the JSON object robustly (some models wrap it in code fences)
    const jsonStart = solution.indexOf("{");
    const jsonEnd = solution.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("Failed to parse AI solution: no JSON found");
    }
    const parsedSolution = JSON.parse(solution.slice(jsonStart, jsonEnd + 1));

    // Normalize the AI output to { cpp, java, python } with string code values.
    // Models may use display-name keys ("C++"), wrapper objects ({ code }) or
    // a nesting level around the whole response depending on the run.
    const normalizeSolution = (raw) => {
      const keyFor = (name) => {
        const s = name.toLowerCase();
        if (s.includes("c++") || s.includes("cpp") || s.includes("c_plus") || s.includes("cplus")) return "cpp";
        if (s.includes("python") || s.includes("py")) return "python";
        if (s.includes("java")) return "java";
        return null;
      };

      const normalized = {};
      const forEachEntry = (entry) => {
        for (const [key, value] of Object.entries(entry)) {
          const target = keyFor(key);

          if (target) {
            if (typeof value === "string" && !normalized[target]) {
              normalized[target] = value;
            } else if (value && typeof value === "object") {
              // Language key mapped to an object - accept { code } wrappers
              // or a nested { cpp, java, python } group.
              if (typeof value.code === "string" && !normalized[target]) {
                normalized[target] = value.code;
              } else if (typeof value.code === "object" || typeof value === "object") {
                forEachEntry(value);
              }
            } else if (value && typeof value === "object" && !Array.isArray(value)) {
              forEachEntry(value);
            }
            continue;
          }

          // Unknown key name at this level - recurse into plain objects,
          // this covers wrapper objects around the whole solution.
          if (value && typeof value === "object" && !Array.isArray(value)) {
            forEachEntry(value);
          }
        }
      };

      forEachEntry(raw && typeof raw === "object" ? raw : {});
      return normalized;
    };

    const normalizedSolution = normalizeSolution(parsedSolution);
    if (!normalizedSolution.cpp && !normalizedSolution.java && !normalizedSolution.python) {
      throw new Error("AI returned no recognizable solutions");
    }

    return {
      id: data.question.questionId,
      frontendId: data.question.questionFrontendId,
      title: data.question.title,
      link: `https://leetcode.com/problems/${data.question.titleSlug}`,
      titleSlug: data.question.titleSlug,
      difficulty: data.question.difficulty,
      topicTags: data.question.topicTags.map((tag) => tag.name),
      content: formatHtmlToPrompt(data.question.content),
      solution: normalizedSolution,
    };
  } catch (error) {
    console.error("Error solving LeetCode question:", error);
    throw new Error(error.message || "Failed to solve LeetCode question");
  }
};

const aiResponse = async (systemPrompt, prompt) => {
  try {
    const response = await axios.post(
      `${config.openAiBaseUrl}/chat/completions`,
      {
        model: config.openAiModel,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: { type: "json_object" },
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
      log("INFO", `User message replied successfully.`);
      return response.data.choices[0].message.content.trim();
    }

    throw new Error("Unable to fetch AI response. Please try again.");
  } catch (error) {
    console.error("Error fetching AI response:", error);
    throw new Error("Failed to fetch AI response.");
  }
};

module.exports = { leetCodeDaily, solveLeetCode, aiResponse };
