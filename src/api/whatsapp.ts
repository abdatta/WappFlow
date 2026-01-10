import { Router } from "express";
import { whatsappService } from "../services/whatsapp.js";

const router = Router();

router.get("/status", (req, res) => {
  res.json(whatsappService.getStatus());
});

router.post("/reconnect", async (req, res) => {
  await whatsappService.destroy();
  await whatsappService.initialize();
  res.json({ success: true });
});

export default router;
