const validator = require("validator");

const validateChatInput = (data) => {
  const errors = {};

  if (!data.message || typeof data.message !== "string") {
    errors.message = "Message is required and must be a string";
  } else if (data.message.trim().length === 0) {
    errors.message = "Message cannot be empty";
  } else if (data.message.length > 2000) {
    errors.message = "Message cannot exceed 2000 characters";
  }

  if (data.userId && typeof data.userId !== "string") {
    errors.userId = "User ID must be a string";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateRegister = (data) => {
  const errors = {};

  if (!data.email || !validator.isEmail(data.email)) {
    errors.email = "Valid email is required";
  }

  if (!data.password || typeof data.password !== "string") {
    errors.password = "Password is required";
  } else if (data.password.length < 6) {
    errors.password = "Password must be at least 6 characters";
  }

  if (!data.name || typeof data.name !== "string") {
    errors.name = "Name is required";
  } else if (data.name.trim().length < 2) {
    errors.name = "Name must be at least 2 characters";
  }

  if (data.phone && !validator.isMobilePhone(data.phone)) {
    errors.phone = "Valid phone number is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateLogin = (data) => {
  const errors = {};

  if (!data.email || !validator.isEmail(data.email)) {
    errors.email = "Valid email is required";
  }

  if (!data.password || typeof data.password !== "string") {
    errors.password = "Password is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateLocation = (location) => {
  const errors = {};

  if (!location) {
    return { isValid: true, errors }; // Location is optional
  }

  if (typeof location !== "object") {
    errors.location = "Location must be an object";
    return { isValid: false, errors };
  }

  const { lat, lng } = location;

  if (lat === undefined || lng === undefined) {
    errors.coordinates = "Both latitude and longitude are required";
  }

  if (lat !== undefined && (typeof lat !== "number" || isNaN(lat))) {
    errors.latitude = "Latitude must be a valid number";
  } else if (lat !== undefined && (lat < -90 || lat > 90)) {
    errors.latitude = "Latitude must be between -90 and 90";
  }

  if (lng !== undefined && (typeof lng !== "number" || isNaN(lng))) {
    errors.longitude = "Longitude must be a valid number";
  } else if (lng !== undefined && (lng < -180 || lng > 180)) {
    errors.longitude = "Longitude must be between -180 and 180";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateUser = (data) => {
  const errors = {};

  if (data.email && !validator.isEmail(data.email)) {
    errors.email = "Valid email is required";
  }

  if (
    data.name &&
    (typeof data.name !== "string" || data.name.trim().length < 2)
  ) {
    errors.name = "Name must be at least 2 characters";
  }

  if (data.phone && !validator.isMobilePhone(data.phone)) {
    errors.phone = "Valid phone number is required";
  }

  if (
    data.farmSize &&
    (typeof data.farmSize !== "number" || data.farmSize < 0)
  ) {
    errors.farmSize = "Farm size must be a positive number";
  }

  if (data.location) {
    const locationValidation = validateLocation(data.location);
    if (!locationValidation.isValid) {
      Object.assign(errors, locationValidation.errors);
    }
  }

  if (data.crops && !Array.isArray(data.crops)) {
    errors.crops = "Crops must be an array";
  }

  if (data.livestock && !Array.isArray(data.livestock)) {
    errors.livestock = "Livestock must be an array";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateImageAnalysis = (data) => {
  const errors = {};

  if (!data.userId || typeof data.userId !== "string") {
    errors.userId = "User ID is required";
  }

  if (data.location) {
    const locationValidation = validateLocation(data.location);
    if (!locationValidation.isValid) {
      Object.assign(errors, locationValidation.errors);
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Update the validateShop function:
const validateShop = (data) => {
  const errors = {};

  if (!data.name || typeof data.name !== "string") {
    errors.name = "Shop name is required";
  } else if (data.name.trim().length < 2) {
    errors.name = "Shop name must be at least 2 characters";
  }

  // Handle different location formats
  if (!data.location && !data.address) {
    errors.location = "Location or address is required";
  }

  // If location is an object with coordinates
  if (data.location && typeof data.location === "object") {
    const locationValidation = validateLocation(data.location);
    if (!locationValidation.isValid) {
      Object.assign(errors, locationValidation.errors);
    }
  }

  if (data.address && typeof data.address !== "string") {
    errors.address = "Address must be a string";
  }

  if (data.phone && !validator.isMobilePhone(data.phone)) {
    errors.phone = "Valid phone number is required";
  }

  if (data.email && !validator.isEmail(data.email)) {
    errors.email = "Valid email is required";
  }

  if (data.website && !validator.isURL(data.website)) {
    errors.website = "Valid website URL is required";
  }

  if (data.products && !Array.isArray(data.products)) {
    errors.products = "Products must be an array";
  }

  if (data.categories && !Array.isArray(data.categories)) {
    errors.categories = "Categories must be an array";
  }

  if (
    data.rating &&
    (typeof data.rating !== "number" || data.rating < 0 || data.rating > 5)
  ) {
    errors.rating = "Rating must be between 0 and 5";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

const validateReview = (data) => {
  const errors = {};

  if (!data.rating || typeof data.rating !== "number") {
    errors.rating = "Rating is required";
  } else if (data.rating < 1 || data.rating > 5) {
    errors.rating = "Rating must be between 1 and 5";
  }

  if (data.comment && typeof data.comment !== "string") {
    errors.comment = "Comment must be a string";
  } else if (data.comment && data.comment.length > 1000) {
    errors.comment = "Comment cannot exceed 1000 characters";
  }

  if (data.photos && !Array.isArray(data.photos)) {
    errors.photos = "Photos must be an array";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Validation for drug recommendations
const validateDrugRecommendation = (data) => {
  const errors = {};

  if (!data.name || typeof data.name !== "string") {
    errors.name = "Drug name is required";
  }

  if (!data.dosage || typeof data.dosage !== "string") {
    errors.dosage = "Dosage information is required";
  }

  if (!data.application || typeof data.application !== "string") {
    errors.application = "Application method is required";
  }

  if (!data.safety || typeof data.safety !== "string") {
    errors.safety = "Safety information is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Sanitize input data
const sanitizeInput = (input) => {
  if (typeof input === "string") {
    // Remove potential XSS attacks
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;").trim();
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item));
  }

  if (typeof input === "object" && input !== null) {
    const sanitized = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }

  return input;
};

module.exports = {
  validateChatInput,
  validateRegister,
  validateLogin,
  validateLocation,
  validateUser,
  validateImageAnalysis,
  validateShop,
  validateReview,
  validateDrugRecommendation,
  sanitizeInput,
};
