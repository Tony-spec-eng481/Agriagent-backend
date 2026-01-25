const { db, FieldValue } = require("../config/firebase.config");

class User {
  constructor(data) {
    this.uid = data.uid;
    this.email = data.email;
    this.name = data.name;
    this.phone = data.phone;
    this.userType = data.userType || "farmer";
    this.location = data.location;
    this.farmSize = data.farmSize;
    this.crops = data.crops || [];
    this.livestock = data.livestock || [];
    this.isVerified = data.isVerified || false;
    this.isAdmin = data.isAdmin || false;
    this.newsPreferences = data.newsPreferences || {};
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  // Save user to Firestore
  async save() {
    const userData = {
      uid: this.uid,
      email: this.email,
      name: this.name,
      phone: this.phone,
      userType: this.userType,
      location: this.location,
      farmSize: this.farmSize,
      crops: this.crops,
      livestock: this.livestock,
      isVerified: this.isVerified,
      isAdmin: this.isAdmin,
      newsPreferences: this.newsPreferences,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    await db.collection("users").doc(this.uid).set(userData, { merge: true });
    return this;
  }

  // Update user
  async update(updates) {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
    };

    await db.collection("users").doc(this.uid).update(updateData);

    // Update instance properties
    Object.assign(this, updateData);

    return this;
  }

  // Get user by ID
  static async findById(uid) {
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) {
      return null;
    }

    return new User(userDoc.data());
  }

  // Get user by email
  static async findByEmail(email) {
    const usersSnapshot = await db
      .collection("users")
      .where("email", "==", email.toLowerCase())
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return null;
    }

    const userDoc = usersSnapshot.docs[0];
    return new User(userDoc.data());
  }

  // Get all users (admin only)
  static async findAll(limit = 100) {
    const usersSnapshot = await db
      .collection("users")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    return usersSnapshot.docs.map((doc) => new User(doc.data()));
  }

  // Delete user
  async delete() {
    await db.collection("users").doc(this.uid).delete();
    return true;
  }

  // Add crop to user's profile
  async addCrop(crop) {
    if (!this.crops.includes(crop)) {
      this.crops.push(crop);
      await this.update({ crops: this.crops });
    }
    return this;
  }

  // Remove crop from user's profile
  async removeCrop(crop) {
    this.crops = this.crops.filter((c) => c !== crop);
    await this.update({ crops: this.crops });
    return this;
  }

  // Add livestock to user's profile
  async addLivestock(animal) {
    if (!this.livestock.includes(animal)) {
      this.livestock.push(animal);
      await this.update({ livestock: this.livestock });
    }
    return this;
  }

  // Remove livestock from user's profile
  async removeLivestock(animal) {
    this.livestock = this.livestock.filter((a) => a !== animal);
    await this.update({ livestock: this.livestock });
    return this;
  }

  // Update location
  async updateLocation(location) {
    this.location = location;
    await this.update({ location });
    return this;
  }

  // Update farm size
  async updateFarmSize(size) {
    this.farmSize = size;
    await this.update({ farmSize: size });
    return this;
  }

  // Get user statistics
  async getStats() {
    const chatCount = await db
      .collection("chatHistory")
      .where("userId", "==", this.uid)
      .count()
      .get();

    const imageCount = await db
      .collection("imageAnalysis")
      .where("userId", "==", this.uid)
      .count()
      .get();

    const favoriteCount = await db
      .collection("favorites")
      .where("userId", "==", this.uid)
      .count()
      .get();

    return {
      chatCount: chatCount.data().count,
      imageAnalysisCount: imageCount.data().count,
      favoriteCount: favoriteCount.data().count,
      farmSize: this.farmSize,
      cropsCount: this.crops.length,
      livestockCount: this.livestock.length,
    };
  }

  // Check if user is admin
  isUserAdmin() {
    return this.isAdmin === true;
  }

  // Check if user is verified
  isUserVerified() {
    return this.isVerified === true;
  }

  // Get user's agricultural profile summary
  getProfileSummary() {
    return {
      name: this.name,
      userType: this.userType,
      farmSize: this.farmSize,
      crops: this.crops,
      livestock: this.livestock,
      location: this.location,
      joined: this.createdAt.toLocaleDateString(),
    };
  }
}

module.exports = User;
