const { db, auth } = require("../config/firebase.config");
const { validateLogin, validateRegister } = require("../utils/validators");
const axios = require("axios");

const FIREBASE_SIGN_IN_URL = (apiKey) =>
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`;

exports.register = async (req, res, next) => {
  try {
    const { email, password, name, phone, userType = "farmer" } = req.body;

    // Validate input
    const validation = validateRegister({ email, password, name, phone });
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors });
    }

    // Create Firebase auth user
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: name, 
      phoneNumber: phone,  
    });

    // Create user profile in Firestore
    const userProfile = {
      uid: userRecord.uid,
      email,
      name,
      phone,
      userType,
      location: req.body.location || null,
      farmSize: req.body.farmSize || null,
      crops: req.body.crops || [],
      livestock: req.body.livestock || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.collection("users").doc(userRecord.uid).set(userProfile);

    // Create custom token for mobile app
    const customToken = await auth.createCustomToken(userRecord.uid);

    res.status(201).json({
      success: true,
      customToken,
      user: {
        uid: userRecord.uid,
        email: userRecord.email,
        name: userRecord.displayName,
        userType,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);

    if (error.code === "auth/email-already-exists") {
      return res.status(400).json({ error: "Email already registered" });
    }

    if (error.code === "auth/invalid-email") {
      return res.status(400).json({ error: "Invalid email address" });
    }

    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const validation = validateLogin({ email, password });
    if (!validation.isValid) {
      return res.status(400).json({ error: validation.errors });
    }

    const apiKey = process.env.FIREBASE_WEB_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
    if (!apiKey) {
      console.warn("FIREBASE_WEB_API_KEY not set; password cannot be verified on server.");
      return res.status(503).json({
        error: "Server configuration error. Use client sign-in.",
      });
    }

    // Verify email + password via Firebase REST API
    let signInRes;
    try {
      signInRes = await axios.post(
        FIREBASE_SIGN_IN_URL(apiKey),
        { email: email.trim(), password, returnSecureToken: true },
        { headers: { "Content-Type": "application/json" }, timeout: 10000 }
      );
    } catch (err) {
      if (err.response?.data?.error?.message === "INVALID_PASSWORD" || err.response?.data?.error?.message === "EMAIL_NOT_FOUND") {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      if (err.response?.data?.error?.message === "INVALID_LOGIN_CREDENTIALS") {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      throw err;
    }

    const uid = signInRes.data.localId;
    const customToken = await auth.createCustomToken(uid);

    let userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      const userRecord = await auth.getUser(uid);
      const profile = {
        uid,
        email: userRecord.email,
        name: userRecord.displayName || email.split("@")[0],
        phone: userRecord.phoneNumber || null,
        userType: "farmer",
        location: null,
        farmSize: null,
        crops: [],
        livestock: [],
        isVerified: false,
        isAdmin: false,
        newsPreferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      await db.collection("users").doc(uid).set(profile);
      userDoc = await db.collection("users").doc(uid).get();
    }

    const userProfile = userDoc.data();

    res.json({
      success: true,
      customToken,
      user: {
        uid,
        email: userProfile?.email ?? signInRes.data.email,
        name: userProfile?.name ?? userProfile?.displayName,
        ...userProfile,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const { uid } = req.user;

    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      // Return empty profile for new users instead of 404
      // Or create one
      const emptyProfile = {
        uid,
        email: req.user.email || "",
        name: req.user.name || "",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return res.json({
        success: true,
        user: emptyProfile,
      });
    }

    const userData = userDoc.data();

    // Remove sensitive data
    delete userData.password;

    res.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const updates = req.body;

    // Remove fields that shouldn't be updated
    delete updates.uid;
    delete updates.email;
    delete updates.createdAt;

    updates.updatedAt = new Date();

    // Use set with merge instead of update to handle missing documents
    await db.collection("users").doc(uid).set(updates, { merge: true });

    // Get updated profile
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();

    res.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // Firebase handles logout on client side
    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Forgot password: validate email. Actual reset email is sent by the client
 * using Firebase sendPasswordResetEmail. This endpoint can be used to
 * validate the request or trigger server-side email if you integrate a mailer.
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "Valid email is required" });
    }

    const trimmed = email.trim();
    const validator = require("validator");
    if (!validator.isEmail(trimmed)) {
      return res.status(400).json({ error: "Invalid email address" });
    }

    res.json({
      success: true,
      message: "If an account exists with this email, a password reset link will be sent.",
    });
  } catch (error) {
    next(error);
  }
};
