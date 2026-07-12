import fs from "fs";
import path from "path";
const base = "C:/Users/vv/Documents/Pfmea生成/pfmea-generator";
const lines = fs.readFileSync(path.join(base, "src/services/aiClient.js"), "utf8").split("\n");

// Show both function endings
console.log("=== generatePfmeaWithAi ending ===");
for (let i = 160; i < 180; i++) {
  console.log((i+1) + ": " + lines[i]);
}
console.log("\n=== regeneratePfmeaRow ending ===");
for (let i = 195; i < 215; i++) {
  console.log((i+1) + ": " + lines[i]);
}
