import { randomUUID } from "crypto";
import "dotenv/config";
import express from "express";
import path from "path";
import { WebSocketServer } from "ws";
import "./db/db.js"; // Initialize DB
import { schedulerService } from "./services/scheduler.js";
import { whatsappService } from "./services/whatsapp.js";
import { overrideConsole } from "./utils/logger.js";

// Override console methods with timestamp
overrideConsole();

const app = express();
const PORT = process.env.PORT || 3000;

// Validate required environment variables
if (!process.env.WHATSAPP_DEFAULT_CHAT) {
  console.error(
    "FATAL: WHATSAPP_DEFAULT_CHAT environment variable is not set. Please set it to the name of the chat used as the default landing page."
  );
  process.exit(1);
}

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

import historyRouter from "./api/history.js";
app.use("/api/history", historyRouter);

import feedbacksRouter from "./api/feedbacks.js";
app.use("/api/feedbacks", feedbacksRouter);

import settingsRouter from "./api/settings.js";
app.use("/api/settings", settingsRouter);

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
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  schedulerService.init();
  whatsappService.checkAuthOnce();
});

// WebSocket Server for WhatsApp Connection
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url!, `http://${request.headers.host}`);

  if (pathname === "/api/whatsapp/connect") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws) => {
  const connectionId = randomUUID();
  console.log(`WebSocket connection established: ${connectionId}`);

  whatsappService.startConnectionMonitoring(
    connectionId,
    (qrCode) => {
      // Send QR code to client
      ws.send(JSON.stringify({ type: "qr", qrCode }));
    },
    () => {
      // Authentication successful
      ws.send(JSON.stringify({ type: "authenticated" }));
      ws.close();
    },
    (error) => {
      // Error occurred
      ws.send(JSON.stringify({ type: "error", message: error }));
      ws.close();
    },
    (image) => {
      // Send stream image to client
      ws.send(JSON.stringify({ type: "stream", image }));
    }
  );

  ws.on("close", () => {
    console.log(`WebSocket connection closed: ${connectionId}`);
    whatsappService.stopConnectionMonitoring(connectionId);
  });

  ws.on("error", (error) => {
    console.error(`WebSocket error for ${connectionId}:`, error);
    whatsappService.stopConnectionMonitoring(connectionId);
  });
});
