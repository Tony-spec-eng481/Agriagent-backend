const { auth } = require("../config/firebase.config");

async function tokenRefreshMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  const routeBase = req.baseUrl || req.originalUrl || req.path || "";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    // You could add token validation logic here
    // For now, just pass through - Firebase Admin SDK will validate
    next();
  } catch (error) {
    console.error("Token validation error:", error);

    // Don't block the request for news endpoints
    if (routeBase.startsWith("/api/news")) {
      next();
    } else {
      res.status(401).json({
        success: false,
        error: "Invalid or expired token",
      });
    }
  }
}

module.exports = { tokenRefreshMiddleware };
