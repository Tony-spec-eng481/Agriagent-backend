const {
  validateChatInput,
  validateLocation,
  validateUser,
} = require("../utils/validators");

const validateChat = (req, res, next) => {
  const { message, userId } = req.body;

  const validation = validateChatInput({ message, userId });

  if (!validation.isValid) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.errors,
    });
  }

  next();
};

const validateImageAnalysis = (req, res, next) => {
  const { userId, location } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "User ID is required" });
  }

  if (location) {
    const locationValidation = validateLocation(location);
    if (!locationValidation.isValid) {
      return res.status(400).json({
        error: "Invalid location",
        details: locationValidation.errors,
      });
    }
  }

  next();
};

const validateUserRegistration = (req, res, next) => {
  const validation = validateUser(req.body);

  if (!validation.isValid) {
    return res.status(400).json({
      error: "Validation failed",
      details: validation.errors,
    });
  }

  next();
};

const validateCoordinates = (req, res, next) => {
  const { lat, lng } = req.query;

  if (!lat || !lng) {
    return res
      .status(400)
      .json({ error: "Latitude and longitude are required" });
  }

  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  if (isNaN(latNum) || isNaN(lngNum)) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return res.status(400).json({ error: "Coordinates out of range" });
  }

  next();
};

const validatePagination = (req, res, next) => {
  const { limit = 20, page = 1 } = req.query;

  const limitNum = parseInt(limit);
  const pageNum = parseInt(page);

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({ error: "Limit must be between 1 and 100" });
  }

  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: "Page must be greater than 0" });
  }

  next();
};

const validateRequest = (requiredFields = []) => {
  return (req, res, next) => {
    const missingFields = [];

    for (const field of requiredFields) {
      if (!req.body[field] && req.body[field] !== 0) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    next();
  };
}


module.exports = {
  validateChat,
  validateImageAnalysis,
  validateUserRegistration,
  validateCoordinates,
  validatePagination,
  validateRequest,
};

