const fs = require("fs");

if (fs.existsSync("./.env")) {
  console.log(".env exists, not copying defaults");
} else {
  fs.copyFileSync("./default.env", "./.env");
  console.log("copied default .env");
}

if (fs.existsSync("./peers.yaml")) {
  console.log("peers.yaml exists, not copying defaults");
} else {
  fs.copyFileSync("./default.peers.yaml", "./peers.yaml");
  console.log("copied default peers.yaml");
}
