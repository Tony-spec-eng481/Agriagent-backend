const express = require("express");
const router = express.Router();
const imageController = require("../controllers/image.controller");
const { authenticate } = require("../middleware/auth.middleware");
const {
  validateImageAnalysis,
} = require("../middleware/validation.middleware");
const {
  upload,
  handleUploadError,
  requireImage,
} = require("../middleware/upload.middleware");

// Protected routes
router.post(
  "/analyze",
  authenticate,
  upload.single("image"),
  requireImage,
  handleUploadError,
  validateImageAnalysis,
  imageController.analyzeImage
);

router.get(
  "/analysis/:analysisId",
  authenticate,
  imageController.getImageAnalysis
);
router.get(
  "/download/:analysisId",
  authenticate,
  imageController.downloadAnalysis
);

module.exports = router;
