// backend/middleware/auth.middleware.js
const { auth } = require("../config/firebase.config");

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const routeBase = req.baseUrl || req.originalUrl || req.path || "";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // For news endpoints, allow through with mock user when no token
    if (routeBase.includes("/news")) {
      req.user = {
        uid: "anonymous-user",
        email: "anonymous@example.com",
        name: "Anonymous User",
      };
      return next();
    }
    return res.status(401).json({
      success: false,
      error: "Authentication required",
      message: "No authorization token provided",
    });
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await auth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      ...decodedToken,
    };
    next();
  } catch (error) {
    if (routeBase.includes("/news")) {
      req.user = {
        uid: "temp-user",
        email: "temp@example.com",
        name: "Temporary User",
      };
      return next();
    }
    res.status(401).json({
      success: false,
      error: "Authentication failed",
      message: "Invalid or expired token",
    });
  }
}

module.exports = { authenticate };
