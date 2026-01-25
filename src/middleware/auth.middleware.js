// backend/middleware/auth.middleware.js
const { auth } = require("../config/firebase.config");

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  // Determine the request base so middleware works whether it's mounted
  // directly on app or inside a router (req.baseUrl is the mount path)
  const routeBase = req.baseUrl || req.originalUrl || req.path || "";

  // For debugging
  console.log(
    `Auth middleware for: ${req.method} ${routeBase} (path: ${req.path})`,
  );

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No auth header found");
    // For news endpoints, allow through with mock user
    if (routeBase.startsWith("/api/news")) {
      req.user = {
        uid: "anonymous-user",
        email: "anonymous@example.com",
        name: "Anonymous User",
      };
      console.log("Allowing anonymous access to news");
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
    // Verify Firebase token
    console.log("Verifying token...");
    const decodedToken = await auth.verifyIdToken(token);
    req.user = decodedToken;
    console.log("Authenticated user:", decodedToken.uid);
    next();
  } catch (error) {
    console.error("Token verification error:", error.message);

    // For news endpoints, allow through with mock user even if token is invalid
    if (routeBase.startsWith("/api/news")) {
      console.log("Allowing access with invalid token for news");
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

// Create a more permissive middleware for news only
async function authenticateNews(req, res, next) {
  const authHeader = req.headers.authorization;

  const routeBase = req.baseUrl || req.originalUrl || req.path || "";

  console.log(`News auth middleware for: ${req.method} ${routeBase}`);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("No auth header - using anonymous for news");
    req.user = {
      uid: "anonymous-news-user",
      email: "news@example.com",
      name: "News Reader",
    };
    return next();
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    // Try to verify token
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    console.log("News authenticated user:", decodedToken.uid);
    next();
  } catch (error) {
    console.log("News token invalid - using fallback user");
    // Use fallback user for news
    req.user = {
      uid: "fallback-news-user",
      email: "fallback@example.com",
      name: "Fallback Reader",
    };
    next();
  }
}

module.exports = { authenticate, authenticateNews };
