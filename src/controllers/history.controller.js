const { db, FieldValue } = require("../config/firebase.config");

exports.getChatHistory = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { limit = 50, startAfter, type } = req.query;

    let query = db
      .collection("chatHistory")
      .where("userId", "==", uid)
      .orderBy("timestamp", "desc");

    if (type) {
      query = query.where("type", "==", type);
    }

    if (startAfter) {
      const startAfterDoc = await db
        .collection("chatHistory")
        .doc(startAfter)
        .get();
      query = query.startAfter(startAfterDoc);
    }

    query = query.limit(parseInt(limit));

    const snapshot = await query.get();

    const history = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    }));

    res.json({
      success: true,
      history,
      count: history.length,
      hasMore: history.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    next(error);
  }
};

exports.getImageAnalysisHistory = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { limit = 20, startAfter } = req.query;

    let query = db
      .collection("imageAnalysis")
      .where("userId", "==", uid)
      .orderBy("timestamp", "desc");

    if (startAfter) {
      const startAfterDoc = await db
        .collection("imageAnalysis")
        .doc(startAfter)
        .get();
      query = query.startAfter(startAfterDoc);
    }

    query = query.limit(parseInt(limit));

    const snapshot = await query.get();

    const analyses = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    }));

    res.json({
      success: true,
      analyses,
      count: analyses.length,
      hasMore: analyses.length === parseInt(limit),
    });
  } catch (error) {
    console.error("Get image analysis history error:", error);
    next(error);
  }
};

exports.clearHistory = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { type } = req.body; // 'all', 'chat', 'images'

    let collectionName;
    switch (type) {
      case "chat":
        collectionName = "chatHistory";
        break;
      case "images":
        collectionName = "imageAnalysis";
        break;
      default:
        // Delete from both collections
        await clearCollection("chatHistory", uid);
        await clearCollection("imageAnalysis", uid);

        return res.json({
          success: true,
          message: "All history cleared successfully",
        });
    }

    await clearCollection(collectionName, uid);

    res.json({
      success: true,
      message: `${type} history cleared successfully`,
    });
  } catch (error) {
    console.error("Clear history error:", error);
    next(error);
  }
};

exports.exportHistory = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { format = "json", startDate, endDate } = req.query;

    let query = db
      .collection("chatHistory")
      .where("userId", "==", uid)
      .orderBy("timestamp", "asc");

    if (startDate) {
      query = query.where("timestamp", ">=", new Date(startDate));
    }

    if (endDate) {
      query = query.where("timestamp", "<=", new Date(endDate));
    }

    const snapshot = await query.get();

    const history = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    }));

    // Get user info for export
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data();

    const exportData = {
      user: {
        name: userData.name,
        email: userData.email,
        location: userData.location,
      },
      exportDate: new Date(),
      history,
      totalItems: history.length,
    };

    if (format === "text") {
      // Generate text format
      const textContent = generateTextExport(exportData);

      res.setHeader("Content-Type", "text/plain");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="agri-history-${Date.now()}.txt"`
      );
      return res.send(textContent);
    }

    if (format === "pdf") {
      // Generate PDF (would need pdf generation library)
      // For now, return JSON
      return res.json(exportData);
    }

    // Default to JSON
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="agri-history-${Date.now()}.json"`
    );
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error) {
    console.error("Export history error:", error);
    next(error);
  }
};

exports.saveFavorite = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { itemId, collection = "chatHistory", notes } = req.body;

    // Get the item
    const itemDoc = await db.collection(collection).doc(itemId).get();

    if (!itemDoc.exists) {
      return res.status(404).json({ error: "Item not found" });
    }

    const itemData = itemDoc.data();

    // Check if already favorited
    const existingFavorite = await db
      .collection("favorites")
      .where("userId", "==", uid)
      .where("itemId", "==", itemId)
      .where("collection", "==", collection)
      .limit(1)
      .get();

    if (!existingFavorite.empty) {
      return res.status(400).json({ error: "Already in favorites" });
    }

    // Save to favorites
    const favorite = {
      userId: uid,
      itemId,
      collection,
      itemData,
      notes: notes || "",
      createdAt: new Date(),
    };

    // Attach small user snapshot
    try {
      const userDoc = await db.collection("users").doc(uid).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        favorite.user = {
          uid: userDoc.id,
          name: u.name || null,
          email: u.email || null,
          avatar: u.avatar || null,
        };
      }
    } catch (e) {
      // ignore
    }

    await db.collection("favorites").add(favorite);

    res.json({
      success: true,
      message: "Added to favorites",
    });
  } catch (error) {
    console.error("Save favorite error:", error);
    next(error);
  }
};

exports.getFavorites = async (req, res, next) => {
  try {
    const { uid } = req.user;

    const snapshot = await db
      .collection("favorites")
      .where("userId", "==", uid)
      .orderBy("createdAt", "desc")
      .get();

    const favorites = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
    }));

    res.json({
      success: true,
      favorites,
      count: favorites.length,
    });
  } catch (error) {
    console.error("Get favorites error:", error);
    next(error);
  }
};

exports.removeFavorite = async (req, res, next) => {
  try {
    const { uid } = req.user;
    const { favoriteId } = req.params;

    const favoriteRef = db.collection("favorites").doc(favoriteId);
    const doc = await favoriteRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: "Favorite not found" });
    }

    if (doc.data().userId !== uid) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await favoriteRef.delete();

    res.json({
      success: true,
      message: "Favorite removed",
    });
  } catch (error) {
    console.error("Remove favorite error:", error);
    next(error);
  }
};

// Helper functions
async function clearCollection(collectionName, userId) {
  // Batch delete for Firestore
  const snapshot = await db
    .collection(collectionName)
    .where("userId", "==", userId)
    .get();

  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}

function generateTextExport(data) {
  let text = "AGRICULTURAL AI ASSISTANT - HISTORY EXPORT\n";
  text += "============================================\n\n";
  text += `User: ${data.user.name} (${data.user.email})\n`;
  text += `Export Date: ${data.exportDate.toLocaleString()}\n`;
  text += `Total Items: ${data.totalItems}\n`;
  text += "=".repeat(50) + "\n\n";

  data.history.forEach((item, index) => {
    text += `ITEM ${index + 1}\n`;
    text += `Date: ${new Date(item.timestamp).toLocaleString()}\n`;
    text += `Type: ${item.type || "chat"}\n`;

    if (item.imageUrl) {
      text += `Image: ${item.imageUrl}\n`;
    }

    if (item.message) {
      text += `Question: ${item.message}\n`;
    }

    if (item.response) {
      text += `Response: ${item.response.substring(0, 500)}...\n`;
    }

    if (item.analysis) {
      text += `Analysis: ${item.analysis.substring(0, 500)}...\n`;
    }

    if (item.drugInfo?.drugs) {
      text += "Recommended Drugs:\n";
      item.drugInfo.drugs.forEach((drug, i) => {
        text += `  ${i + 1}. ${drug.name}\n`;
        text += `     Dosage: ${drug.dosage}\n`;
        text += `     Application: ${drug.application}\n`;
      });
    }

    text += "\n" + "-".repeat(40) + "\n\n";
  });

  return text;
}
