const GeminiService = require("../services/gemini.service");
const imageService = require("../services/image.service");
const drugService = require("../services/drug.service");
const FirebaseService = require("../services/firebase.service");
const { v4: uuidv4 } = require("uuid");

exports.analyzeImage = async (req, res, next) => {
  try {
    const uid = req.user?.uid;
    const { userId, location, chatId } = req.body;
    const effectiveUserId = userId || uid;
    const imageFile = req.file;

    if (!imageFile) {
      return res.status(400).json({ error: "No image provided" });
    }

    // Process image
    const processedImage = await imageService.processImage(imageFile.buffer);

    // Convert to base64 for Gemini (raw base64, no data URL)
    const base64Image = processedImage.toString("base64");
    const mimeType = imageFile.mimetype || "image/jpeg";

    // Analyze with Gemini Vision
    const analysis = await GeminiService.analyzeImage(base64Image, {
      userLocation: location,
      mimeType,
    });

    // Extract drug recommendations
    const drugInfo = await drugService.extractDrugRecommendations(
      analysis,
      location
    );

    // Get or create chat session for image analysis
    let sessionId;
    if (effectiveUserId) {
      const session = await FirebaseService.getOrCreateSession(effectiveUserId, chatId, {
        title: "Image Analysis",
        type: "image",
        tags: ["image-analysis"],
      });
      sessionId = session.session.id;
    }

    // Upload image to Firebase Storage
    const imageUrl = await FirebaseService.uploadImage(
      processedImage,
      effectiveUserId || "guest",
      "chat-images",
      `img_${Date.now()}_${uuidv4()}.jpg`
    );

    // Save user message with image
    let userMessageId;
    if (effectiveUserId) {
      userMessageId = await FirebaseService.saveChatMessage({
        id: `user_img_${Date.now()}_${uuidv4()}`,
        userId: effectiveUserId,
        chatId: sessionId,
        role: "user",
        content: "Analyze this image",
        imageUrl: imageUrl,
        type: "image",
        timestamp: new Date(),
      });
    }

    // Save AI response
    let aiMessageId;
    if (effectiveUserId) {
      aiMessageId = await FirebaseService.saveAIMessage({
        id: `ai_img_${Date.now()}_${uuidv4()}`,
        userId: "ai",
        chatId: sessionId,
        role: "assistant",
        content: analysis.analysis || "I've analyzed your image.",
        metadata: {
          cropName: analysis.cropName,
          healthStatus: analysis.healthStatus,
          confidence: analysis.confidence,
          issues: analysis.issues,
          recommendations: analysis.recommendations,
          story: analysis.story,
        },
        timestamp: new Date(),
      });
    }

    // Save analysis to database
    if (effectiveUserId) {
      await FirebaseService.saveImageAnalysis({
        id: `analysis_${Date.now()}_${uuidv4()}`,
        userId: effectiveUserId,
        imageUrl,
        analysis,
        drugInfo,
        location,
        chatId: sessionId,
        userMessageId,
        aiMessageId,
        createdAt: new Date(),
      });
    }

    res.json({
      success: true,
      analysis: analysis.analysis,
      metadata: {
        cropName: analysis.cropName,
        healthStatus: analysis.healthStatus,
        confidence: analysis.confidence,
        issues: analysis.issues,
        recommendations: analysis.recommendations,
        story: analysis.story,
      },
      drugInfo,
      imageUrl,
      userMessageId,
      aiMessageId,
      chatId: sessionId,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Image analysis error:", error);
    next(error);
  }
};

exports.getImageAnalysis = async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    const { uid } = req.user || {};

    const analysis = await FirebaseService.getImageAnalysis(analysisId);

    if (!analysis) {
      return res.status(404).json({ 
        success: false,
        error: "Analysis not found" 
      });
    }

    // Check ownership if user is authenticated
    if (uid && analysis.userId !== uid) {
      return res.status(403).json({ 
        success: false,
        error: "Unauthorized to view this analysis" 
      });
    }

    res.json({
      success: true,
      analysis: analysis.analysis,
      metadata: analysis.metadata || {},
      drugInfo: analysis.drugInfo || {},
      imageUrl: analysis.imageUrl,
      userId: analysis.userId,
      location: analysis.location,
      chatId: analysis.chatId,
      createdAt: analysis.createdAt,
    });
  } catch (error) {
    console.error("Get image analysis error:", error);
    next(error);
  }
};

exports.downloadAnalysis = async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    const analysis = await FirebaseService.getImageAnalysis(analysisId);

    if (!analysis) {
      return res.status(404).json({ 
        success: false,
        error: "Analysis not found" 
      });
    }

    // Generate comprehensive report JSON
    const report = {
      reportId: analysisId,
      generatedAt: new Date().toISOString(),
      analysis: {
        summary: analysis.analysis,
        crop: analysis.metadata?.cropName || "Unknown",
        healthStatus: analysis.metadata?.healthStatus || "unknown",
        confidence: analysis.metadata?.confidence || 0,
        issues: analysis.metadata?.issues || [],
        recommendations: analysis.metadata?.recommendations || [],
        story: analysis.metadata?.story || "",
      },
      drugRecommendations: analysis.drugInfo || {},
      imageInfo: {
        url: analysis.imageUrl,
        analyzedAt: analysis.createdAt,
      },
      location: analysis.location,
      metadata: {
        userId: analysis.userId,
        chatId: analysis.chatId,
      }
    };

    // Set headers for JSON download
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="crop-analysis-${analysisId}.json"`
    );
    res.send(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error("Download analysis error:", error);
    next(error);
  }
};

exports.getUserImageAnalyses = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false,
        error: "User ID is required" 
      });
    }

    const analyses = await FirebaseService.getUserImageAnalyses(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      analyses,
      total: analyses.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    console.error("Get user image analyses error:", error);
    next(error);
  }
};

exports.deleteImageAnalysis = async (req, res, next) => {
  try {
    const { analysisId } = req.params;
    const { userId } = req.body;

    if (!analysisId || !userId) {
      return res.status(400).json({ 
        success: false,
        error: "Analysis ID and User ID are required" 
      });
    }

    // Verify ownership
    const analysis = await FirebaseService.getImageAnalysis(analysisId);
    if (!analysis) {
      return res.status(404).json({ 
        success: false,
        error: "Analysis not found" 
      });
    }

    if (analysis.userId !== userId) {
      return res.status(403).json({ 
        success: false,
        error: "Unauthorized to delete this analysis" 
      });
    }

    await FirebaseService.deleteImageAnalysis(analysisId, userId);

    res.json({
      success: true,
      message: "Image analysis deleted successfully",
    });
  } catch (error) {
    console.error("Delete image analysis error:", error);
    next(error);
  }
};