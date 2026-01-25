// debug-server.js
console.log("=== DEBUG START ===");
console.log("Node version:", process.version);
console.log("Current directory:", process.cwd());

try {
  console.log("Trying to load server.js...");

  // Try to load the server module first
  const serverPath = require.resolve("./server.js");
  console.log("Server file found at:", serverPath);

  // Try to require it
  const serverModule = require("./server.js");
  console.log("Server module loaded successfully");

  // If we get here, the issue is after loading
  console.log("The server might be crashing after initialization");
} catch (error) {
  console.error("=== LOAD ERROR ===");
  console.error("Error loading server.js:", error.message);
  console.error("Error stack:", error.stack);

  if (error.code === "MODULE_NOT_FOUND") {
    console.log("Missing dependencies? Checking package.json...");
    try {
      const packageJson = require("../package.json");
      console.log("Package name:", packageJson.name);
      console.log("Dependencies:", Object.keys(packageJson.dependencies || {}));
    } catch (e) {
      console.log("Cannot read package.json:", e.message);
    }
  }
}
