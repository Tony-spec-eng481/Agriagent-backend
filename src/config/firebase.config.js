// firebase.config.js
require("dotenv").config(); // MUST be first to load .env   

const admin = require("firebase-admin");
const path = require("path");

// Check if service account path exists, otherwise use environment variables
let serviceAccount;
try {
  const serviceAccountPath = path.join(  
    __dirname,
    "../../serviceAccountKey.json",
  );
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  // If service account file doesn't exist, try environment variable
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else {
    console.error(
      "Firebase service account not found. Please provide serviceAccountKey.json or FIREBASE_SERVICE_ACCOUNT env var.",
    );
    throw error;
  }  
}

// Initialize Firebase app
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    process.env.FIREBASE_DATABASE_URL ||
    `https://${serviceAccount.project_id}.firebaseio.com`,
  storageBucket:
    process.env.FIREBASE_STORAGE_BUCKET ||
    `${serviceAccount.project_id}.appspot.com`,
});

// Firestore instance
const db = admin.firestore();

// Firebase Auth
const auth = admin.auth();
  
// Cloud Storage bucket  
const storage = admin.storage().bucket();

// Firestore FieldValue helper
const FieldValue = admin.firestore.FieldValue;
// Helper to generate random IDs
const generateId = () => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 20; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

// Get current timestamp
const getTimestamp = () => {
  const now = new Date();
  return {
    _createdAt: now,
    _updatedAt: now,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
};

// Delete existing collections (optional)
const clearCollection = async (collectionName) => {
  try {
    const collectionRef = db.collection(collectionName);
    const snapshot = await collectionRef.get();
    const batch = db.batch();

    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`✅ Cleared ${collectionName} collection`);
  } catch (error) {  
    console.error(`❌ Error clearing ${collectionName}:`, error.message);
  }
};

module.exports = {
  admin,
  db,
  auth,
  storage,
  FieldValue,
  generateId,
  getTimestamp,
  clearCollection,
};
