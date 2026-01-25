const openaiService = require("../services/openai.service");
const imageService = require("../services/image.service");
const drugService = require("../services/drug.service");
const firebaseService = require("../services/firebase.service");

exports.analyzeImage = async (req, res, next) => {
  try {
    const { userId, location, chatId } = req.body;
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Process image
    const processedImage = await imageService.processImage(imageFile.buffer);

    // Analyze with OpenAI Vision
    const analysis = await openaiService.analyzeImageWithVision(
      processedImage,
      location
    );

    // Extract drug recommendations
    const drugInfo = await drugService.extractDrugRecommendations(
      analysis,
      location
    );

    // Upload image to Firebase Storage
    const imageUrl = await firebaseService.uploadImage(
      processedImage,
      userId,
      "analysis"
    );

    // Save analysis to database
    if (userId) {
      await firebaseService.saveImageAnalysis({
        userId,
        imageUrl,
        analysis,
        drugInfo,
        location,
        chatId: chatId || `img_${Date.now()}`,
      });
    }

    res.json({
      analysis,
      drugInfo,
      imageUrl,
      timestamp: new Date(),
    });
  } catch (error) {
    next(error);
  }
};

exports.getImageAnalysis = async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    const { uid } = req.user;

    const analysis = await firebaseService.getImageAnalysis(analysisId);

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    // Optional: Check ownership if not public
    // if (analysis.userId !== uid) {
    //   return res.status(403).json({ error: "Unauthorized" });
    // }

    res.json(analysis);
  } catch (error) {
    next(error);
  }
};

exports.downloadAnalysis = async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    const analysis = await firebaseService.getImageAnalysis(analysisId);

    if (!analysis) {
      return res.status(404).json({ error: "Analysis not found" });
    }

    // Generate PDF or text report
    // For now, return JSON as file
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="analysis-${analysisId}.json"`
    );
    res.send(JSON.stringify(analysis, null, 2));
  } catch (error) {
    next(error);
  }
};
