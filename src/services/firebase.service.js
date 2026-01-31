const { db, storage, FieldValue } = require("../config/firebase.config");
const { v4: uuidv4 } = require("uuid");

/**
 * 🔒 Firestore sanitizer
 * Removes undefined values recursively (Firestore-safe)
 */
function removeUndefined(obj) {
  if (obj === null || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  }

  return Object.fromEntries(
    Object.entries(obj)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, removeUndefined(v)]),  
  );
}

class FirebaseService {
  constructor() {
    this.db = db;
    this.storage = storage;
    this.FieldValue = FieldValue;
  }

  // =========================
  // SAVE CHAT MESSAGE (CORE)
  // =========================
  async saveChatMessage(chatData) {
    const messageId = chatData.id || `msg_${Date.now()}_${uuidv4()}`;
    const timestamp = new Date();

    const payload = removeUndefined({
      id: messageId,
      userId: chatData.userId,
      chatId: chatData.chatId,
      role: chatData.role,
      content: chatData.content,
      imageUrl: chatData.imageUrl,
      fileUrl: chatData.fileUrl,
      fileName: chatData.fileName,
      fileType: chatData.fileType,
      metadata: chatData.metadata,
      timestamp,
      createdAt: this.FieldValue.serverTimestamp(),
    });

    await this.db.collection("chatMessages").doc(messageId).set(payload);

    await this.updateChatSession(chatData.chatId, chatData.userId, {
      lastMessage: chatData.content?.substring(0, 100) || "",
      lastMessageTime: timestamp,
      messageCount: FieldValue.increment(1),
    });

    return messageId;
  }

  // =========================
  // UPDATE / CREATE SESSION
  // =========================
  async updateChatSession(chatId, userId, updates) {
    const sessionRef = this.db.collection("chatSessions").doc(chatId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists) {
      await sessionRef.set(
        removeUndefined({
          id: chatId,
          userId,
          title: `Farm Chat ${new Date().toLocaleDateString()}`,
          lastMessage: updates.lastMessage || "",
          lastMessageTime: updates.lastMessageTime || new Date(),
          messageCount: 1,
          type: "text",
          createdAt: this.FieldValue.serverTimestamp(),
          updatedAt: this.FieldValue.serverTimestamp(),
        }),
      );
    } else {
      await sessionRef.update(
        removeUndefined({
          ...updates,
          updatedAt: this.FieldValue.serverTimestamp(),
        }),
      );
    }
  }

  // =========================
  // GET CHAT SESSIONS
  // =========================
  async getChatSessions(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    let query = this.db
      .collection("chatSessions")
      .where("userId", "==", userId)
      .orderBy("lastMessageTime", "desc")
      .limit(limit);

    if (offset > 0) {
      const snapshot = await this.db
        .collection("chatSessions")
        .where("userId", "==", userId)
        .orderBy("lastMessageTime", "desc")
        .limit(offset)
        .get();

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  // =========================
  // GET CHAT MESSAGES
  // =========================
  async getChatMessages(chatId, options = {}) {
    const { limit = 100 } = options;

    const snapshot = await this.db
      .collection("chatMessages")
      .where("chatId", "==", chatId)
      .orderBy("timestamp", "asc")
      .limit(limit)
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  }

  // =========================
  // DELETE CHAT SESSION
  // =========================
  async deleteChatSession(chatId, userId) {
    const sessionDoc = await this.db
      .collection("chatSessions")
      .doc(chatId)
      .get();

    if (!sessionDoc.exists || sessionDoc.data().userId !== userId) {
      throw new Error("Unauthorized");
    }

    const messagesSnapshot = await this.db
      .collection("chatMessages")
      .where("chatId", "==", chatId)
      .get();

    const batch = this.db.batch();
    messagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
    batch.delete(sessionDoc.ref);

    await batch.commit();
  }

  // =========================
  // USER STATS
  // =========================
  async getUserStats(userId) {
    const [chatCount, imageCount, documentCount, sessionsCount] =
      await Promise.all([
        this.db
          .collection("chatMessages")
          .where("userId", "==", userId)
          .count()
          .get(),
        this.db
          .collection("chatMessages")
          .where("userId", "==", userId)
          .where("imageUrl", "!=", null)
          .count()
          .get(),
        this.db
          .collection("chatMessages")
          .where("userId", "==", userId)
          .where("fileUrl", "!=", null)
          .count()
          .get(),
        this.db
          .collection("chatSessions")
          .where("userId", "==", userId)
          .count()
          .get(),
      ]);

    return {
      totalMessages: chatCount.data().count,
      imageAnalyses: imageCount.data().count,
      documentAnalyses: documentCount.data().count,
      chatSessions: sessionsCount.data().count,
    };
  }

  // =========================
  // UPLOAD FILE
  // =========================
  async uploadFile(buffer, userId, folder = "uploads", fileName = null) {
    const filename = fileName || `${folder}/${userId}/${uuidv4()}`;
    const file = this.storage.file(filename);

    await file.save(buffer, {
      metadata: {
        contentType: this.getContentType(filename),
        metadata: {
          userId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    await file.makePublic();
    return `https://storage.googleapis.com/${this.storage.name}/${filename}`;
  }

  getContentType(filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const types = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      pdf: "application/pdf",
      txt: "text/plain",
      csv: "text/csv",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    return types[ext] || "application/octet-stream";
  }

  // Alias for chat/images and image analysis uploads
  async uploadImage(buffer, userId, folder = "chat-images", fileName = null) {
    return this.uploadFile(buffer, userId, folder, fileName);
  }

  async getUserImageAnalyses(userId, options = {}) {
    const { limit = 20, offset = 0 } = options;
    const snapshot = await this.db
      .collection("imageAnalysis")
      .where("userId", "==", userId)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  async deleteImageAnalysis(analysisId, userId) {
    const ref = this.db.collection("imageAnalysis").doc(analysisId);
    const doc = await ref.get();
    if (!doc.exists || doc.data().userId !== userId) {
      throw new Error("Unauthorized or analysis not found");
    }
    await ref.delete();
  }

  // =========================
  // LEGACY ADAPTER (SAFE)
  // =========================
  async saveChatHistory(data) {
    return this.saveChatMessage(
      removeUndefined({
        id: data.id,
        userId: data.userId,
        chatId: data.chatId,
        role: "user",
        content: data.message,
        imageUrl: data.imageUrl,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.type === "file" ? data.fileType : null,
        metadata: data.metadata,
        timestamp: data.timestamp,
      }),
    );
  }

  async getChatHistory(userId, options = {}) {
    return this.getChatSessions(userId, options);
  }
  // Add these methods to your FirebaseService class

  // =========================
  // CREATE CHAT SESSION
  // =========================
  async createChatSession(sessionData) {
    const sessionId = sessionData.id;

    const payload = removeUndefined({
      id: sessionId,
      userId: sessionData.userId,
      title:
        sessionData.title || `Farm Chat ${new Date().toLocaleDateString()}`,
      type: sessionData.type || "text",
      tags: sessionData.tags || [],
      lastMessage: "",
      lastMessageTime: null,
      messageCount: 0,
      createdAt: this.FieldValue.serverTimestamp(),
      updatedAt: this.FieldValue.serverTimestamp(),
    });

    await this.db.collection("chatSessions").doc(sessionId).set(payload);

    return sessionId;
  }

  // =========================
  // SAVE AI MESSAGE
  // =========================
  async saveAIMessage(chatData) {
    const messageId = chatData.id || `ai_${Date.now()}_${uuidv4()}`;
    const timestamp = new Date();

    const payload = removeUndefined({
      id: messageId,
      userId: chatData.userId,
      chatId: chatData.chatId,
      role: "assistant", // AI messages
      content: chatData.content,
      imageUrl: chatData.imageUrl,
      fileUrl: chatData.fileUrl,
      fileName: chatData.fileName,
      fileType: chatData.fileType,
      metadata: chatData.metadata,
      timestamp,
      createdAt: this.FieldValue.serverTimestamp(),
    });

    await this.db.collection("chatMessages").doc(messageId).set(payload);

    // Update session with AI's last message
    await this.db
      .collection("chatSessions")
      .doc(chatData.chatId)
      .update({
        lastMessage: chatData.content?.substring(0, 100) || "",
        lastMessageTime: timestamp,
        updatedAt: this.FieldValue.serverTimestamp(),
      });

    return messageId;
  }

  // =========================
  // UPDATE SESSION TITLE
  // =========================
  async updateSessionTitle(chatId, userId, title) {
    const sessionRef = this.db.collection("chatSessions").doc(chatId);
    const sessionDoc = await sessionRef.get();

    if (!sessionDoc.exists || sessionDoc.data().userId !== userId) {
      throw new Error("Unauthorized");
    }

    await sessionRef.update({
      title,
      updatedAt: this.FieldValue.serverTimestamp(),
    });
  }

  // =========================
  // GET OR CREATE SESSION
  // =========================
  async getOrCreateSession(userId, chatId, initialData = {}) {
    if (chatId) {
      const sessionRef = this.db.collection("chatSessions").doc(chatId);
      const sessionDoc = await sessionRef.get();

      if (sessionDoc.exists) {
        return {
          exists: true,
          session: sessionDoc.data(),
        };
      }
    }

    // Create new session
    const newChatId = chatId || `chat_${Date.now()}_${uuidv4()}`;
    const sessionData = {
      id: newChatId,
      userId,
      title: initialData.title || "Farm Chat",
      type: initialData.type || "text",
      tags: initialData.tags || [],
      lastMessage: "",
      lastMessageTime: null,
      messageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.db
      .collection("chatSessions")
      .doc(newChatId)
      .set({
        ...sessionData,
        createdAt: this.FieldValue.serverTimestamp(),
        updatedAt: this.FieldValue.serverTimestamp(),
      });

    return {
      exists: false,
      session: sessionData,
    };
  }
  // =========================
  // SAVE IMAGE ANALYSIS
  // =========================
  async saveImageAnalysis(data) {
    const analysisId = data.id || `analysis_${Date.now()}_${uuidv4()}`;

    const payload = removeUndefined({
      id: analysisId,
      userId: data.userId,
      chatId: data.chatId,
      imageUrl: data.imageUrl,
      analysis: data.analysis,
      drugInfo: data.drugInfo,
      location: data.location,
      timestamp: new Date(),
      createdAt: this.FieldValue.serverTimestamp(),
    });

    await this.db.collection("imageAnalysis").doc(analysisId).set(payload);
    return analysisId;
  }

  // =========================
  // GET IMAGE ANALYSIS
  // =========================
  async getImageAnalysis(analysisId) {
    const doc = await this.db.collection("imageAnalysis").doc(analysisId).get();

    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    };
  }
}

module.exports = new FirebaseService();
