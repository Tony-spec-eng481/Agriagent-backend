const { db } = require("./src/config/firebase.config"); // adjust path if needed

db.collection("test")
  .add({ hello: "world" })
  .then(() => console.log("✅ Firestore connection works!"))
  .catch(console.error);
