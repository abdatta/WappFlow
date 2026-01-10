import { Router } from "express";
import { notificationService } from "../services/notifications.js";

const router = Router();

router.get("/vapid-public-key", (req, res) => {
  res.json({ publicKey: notificationService.getPublicKey() });
});

router.post("/subscribe", (req, res) => {
  const subscription = req.body;
  notificationService.addSubscription(subscription);
  res.status(201).json({});
});

router.post("/test-push", async (req, res) => {
  await notificationService.sendNotification({
    title: "Test Notification",
    body: "This is a test!",
  });
  res.json({ success: true });
});

export default router;
