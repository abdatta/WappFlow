import { Activity, Bell, Info } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { api } from "../services/api";
import "./Settings.css";

export function Settings() {
  const [notifPermission, setNotifPermission] = useState(
    Notification.permission
  );
  const [tracingEnabled, setTracingEnabled] = useState(false);

  useEffect(() => {
    api
      .getSetting("enable_tracing")
      .then((val) => setTracingEnabled(val === "true"));
  }, []);

  const toggleTracing = async () => {
    const newVal = !tracingEnabled;
    setTracingEnabled(newVal);
    try {
      await api.updateSetting("enable_tracing", String(newVal));
    } catch (err) {
      setTracingEnabled(!newVal);
      console.error(err);
      alert("Failed to update setting");
    }
  };

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
        <h3>
          <Bell size={20} />
          Notifications
        </h3>
        <p>
          Permission:{" "}
          <span class={`permission-status ${notifPermission}`}>
            {notifPermission}
          </span>
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
        <h3>
          <Activity size={20} />
          Debugging
        </h3>
        <p>Enable Playwright tracing to debug message sending issues.</p>
        <div
          class="setting-row"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "1rem",
          }}
        >
          <span>Enable Tracing</span>
          <label class="switch">
            <input
              type="checkbox"
              checked={tracingEnabled}
              onChange={toggleTracing}
            />
            <span class="slider round"></span>
          </label>
        </div>
      </div>

      <div class="card about-section">
        <h3>
          <Info size={20} />
          About
        </h3>
        <p>WappFlow v1.0.0</p>
        <p>Local-first WhatsApp Scheduler</p>
      </div>
    </div>
  );
}
