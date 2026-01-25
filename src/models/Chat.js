const { db, FieldValue } = require("../config/firebase.config");

class Chat {
  constructor(data) {
    this.id = data.id;
    this.userId = data.userId;
    this.message = data.message;
    this.response = data.response;
    this.type = data.type || "text";
    this.location = data.location;
    this.imageUrl = data.imageUrl;
    this.drugInfo = data.drugInfo;
    this.chatId = data.chatId || `chat_${Date.now()}`;
    this.timestamp = data.timestamp || new Date();
    this.createdAt = data.createdAt || new Date();
  }

  // Save chat to Firestore
  async save() {
    const chatData = {
      userId: this.userId,
      message: this.message,
      response: this.response,
      type: this.type,
      location: this.location,
      imageUrl: this.imageUrl,
      drugInfo: this.drugInfo,
      chatId: this.chatId,
      timestamp: FieldValue.serverTimestamp(),
      createdAt: new Date(),
    };

    let docRef;

    if (this.id) {
      await db
        .collection("chatHistory")
        .doc(this.id)
        .set(chatData, { merge: true });
      docRef = this.id;
    } else {
      docRef = await db.collection("chatHistory").add(chatData);
      this.id = docRef.id;
    }

    return this;
  }

  // Get chat by ID
  static async findById(id) {
    const chatDoc = await db.collection("chatHistory").doc(id).get();

    if (!chatDoc.exists) {
      return null;
    }

    return new Chat({ id: chatDoc.id, ...chatDoc.data() });
  }

  // Get user's chat history
  static async findByUserId(userId, options = {}) {
    const { limit = 50, startAfter, type, startDate, endDate } = options;

    let query = db
      .collection("chatHistory")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc");

    if (type) {
      query = query.where("type", "==", type);
    }

    if (startDate) {
      query = query.where("timestamp", ">=", new Date(startDate));
    }

    if (endDate) {
      query = query.where("timestamp", "<=", new Date(endDate));
    }

    if (startAfter) {
      const startAfterDoc = await db
        .collection("chatHistory")
        .doc(startAfter)
        .get();
      query = query.startAfter(startAfterDoc);
    }

    query = query.limit(limit);

    const snapshot = await query.get();

    return snapshot.docs.map((doc) => new Chat({ id: doc.id, ...doc.data() }));
  }

  // Get all chats in a conversation
  static async findByChatId(chatId) {
    const snapshot = await db
      .collection("chatHistory")
      .where("chatId", "==", chatId)
      .orderBy("timestamp", "asc")
      .get();

    return snapshot.docs.map((doc) => new Chat({ id: doc.id, ...doc.data() }));
  }

  // Delete chat
  async delete() {
    if (!this.id) {
      throw new Error("Chat ID is required for deletion");
    }

    await db.collection("chatHistory").doc(this.id).delete();
    return true;
  }

  // Delete all chats for a user
  static async deleteByUserId(userId) {
    const snapshot = await db
      .collection("chatHistory")
      .where("userId", "==", userId)
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return snapshot.size;
  }

  // Search chats by keyword
  static async search(userId, keyword, options = {}) {
    const { limit = 20 } = options;

    // Note: Firestore doesn't support full-text search natively
    // This is a simple implementation. For production, use Algolia or similar.
    const snapshot = await db
      .collection("chatHistory")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(100) // Get more to filter locally
      .get();

    const keywordLower = keyword.toLowerCase();

    const results = snapshot.docs
      .map((doc) => new Chat({ id: doc.id, ...doc.data() }))
      .filter(
        (chat) =>
          chat.message.toLowerCase().includes(keywordLower) ||
          chat.response.toLowerCase().includes(keywordLower)
      )
      .slice(0, limit);

    return results;
  }

  // Get chat statistics for user
  static async getStats(userId) {
    const snapshot = await db
      .collection("chatHistory")
      .where("userId", "==", userId)
      .get();

    const chats = snapshot.docs.map((doc) => doc.data());

    const stats = {
      total: chats.length,
      textChats: chats.filter((c) => c.type === "text").length,
      imageChats: chats.filter((c) => c.type === "image").length,
      byMonth: {},
      withDrugInfo: chats.filter((c) => c.drugInfo).length,
    };

    // Group by month
    chats.forEach((chat) => {
      const date = chat.timestamp?.toDate() || new Date();
      const monthYear = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

      stats.byMonth[monthYear] = (stats.byMonth[monthYear] || 0) + 1;
    });

    return stats;
  }

  // Export chat to different formats
  async export(format = "text") {
    const formats = {
      text: this.toText(),
      json: this.toJSON(),
      html: this.toHTML(),
    };

    return formats[format] || this.toText();
  }

  toText() {
    return `
Chat ID: ${this.id}
User ID: ${this.userId}
Type: ${this.type}
Date: ${this.timestamp?.toLocaleString() || new Date().toLocaleString()}
Location: ${JSON.stringify(this.location) || "Not specified"}

Question: ${this.message}

Response: ${this.response}

${
  this.drugInfo
    ? "Drug Recommendations: " + JSON.stringify(this.drugInfo, null, 2)
    : ""
}
    `.trim();
  }

  toJSON() {
    return {
      id: this.id,
      userId: this.userId,
      message: this.message,
      response: this.response,
      type: this.type,
      location: this.location,
      imageUrl: this.imageUrl,
      drugInfo: this.drugInfo,
      timestamp: this.timestamp,
      createdAt: this.createdAt,
    };
  }

  toHTML() {
    return `
<div class="chat-export">
  <h3>Chat Conversation</h3>
  <p><strong>Date:</strong> ${this.timestamp?.toLocaleString()}</p>
  <p><strong>Type:</strong> ${this.type}</p>
  
  <div class="user-message">
    <strong>You:</strong>
    <p>${this.message}</p>
  </div>
  
  <div class="ai-response">
    <strong>AI Assistant:</strong>
    <p>${this.response}</p>
  </div>
  
  ${
    this.drugInfo
      ? `
  <div class="drug-recommendations">
    <h4>Recommended Treatments</h4>
    ${JSON.stringify(this.drugInfo, null, 2)}
  </div>
  `
      : ""
  }
</div>
    `.trim();
  }
}

module.exports = Chat;
