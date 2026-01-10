import express from "express";
import path from "path";
import "./db/db.js"; // Initialize DB
import { schedulerService } from "./services/scheduler.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve static files from client build in production
const CLIENT_BUILD_PATH = path.resolve("client/dist");
app.use(express.static(CLIENT_BUILD_PATH));

// API Routes
import schedulesRouter from "./api/schedules.js";
import whatsappRouter from "./api/whatsapp.js";

app.use("/api/schedules", schedulesRouter);
app.use("/api/whatsapp", whatsappRouter);

import notificationsRouter from "./api/notifications.js";
app.use("/api/notifications", notificationsRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Fallback to client index.html for SPA routing
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(CLIENT_BUILD_PATH, "index.html"));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  schedulerService.init();
});
