const { GoogleGenerativeAI } = require("@google/generative-ai");
const { systemPrompt } = require("../prompts/farmer-assistant.prompt");

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.7,
      },
    });
  }

  // =========================
  // Parse JSON from Gemini response
  // =========================
  async parseJSONResponse(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      return {};
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return {};
    }
  }

  // =========================
  // Analyze text message
  // =========================
  async analyzeTextMessage(message, context = {}) {
    try {
      const userContext = context.userLocation
        ? `Farmer is located in ${context.userLocation}.`
        : "";

      const chatContext = context.chatHistory
        ? `Previous conversation:\n${context.chatHistory
            .slice(-5)
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n")}`
        : "";

      const prompt = `
${systemPrompt}

${userContext}
${chatContext}

IMPORTANT: Respond ONLY with valid JSON:
{
  "response": "string",
  "metadata": {},
  "suggestedActions": []
}

Farmer message:
${message}
`;

      const result = await this.model.generateContent(prompt);
      const content = result.response.text();

      const parsed = await this.parseJSONResponse(content);

      return {
        response: parsed.response || content,
        metadata: parsed.metadata || {},
        suggestedActions: parsed.suggestedActions || [],
      };
    } catch (error) {
      console.error("Gemini Text Analysis Error:", error);
      throw new Error("Failed to analyze text message.");
    }
  }

  // =========================
  // Analyze image
  // =========================
  async analyzeImage(base64Image) {
    try {
      const prompt = `
You are an expert farmer and agricultural scientist.

IMPORTANT: Respond ONLY with valid JSON:
{
  "analysis": "string",
  "cropName": "string or null",
  "healthStatus": "healthy|stressed|diseased|unknown",
  "confidence": number,
  "issues": [],
  "recommendations": [],
  "story": "optional"
}
`;

      const result = await this.model.generateContent({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: "image/jpeg",
                },
              },
            ],
          },
        ],
      });

      const content = result.response.text();
      const parsed = await this.parseJSONResponse(content);

      return {
        analysis: parsed.analysis || content,
        cropName: parsed.cropName || null,
        healthStatus: parsed.healthStatus || "unknown",
        confidence: parsed.confidence || 0,
        issues: parsed.issues || [],
        recommendations: parsed.recommendations || [],
        story: parsed.story || "",
      };
    } catch (error) {
      console.error("Gemini Image Analysis Error:", error);
      throw new Error("Failed to analyze image.");
    }
  }

  // =========================
  // Analyze document
  // =========================
  async analyzeDocument(textContent, fileType) {
    try {
      const prompt = `
You are an experienced farmer.

IMPORTANT: Respond ONLY with valid JSON:
{
  "summary": "string",
  "implications": "string",
  "recommendations": [],
  "warnings": []
}

Document type: ${fileType}
Content:
${textContent}
`;

      const result = await this.model.generateContent(prompt);
      const content = result.response.text();
      const parsed = await this.parseJSONResponse(content);

      return parsed;
    } catch (error) {
      console.error("Gemini Document Analysis Error:", error);
      throw new Error("Failed to analyze document.");
    }
  }

  // =========================
  // Generate planting schedule
  // =========================
  async generatePlantingSchedule(crop, location, season) {
    try {
      const prompt = `
You are an expert agricultural planner.

IMPORTANT: Respond ONLY with valid JSON:
{
  "bestPlantingDates": [],
  "soilPreparation": "string",
  "spacing": "string",
  "depth": "string",
  "watering": "string",
  "fertilization": "string",
  "pestManagement": "string",
  "expectedHarvestDates": []
}

Crop: ${crop}
Location: ${location}
Season: ${season}
`;

      const result = await this.model.generateContent(prompt);
      const content = result.response.text();

      return await this.parseJSONResponse(content);
    } catch (error) {
      console.error("Gemini Planting Schedule Error:", error);
      throw new Error("Failed to generate planting schedule.");
    }
  }
}

module.exports = new GeminiService();
