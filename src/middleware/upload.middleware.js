const multer = require("multer");
const path = require("path");

// Configure storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
    return cb(new Error("Only image files are allowed!"), false);
  }

  // Check MIME type
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("Only image files are allowed!"), false);
  }

  cb(null, true);
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
  },
  fileFilter: fileFilter,
});

// Error handling middleware for multer
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(400)
        .json({ error: "File size too large. Maximum size is 10MB." });
    }

    if (err.code === "LIMIT_FILE_COUNT") {
      return res
        .status(400)
        .json({ error: "Too many files. Maximum is 1 file." });
    }

    return res.status(400).json({ error: "File upload error: " + err.message });
  }

  if (err) {
    return res.status(400).json({ error: err.message });
  }

  next();
};

// Middleware to check if file was uploaded
const requireImage = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image file provided" });
  }

  // Check file size
  if (req.file.size > 10 * 1024 * 1024) {
    return res.status(400).json({ error: "File size exceeds 10MB limit" });
  }

  next();
};

module.exports = {
  upload,
  handleUploadError,
  requireImage,
};
