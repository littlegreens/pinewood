module.exports = {
  apps: [
    {
      name: "pinewood-api",
      cwd: "/var/www/pinewood/server",
      script: "src/index.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
    },
  ],
};
