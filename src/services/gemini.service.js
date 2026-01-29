const { GoogleGenerativeAI } = require("@google/generative-ai");
const { systemPrompt } = require("../prompts/farmer-assistant.prompt");

class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-3-flash-preview", // or "gemini-1.5-pro" for more complex tasks
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
      // Extract JSON from text (Gemini might wrap JSON in markdown or add text)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { response: text, metadata: {} };
    } catch (error) {
      console.error("Failed to parse JSON:", error);
      return { response: text, metadata: {} };
    }
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

IMPORTANT: You MUST respond with ONLY valid JSON in this exact format:
{
  "response": "Your main response text here",
  "metadata": {},
  "suggestedActions": []
}

Do not include any additional text, explanations, or markdown formatting outside the JSON object.`;

      const result = await this.model.generateContent([
        { role: "user", parts: [{ text: systemContent }] },
        { role: "user", parts: [{ text: message }] },
      ]);

      const response = await result.response;
      const content = response.text();

      const parsed = await this.parseJSONResponse(content);

      return {
        response: parsed.response || content || "Farmer Joe didn't respond",
        metadata: parsed.metadata || {},
        suggestedActions: parsed.suggestedActions || [],
      };
    } catch (error) {
      console.error("Gemini Text Analysis Error:", error);
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

IMPORTANT: You MUST respond with ONLY valid JSON in this exact format:
{
  "analysis": "string",
  "cropName": "string or null",
  "healthStatus": "healthy" | "stressed" | "diseased" | "unknown",
  "confidence": number (0-100),
  "issues": array of {type, description, severity, recommendation},
  "recommendations": array of strings,
  "story": "optional string"
}

Do not include any additional text, explanations, or markdown formatting outside the JSON object.`;

      // For Gemini, we need to handle the image differently
      // Convert base64 to buffer for Gemini
      const imagePart = {
        inlineData: {
          data: base64Image,
          mimeType: "image/jpeg",
        },
      };

      const result = await this.model.generateContent([
        { role: "user", parts: [{ text: systemContent }] },
        {
          role: "user",
          parts: [imagePart, { text: "Analyze this farming image" }],
        },
      ]);

      const response = await result.response;
      const content = response.text();

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

  // In gemini.service.js, add this method if you need a different analysis than the existing analyzeImage method
async analyzeImageWithVision(base64Image, context = {}) {
  try {
    // Reuse the existing analyzeImage method or create a specialized version
    const analysis = await this.analyzeImage(base64Image, context);
    
    // Enhance with additional context if needed
    return {
      ...analysis,
      visionType: "agricultural",
      analyzedAt: new Date().toISOString(),
      model: "gemini-3-flash-preview",
    };
  } catch (error) {
    console.error("Gemini Vision Analysis Error:", error);
    throw new Error("Failed to analyze image with vision.");
  }
}

  // =========================
  // Analyze document (soil reports, CSVs, PDFs)
  // =========================
  async analyzeDocument(textContent, fileType) {
    try {
      const systemContent = `You are an experienced farmer who can interpret agricultural documents.
Analyze the content below and provide practical insights.

IMPORTANT: You MUST respond with ONLY valid JSON in this exact format:
{
  "summary": "string (key findings)",
  "implications": "string (practical farming implications)",
  "recommendations": ["array", "of", "strings"],
  "warnings": ["array", "of", "strings"] (optional)
}

Do not include any additional text, explanations, or markdown formatting outside the JSON object.`;

      const userContent = `Document type: ${fileType}\nContent:\n${textContent}`;

      const result = await this.model.generateContent([
        { role: "user", parts: [{ text: systemContent }] },
        { role: "user", parts: [{ text: userContent }] },
      ]);

      const response = await result.response;
      const content = response.text();

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
      const systemContent = `You are an expert in agricultural planning and crop cycles.

IMPORTANT: You MUST respond with ONLY valid JSON in this exact format:
{
  "bestPlantingDates": ["array", "of", "dates"],
  "soilPreparation": "string",
  "spacing": "string",
  "depth": "string",
  "watering": "string",
  "fertilization": "string",
  "pestManagement": "string",
  "expectedHarvestDates": ["array", "of", "dates"]
}

Do not include any additional text, explanations, or markdown formatting outside the JSON object.`;

      const userContent = `Generate a detailed planting schedule for ${crop} in ${location} during ${season}.`;

      const result = await this.model.generateContent([
        { role: "user", parts: [{ text: systemContent }] },
        { role: "user", parts: [{ text: userContent }] },
      ]);

      const response = await result.response;
      const content = response.text();

      const parsed = await this.parseJSONResponse(content);

      return parsed;
    } catch (error) {
      console.error("Gemini Planting Schedule Error:", error);
      throw new Error("Failed to generate planting schedule.");
    }
  }
}

module.exports = new GeminiService();
