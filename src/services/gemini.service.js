const { GoogleGenerativeAI } = require("@google/generative-ai");
const { systemPrompt } = require("../prompts/farmer-assistant.prompt");

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
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

  // Helper method to check available models
  async checkModels() {
    try {
      const models = await this.genAI.listModels();
      console.log("Available models:", models);
      return models;
    } catch (error) {
      console.error("Error checking models:", error);
      return [];
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
        response: parsed.response || content || "No response generated",
        metadata: parsed.metadata || {},
        suggestedActions: parsed.suggestedActions || [],
      };
    } catch (error) {
      console.error("Gemini Text Analysis Error:", error);
      throw new Error("Failed to analyze text message.");
    }
  }

  // Strip data URL prefix if present (e.g. data:image/jpeg;base64,xxxx)
  _stripBase64DataUrl(input) {
    if (typeof input !== "string") return input;
    const match = input.match(/^data:([^;]+);base64,(.+)$/);
    return match ? match[2] : input;
  }

  _mimeFromFileType(fileType) {
    const m = (fileType || "").toLowerCase();
    if (m.includes("png")) return "image/png";
    if (m.includes("webp")) return "image/webp";
    if (m.includes("gif")) return "image/gif";
    if (m.includes("pdf")) return "application/pdf";
    if (m.includes("jpeg") || m.includes("jpg")) return "image/jpeg";
    return "image/jpeg";
  }

  // =========================
  // Analyze image
  // =========================
  async analyzeImage(base64Image, options = {}) {
    try {
      const rawBase64 = this._stripBase64DataUrl(base64Image);
      const mimeType = options.mimeType || this._mimeFromFileType(options.fileType) || "image/jpeg";

      const prompt = `You are an expert farmer and agricultural scientist. Analyze this image (crop, plant, soil, or farm-related).

IMPORTANT: Respond ONLY with valid JSON:
{
  "analysis": "string",
  "cropName": "string or null",
  "healthStatus": "healthy|stressed|diseased|unknown",
  "confidence": number,
  "issues": [],
  "recommendations": [],
  "story": "optional"
}`;

      const result = await this.model.generateContent([
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: rawBase64,
                mimeType,
              },
            },
          ],
        },
      ]);

      const content = result.response.text();
      const parsed = await this.parseJSONResponse(content);

      return {
        analysis: parsed.analysis || content || "No analysis available",
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
  // Analyze document (supports base64 PDF, images, or text)
  // =========================
  async analyzeDocument(fileBase64, fileType, fileName = "") {
    try {
      const rawBase64 = this._stripBase64DataUrl(fileBase64);
      const mime = (fileType || "").toLowerCase();
      const isPdf = mime.includes("pdf");
      const isImage = mime.includes("image") || mime.includes("png") || mime.includes("jpeg") || mime.includes("jpg") || mime.includes("webp") || mime.includes("gif");

      if (isPdf || isImage) {
        const mimeType = isPdf ? "application/pdf" : this._mimeFromFileType(fileType);
        const prompt = `You are an experienced farmer. Analyze this document/image (${fileName || fileType}).

IMPORTANT: Respond ONLY with valid JSON:
{
  "summary": "string",
  "implications": "string",
  "recommendations": [],
  "warnings": []
}`;

        const result = await this.model.generateContent([
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  data: rawBase64,
                  mimeType,
                },
              },
            ],
          },
        ]);

        const content = result.response.text();
        const parsed = await this.parseJSONResponse(content);

        return {
          summary: parsed.summary || content || "No summary available",
          implications: parsed.implications || "",
          recommendations: parsed.recommendations || [],
          warnings: parsed.warnings || [],
        };
      }

      // Text-based document: decode base64 to text
      let textContent;
      try {
        textContent = Buffer.from(rawBase64, "base64").toString("utf-8").substring(0, 50000);
      } catch {
        textContent = "";
      }

      const prompt = `You are an experienced farmer.

IMPORTANT: Respond ONLY with valid JSON:
{
  "summary": "string",
  "implications": "string",
  "recommendations": [],
  "warnings": []
}

Document type: ${fileType}
File name: ${fileName}
Content:
${textContent}`;

      const result = await this.model.generateContent(prompt);
      const content = result.response.text();
      const parsed = await this.parseJSONResponse(content);

      return {
        summary: parsed.summary || content || "No summary available",
        implications: parsed.implications || "",
        recommendations: parsed.recommendations || [],
        warnings: parsed.warnings || [],
      };
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
      const prompt = `You are an expert agricultural planner.

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
Season: ${season}`;

      const result = await this.model.generateContent(prompt);
      const content = result.response.text();
      const parsed = await this.parseJSONResponse(content);

      return parsed || {};
    } catch (error) {
      console.error("Gemini Planting Schedule Error:", error);
      throw new Error("Failed to generate planting schedule.");
    }
  }
}

module.exports = new GeminiService();
