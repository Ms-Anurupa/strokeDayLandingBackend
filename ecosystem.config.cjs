// PM2 process file. Start with: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "strokeday-api",
      script: "src/server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "500M",
      time: true,
    },
  ],
};
