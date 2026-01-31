const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const { authenticate } = require("../middleware/auth.middleware");
const {
  validateUserRegistration,
  validateLoginBody,
} = require("../middleware/validation.middleware");

// Public routes
router.post("/register", validateUserRegistration, authController.register);
router.post("/login", validateLoginBody, authController.login);
router.post("/forgot-password", authController.forgotPassword);

// Protected routes
router.get("/profile", authenticate, authController.getProfile);
router.put("/profile", authenticate, authController.updateProfile);
router.post("/logout", authenticate, authController.logout);

module.exports = router;
