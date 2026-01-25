const errorHandler = (err, req, res, next) => {
  console.error("Error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  // Default error
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  let details = err.details || null;

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    details = err.errors || err.message;
  }

  if (err.code === "auth/id-token-expired") {
    statusCode = 401;
    message = "Token expired";
  }

  if (err.code === "auth/id-token-revoked") {
    statusCode = 401;
    message = "Token revoked";
  }

  if (err.code === "auth/insufficient-permission") {
    statusCode = 403;
    message = "Insufficient permissions";
  }

  if (err.code === "storage/unauthorized") {
    statusCode = 403;
    message = "Storage access denied";
  }

  // OpenAI API errors
  if (err.response?.status === 429) {
    statusCode = 429;
    message = "Rate limit exceeded. Please try again later.";
  }

  if (err.response?.status === 401) {
    statusCode = 401;
    message = "OpenAI API authentication failed";
  }

  if (err.response?.status === 403) {
    statusCode = 403;
    message = "OpenAI API access forbidden";
  }

  // Database errors
  if (err.code === "firestore/not-found") {
    statusCode = 404;
    message = "Resource not found";
  }

  if (err.code === "firestore/permission-denied") {
    statusCode = 403;
    message = "Database permission denied";
  }

  // Rate limiting
  if (err.name === "RateLimitError") {
    statusCode = 429;
    message = "Too many requests. Please try again later.";
  }

  const response = {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  if (details && process.env.NODE_ENV !== "production") {
    response.details = details;
    response.stack =
      process.env.NODE_ENV === "development" ? err.stack : undefined;
  }

  res.status(statusCode).json(response);
};

// 404 handler
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
