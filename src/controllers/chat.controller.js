const OpenAIService = require("../services/openai.service");
const FirebaseService = require("../services/firebase.service");
const { v4: uuidv4 } = require("uuid");

class ChatController {
  // =========================
  // Send text message
  // =========================
  // Update sendMessage method in ChatController
  async sendMessage(req, res) {
    try {
      const { message, userId, location, chatId } = req.body;
   
      if (!message) {
        return res
          .status(400)
          .json({ success: false, error: "Message is required" });
      }

      // Get or create session
      const session = await FirebaseService.getOrCreateSession(userId, chatId);
      const sessionId = session.session.id;

      // Save user message
      const userMessageId = await FirebaseService.saveChatMessage({
        id: `user_msg_${Date.now()}_${uuidv4()}`,
        userId: userId || "guest",
        chatId: sessionId,
        role: "user",
        content: message,
        timestamp: new Date(),
      });

      // AI analysis
      const aiResponse = await OpenAIService.analyzeTextMessage(message, {
        userLocation: location,
      });

      // Save AI message
      const aiMessageId = await FirebaseService.saveAIMessage({
        id: `ai_msg_${Date.now()}_${uuidv4()}`,
        userId: "ai",
        chatId: sessionId,
        role: "assistant",
        content: aiResponse.response || "Message analyzed",
        metadata: aiResponse.metadata || {},
        timestamp: new Date(),
      });

      res.json({
        success: true,
        response: aiResponse.response,
        userMessageId,
        aiMessageId,
        chatId: sessionId,
        metadata: aiResponse.metadata || {},
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Send message error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: error.message || "Failed to process message",
        });
    }
  }

  // =========================
  // Analyze image
  // =========================
  async analyzeImage(req, res) {
    try {
      const { imageBase64, userId, location, chatId } = req.body;

      if (!imageBase64) {
        return res
          .status(400)
          .json({ success: false, error: "Image is required" });
      }

      // Get or create session
      const session = await FirebaseService.getOrCreateSession(userId, chatId, {
        title: "Image Analysis",
        type: "image",
        tags: ["image-analysis"],
      });
      const sessionId = session.session.id;

      // Upload image to Firebase if possible
      let imageUrl = null;
      try {
        const buffer = Buffer.from(imageBase64, "base64");
        // Using uploadFile as uploadImage might limit functionality or not exist
        imageUrl = await FirebaseService.uploadFile(
          buffer,
          userId || "guest",
          "chat-images",
          `img_${Date.now()}_${uuidv4()}.jpg`
        );
      } catch (err) {
        console.error("Image upload failed:", err);
      }

      // Save user message
      const userMessageId = await FirebaseService.saveChatMessage({
        id: `user_img_${Date.now()}_${uuidv4()}`,
        userId: userId || "guest",
        chatId: sessionId,
        role: "user",
        content: "Analyze this image",
        imageUrl: imageUrl,
        type: "image",
        timestamp: new Date(),
      });

      // Analyze with OpenAI
      const analysis = await OpenAIService.analyzeImage(imageBase64, {
        userLocation: location,
      });

      // Save AI message
      const aiMessageId = await FirebaseService.saveAIMessage({
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

      res.json({
        success: true,
        response: analysis.analysis,
        userMessageId,
        aiMessageId,
        chatId: sessionId,
        metadata: analysis,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Analyze image error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to analyze image",
      });
    }
  }

  // =========================
  // Analyze document
  // =========================
  async analyzeDocument(req, res) {
    try {
      const { fileBase64, fileName, fileType, userId, location, chatId } =
        req.body;

      if (!fileBase64 || !fileName) {
        return res.status(400).json({
          success: false,
          error: "File is required",
        });
      }

      const sessionId = chatId || `chat_${Date.now()}_${uuidv4()}`;
      const messageId = `doc_${Date.now()}_${uuidv4()}`;

      const textContent = Buffer.from(fileBase64, "base64")
        .toString("utf-8")
        .substring(0, 10000);

      const analysis = await OpenAIService.analyzeDocument(
        textContent,
        fileType,
      );

      let fileUrl;
      try {
        const buffer = Buffer.from(fileBase64, "base64");
        fileUrl = await FirebaseService.uploadImage(
          buffer,
          userId || "guest",
          "chat-documents",
        );
      } catch (err) {
        console.error("Document upload failed:", err);
      }

      const metadata = {};
      if (analysis.implications) {
        metadata.soilAnalysis = {
          soilType: "Based on document analysis",
          phLevel: 0,
          nutrientLevels: {
            nitrogen: "medium",
            phosphorus: "medium",
            potassium: "medium",
          },
          recommendations: analysis.recommendations || [],
          suitableCrops: [],
        };
      }

      const docData = {
        id: messageId,
        userId: userId || "guest",
        message: `Document analysis: ${fileName}`,
        response: analysis.summary || "Document analyzed",
        type: "file",
        chatId: sessionId,
        timestamp: new Date(),
        fileName,
        fileType,
      };

      if (location) docData.location = location;
      if (fileUrl) docData.fileUrl = fileUrl;
      if (Object.keys(metadata).length > 0) docData.metadata = metadata;

      await FirebaseService.saveChatHistory(docData);

      res.json({
        success: true,
        response: analysis.summary || "I've analyzed your document.",
        messageId,
        chatId: sessionId,
        metadata,
        fileUrl,
        fileName,
        fileType,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error("Analyze document error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to analyze document",
      });
    }
  }

  // =========================
  // Get chat sessions
  // =========================
  async getChatSessions(req, res) {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const sessions = await FirebaseService.getChatSessions(userId, {
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      res.json({
        success: true,
        sessions,
        total: sessions.length,
      });
    } catch (error) {
      console.error("Get chat sessions error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch chat sessions",
      });
    }
  }

  // =========================
  // Get chat history
  // =========================
  async getChatHistory(req, res) {
    try {
      const { chatId } = req.params;
      const { limit = 100 } = req.query;

      if (!chatId) {
        return res.status(400).json({
          success: false,
          error: "Chat ID is required",
        });
      }

      const messages = await FirebaseService.getChatMessages(chatId, {
        limit: parseInt(limit),
      });

      res.json({
        success: true,
        chatId,
        messages,
      });
    } catch (error) {
      console.error("Get chat history error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch chat history",
      });
    }
  }

  // =========================
  // Delete chat session
  // =========================
  async deleteChatSession(req, res) {
    try {
      const { chatId } = req.params;
      const { userId } = req.body;

      if (!chatId || !userId) {
        return res.status(400).json({
          success: false,
          error: "Chat ID and User ID are required",
        });
      }

      await FirebaseService.deleteChatSession(chatId, userId);

      res.json({
        success: true,
        message: "Chat session deleted successfully",
      });
    } catch (error) {
      console.error("Delete chat session error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to delete chat session",
      });
    }
  }
  // Add these methods to your ChatController class

  // =========================
  // Create new chat session
  // =========================
  async createChatSession(req, res) {
    try {
      const { userId, title, type = "text", tags = [] } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          error: "User ID is required",
        });
      }

      const chatId = `chat_${Date.now()}_${uuidv4()}`;
      const sessionData = {
        id: chatId,
        userId,
        title: title || "Farm Chat",
        type,
        tags,
        lastMessage: "",
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await FirebaseService.createChatSession(sessionData);

      res.json({
        success: true,
        chatId,
        session: sessionData,
      });
    } catch (error) {
      console.error("Create chat session error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to create chat session",
      });
    }
  }

  // =========================
  // Get session with messages
  // =========================
  async getSessionWithMessages(req, res) {
    try {
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          error: "Session ID is required",
        });
      }

      // Get session data
      const sessionRef = FirebaseService.db.collection("chatSessions").doc(sessionId);
      const sessionDoc = await sessionRef.get();

      if (!sessionDoc.exists) {
        return res.status(404).json({
          success: false,
          error: "Session not found",
        });
      }

      const sessionData = sessionDoc.data();

      // Get all messages for this session
      const messages = await FirebaseService.getChatMessages(sessionId);

      // Group messages by conversation
      const conversations = [];
      let currentConversation = null;

      messages.forEach((msg) => {
        if (msg.role === "user") {
          if (currentConversation) {
            conversations.push(currentConversation);
          }
          currentConversation = {
            userMessage: msg,
            aiResponse: null,
          };
        } else if (msg.role === "assistant" && currentConversation) {
          currentConversation.aiResponse = msg;
        }
      });

      if (currentConversation && currentConversation.userMessage) {
        conversations.push(currentConversation);
      }

      res.json({
        success: true,
        session: sessionData,
        messages,
        conversations,
        totalMessages: messages.length,
      });
    } catch (error) {
      console.error("Get session with messages error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to fetch session",
      });
    }
  }

  // =========================
  // Update session title
  // =========================
  async updateSessionTitle(req, res) {
    try {
      const { sessionId } = req.params;
      const { title, userId } = req.body;

      if (!sessionId || !title || !userId) {
        return res.status(400).json({
          success: false,
          error: "Session ID, title, and user ID are required",
        });
      }

      await FirebaseService.updateSessionTitle(sessionId, userId, title);

      res.json({
        success: true,
        message: "Session title updated",
      });
    } catch (error) {
      console.error("Update session title error:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Failed to update session title",
      });
    }
  }
}

module.exports = new ChatController();
