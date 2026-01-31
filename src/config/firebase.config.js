const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

function getServiceAccount() {
  // Try environment variables first (for production: Vercel, Render, etc.)

  // Option 1: Base64 encoded (recommended for Vercel)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    try {
      const decoded = Buffer.from(
        process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
        "base64",
      ).toString("utf8");
      return JSON.parse(decoded);
    } catch (error) {
      console.error("Error decoding base64 service account:", error.message);
    }
  }

  // Option 2: Direct JSON string
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
      console.error("Error parsing JSON service account:", error.message);
    }
  }

  // Option 3: Individual environment variables
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_PRIVATE_KEY &&
    process.env.FIREBASE_CLIENT_EMAIL
  ) {
    return {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_CLIENT_ID,
      auth_uri: "https://accounts.google.com/o/oauth2/auth",
      token_uri: "https://oauth2.googleapis.com/token",
      auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
      client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL,
    };
  }

  // Option 4: Local JSON file (for development)
  try {
    const serviceAccountPath = path.join(
      __dirname,
      "..",
      "..",
      "config",
      "serviceAccountKey.json",
    );

    if (fs.existsSync(serviceAccountPath)) {
      return require(serviceAccountPath);
    }
  } catch (error) {
    console.error("Error loading local service account file:", error.message);
  }

  // If all methods fail
  throw new Error(
    "Firebase service account not found. Please set one of:\n" +
      "1. FIREBASE_SERVICE_ACCOUNT_BASE64 (Base64 encoded JSON)\n" +
      "2. FIREBASE_SERVICE_ACCOUNT (JSON string)\n" +
      "3. Individual Firebase env vars (FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, etc.)\n" +
      "4. Local ../serviceAccountKey.json file",
  );
}

// Initialize Firebase Admin
let db, auth, storage, FieldValue;

try {
  const serviceAccount = getServiceAccount();

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ||
        `https://${serviceAccount.project_id}.firebaseio.com`,
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        `${serviceAccount.project_id}.appspot.com`,
    });

    console.log("✅ Firebase Admin initialized successfully");
  }

  // Export Firebase services
  db = admin.firestore();
  db.settings({ ignoreUndefinedProperties: true });
  auth = admin.auth();
  storage = admin.storage().bucket();
  FieldValue = admin.firestore.FieldValue;
} catch (error) {
  console.error("❌ Firebase initialization failed:", error.message);
  // Don't throw here if you want the app to start without Firebase
  // (useful for development without Firebase config)
  if (process.env.NODE_ENV === "production") {
    throw error;
  }
}

module.exports = {
  admin,
  db,
  auth,
  storage,
  FieldValue,
};
