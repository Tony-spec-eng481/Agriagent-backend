const { db, FieldValue } = require("../config/firebase.config");

class Shop {
  constructor(data) {
    this.id = data.id || data.id === 0 ? data.id : null;
    this.name = data.name;
    this.address = data.address || null;
    this.location = data.location || null;
    this.latitude = data.latitude || data.lat || null;
    this.longitude = data.longitude || data.lng || null;
    this.phone = data.phone || null;
    this.email = data.email || null;
    this.category = data.category || null;
    this.description = data.description || null;
    this.openingHours = data.openingHours || null;
    this.website = data.website || null;
    this.isActive = data.isActive !== undefined ? data.isActive : true;
    this.rating = data.rating || 0;
    this.reviewCount = data.reviewCount || 0;
    this.createdAt = data.createdAt || new Date();
    this.updatedAt = data.updatedAt || new Date();
  }

  async save() {
    const payload = {
      name: this.name,
      address: this.address,
      location: this.location,
      latitude: this.latitude,
      longitude: this.longitude,
      phone: this.phone,
      email: this.email,
      category: this.category,
      description: this.description,
      openingHours: this.openingHours,
      website: this.website,
      isActive: this.isActive,
      rating: this.rating,
      reviewCount: this.reviewCount,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };

    if (this.id) {
      await db.collection("shops").doc(this.id).set(payload, { merge: true });
      return this.id;
    }

    const ref = await db.collection("shops").add({
      ...payload,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    this.id = ref.id;
    return ref.id;
  }

  static async findById(id) {
    const doc = await db.collection("shops").doc(id).get();
    if (!doc.exists) return null;
    return new Shop({ id: doc.id, ...doc.data() });
  }

  static async findAll(limit = 100) {
    const snapshot = await db.collection("shops").orderBy("createdAt", "desc").limit(limit).get();
    return snapshot.docs.map((d) => new Shop({ id: d.id, ...d.data() }));
  }
}

module.exports = Shop;
