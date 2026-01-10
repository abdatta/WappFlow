import { useState, useEffect } from "preact/hooks";
import { api } from "../services/api";

export function Settings() {
  const [notifPermission, setNotifPermission] = useState(
    Notification.permission,
  );
  const [subscribed, setSubscribed] = useState(false);

  const enableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);

      if (permission === "granted") {
        const registration = await navigator.serviceWorker.ready;
        const publicKey = await api.getVapidKey();

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await api.subscribeToPush(subscription);
        setSubscribed(true);
        alert("Notifications enabled!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to enable notifications");
    }
  };

  // Helper function to convert VAPID key
  function urlBase64ToUint8Array(base64String: string) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  return (
    <div class="settings-page">
      <h2>Settings</h2>

      <div class="card">
        <h3>Notifications</h3>
        <p>
          Permission: <strong>{notifPermission}</strong>
        </p>

        {notifPermission !== "granted" ? (
          <button onClick={enableNotifications}>
            Enable Push Notifications
          </button>
        ) : (
          <p class="success">Notifications are enabled for this device.</p>
        )}
      </div>

      <div class="card">
        <h3>About</h3>
        <p>WappFlow v1.0.0</p>
        <p>Local-first WhatsApp Scheduler</p>
      </div>
    </div>
  );
}
