const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");
const { validateRequest } = require("../middleware/validation.middleware");

// Create new chat session
router.post("/session/create", validateRequest(["userId"]), (req, res) =>
  chatController.createChatSession(req, res),
);

// Send text message
router.post("/message", validateRequest(["message"]), (req, res) =>
  chatController.sendMessage(req, res),
);
   
// Analyze image
router.post(
  "/image",
  validateRequest(["imageBase64"]),
  (req, res) => chatController.analyzeImage?.(req, res), // optional chaining if analyzeImage is missing
);

// Analyze document
router.post(
  "/document",
  validateRequest(["fileBase64", "fileName"]),
  (req, res) => chatController.analyzeDocument(req, res),
);

// Get session with all messages
router.get("/session/:sessionId", (req, res) =>
  chatController.getSessionWithMessages(req, res),
);

// Update session title
router.put(
  "/session/:sessionId/title",
  validateRequest(["title", "userId"]),
  (req, res) => chatController.updateSessionTitle(req, res),
);

// Get user's chat sessions
router.get("/sessions/:userId", (req, res) =>
  chatController.getChatSessions(req, res),
);

// Get chat history for specific session
router.get("/history/:chatId", (req, res) =>
  chatController.getChatHistory(req, res),
);

// Delete chat session
router.delete("/session/:chatId", validateRequest(["userId"]), (req, res) =>
  chatController.deleteChatSession(req, res),
);

module.exports = router;
