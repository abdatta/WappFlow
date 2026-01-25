module.exports = {
  apps: [
    {
      name: "wapp-flow",
      script: "dist/src/server.js",
      env: {
        NODE_ENV: "production",
      },
      // Graceful restart settings
      wait_ready: true,
      listen_timeout: 10000,
    },
  ],
};
