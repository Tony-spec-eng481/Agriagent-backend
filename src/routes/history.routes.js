const express = require("express");
const router = express.Router();
const historyController = require("../controllers/history.controller");
const { authenticate } = require("../middleware/auth.middleware");
const { validatePagination } = require("../middleware/validation.middleware");

// Protected routes
router.get(
  "/chat",
  authenticate,
  validatePagination,
  historyController.getChatHistory
);
router.get(
  "/images",
  authenticate,
  validatePagination,
  historyController.getImageAnalysisHistory
);
router.delete("/clear", authenticate, historyController.clearHistory);
router.get("/export", authenticate, historyController.exportHistory);
router.get("/favorites", authenticate, historyController.getFavorites);
router.post("/favorites", authenticate, historyController.saveFavorite);
router.delete(
  "/favorites/:favoriteId",
  authenticate,
  historyController.removeFavorite
);

module.exports = router;
