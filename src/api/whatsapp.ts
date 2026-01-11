import { Router } from "express";
import { whatsappService } from "../services/whatsapp.js";

const router = Router();

router.get("/status", (req, res) => {
  res.json(whatsappService.getStatus());
});

export default router;
