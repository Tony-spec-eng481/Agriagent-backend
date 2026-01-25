const OpenAI = require("openai");
const { systemPrompt } = require("../prompts/farmer-assistant.prompt");

class OpenAIService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.model = "gpt-4o-mini";
    this.maxTokens = 2000;
    this.temperature = 0.7;
  }

  // =========================
  // Analyze text message from farmer
  // =========================
  async analyzeTextMessage(message, context = {}) {
    try {
      const userContext = context.userLocation
        ? `Farmer is located in ${context.userLocation}.`
        : "";

      const chatContext = context.chatHistory
        ? `Previous conversation context:\n${context.chatHistory
            .slice(-5)
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n")}`
        : "";

      const systemContent = `${systemPrompt}

${userContext}
${chatContext}

Respond as a friendly, experienced farmer mentor. Provide actionable advice and farming anecdotes where appropriate. Return a JSON object with:
- response: string
- metadata: object (optional farming analysis, stories, or recommendations)`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: message },
        ],
        max_completion_tokens: this.maxTokens,
        temperature: this.temperature,
      });

     const content = response.choices[0]?.message?.content || "";

     let parsed = { response: content, metadata: {} };

     try {
       parsed = JSON.parse(content);
     } catch (err) {
       // If content is very short (like "Hello!"), just use it as response
       if (content.trim().length > 0) {
         parsed.response = content.trim();
         parsed.metadata = {};
       } else {
         parsed.response = "Farmer Joe didn't respond";
       }
     }


     // Ensure response is never empty
     return {
       response: parsed.response || content || "Farmer Joe didn't respond",
       metadata: parsed.metadata || {},
     };

    } catch (error) {
      console.error("OpenAI Text Analysis Error:", error);
      throw new Error("Failed to analyze text message.");
    }
  }

  // =========================
  // Analyze image for crops, pests, etc.
  // =========================
  async analyzeImage(base64Image, context = {}) {
    try {
      // Build prompt
      const systemContent = `You are an expert farmer and agricultural scientist.
Analyze the following image. Provide:
1. Crop identification
2. Health assessment (healthy, stressed, diseased, unknown)
3. Issues (pests, diseases, nutrient deficiencies)
4. Recommendations
5. Optional short farming story

Return a JSON object with fields:
- analysis: string
- cropName: string or null
- healthStatus: "healthy" | "stressed" | "diseased" | "unknown"
- confidence: number (0-100)
- issues: array of {type, description, severity, recommendation}
- recommendations: array of strings
- story: optional string`;

      // Use base64 directly in text content
      const userContent = `Analyze this image (base64 encoded):
data:image/jpeg;base64,${base64Image}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 1500,
        temperature: this.temperature,
      });

      const content = response.choices[0]?.message?.content || "";

      try {
        const parsed = JSON.parse(content);
        return parsed;
      } catch (e) {
        // fallback
        return {
          analysis: content || "No analysis available",
          cropName: null,
          healthStatus: "unknown",
          confidence: 0,
          issues: [],
          recommendations: [],
        };
      }
    } catch (error) {
      console.error("OpenAI Image Analysis Error:", error);
      throw new Error("Failed to analyze image.");
    }
  }

  // =========================
  // Analyze document (soil reports, CSVs, PDFs)
  // =========================
  async analyzeDocument(textContent, fileType) {
    try {
      const systemContent = `You are an experienced farmer who can interpret agricultural documents.
Analyze the content below and provide practical insights.
Return a JSON object with fields:
- summary: string (key findings)
- implications: string (practical farming implications)
- recommendations: array of strings
- warnings: array of strings (optional)`;

      const userContent = `Document type: ${fileType}\nContent:\n${textContent}`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 1500,
        temperature: this.temperature,
      });

      const content = response.choices[0]?.message?.content || "";

      try {
        const parsed = JSON.parse(content);
        return parsed;
      } catch (e) {
        return {
          summary: content || "No summary available",
          implications: "",
          recommendations: [],
          warnings: [],
        };
      }
    } catch (error) {
      console.error("OpenAI Document Analysis Error:", error);
      throw new Error("Failed to analyze document.");
    }
  }

  // =========================
  // Generate planting schedule
  // =========================
  async generatePlantingSchedule(crop, location, season) {
    try {
      const systemContent =
        "You are an expert in agricultural planning and crop cycles. Provide a JSON output with fields: bestPlantingDates, soilPreparation, spacing, depth, watering, fertilization, pestManagement, expectedHarvestDates.";

      const userContent = `Generate a detailed planting schedule for ${crop} in ${location} during ${season}.`;

      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
        ],
        max_completion_tokens: 1000,
        temperature: this.temperature,
      });

      const content = response.choices[0]?.message?.content || "";

      try {
        return JSON.parse(content);
      } catch (e) {
        return { error: "Failed to generate planting schedule", raw: content };
      }
    } catch (error) {
      console.error("OpenAI Planting Schedule Error:", error);
      throw new Error("Failed to generate planting schedule.");
    }
  }
}

module.exports = new OpenAIService();
