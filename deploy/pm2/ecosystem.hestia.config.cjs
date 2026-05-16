/**
 * PM2 produzione Hestia — path da deploy/hestia.env
 * Avvio: pm2 start deploy/pm2/ecosystem.hestia.config.cjs
 */
const path = require("node:path");

const serverDir = "/home/gabverdini/web/pinewood.foundly.it/server";

module.exports = {
  apps: [
    {
      name: "pinewood-api",
      cwd: serverDir,
      script: "src/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
