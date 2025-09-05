import React, { useEffect, useState } from "react";
import { fetchHealth, sendMessage, testPush, subscribePush } from "../lib/api";

interface Health {
  session: { ready: boolean; qr: string | null };
  sentToday: number;
  perMinAvailable: number;
  dailyCap: number;
  headless: boolean;
}

export default function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [phone, setPhone] = useState("");
  const [text, setText] = useState("");
  const [enablePrefix, setEnablePrefix] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  async function refresh() {
    try {
      const data = await fetchHealth();
      setHealth(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    try {
      await sendMessage({ phone, text, enablePrefix });
      setMessage("Message sent");
      setPhone("");
      setText("");
    } catch (err: any) {
      setMessage(err.response?.data?.error || "Error sending");
    }
    refresh();
  }

  async function handleSubscribe() {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: undefined,
    });
    await subscribePush(subscription);
    alert("Subscribed to push notifications");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      {health && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-wa-panel p-4 rounded-lg">
            <div className="text-lg font-medium">Session</div>
            <p>{health.session.ready ? "Ready" : "Not ready"}</p>
          </div>
          <div className="bg-wa-panel p-4 rounded-lg">
            <div className="text-lg font-medium">Daily Usage</div>
            <p>
              {health.sentToday} / {health.dailyCap}
            </p>
          </div>
          <div className="bg-wa-panel p-4 rounded-lg">
            <div className="text-lg font-medium">Minute Tokens</div>
            <p>{health.perMinAvailable} available</p>
          </div>
          <div className="bg-wa-panel p-4 rounded-lg">
            <div className="text-lg font-medium">Headless</div>
            <p>{health.headless ? "Enabled" : "Disabled"}</p>
          </div>
        </div>
      )}
      <div className="bg-wa-panel p-4 rounded-lg space-y-4">
        <h2 className="text-lg font-medium">Quick Send</h2>
        <form onSubmit={handleSend} className="space-y-2">
          <div>
            <input
              type="text"
              placeholder="E.164 Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3 py-2 rounded bg-wa-hover text-white"
            />
          </div>
          <div>
            <textarea
              placeholder="Message"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 rounded bg-wa-hover text-white"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="enablePrefix"
              checked={enablePrefix}
              onChange={(e) => setEnablePrefix(e.target.checked)}
            />
            <label htmlFor="enablePrefix">Enable prefix</label>
          </div>
          <button
            type="submit"
            className="bg-wa-green hover:bg-wa-green/80 px-4 py-2 rounded text-wa-bg"
          >
            Send
          </button>
        </form>
        {message && <p className="text-sm text-yellow-400">{message}</p>}
      </div>
      <div className="flex gap-4">
        <button
          onClick={handleSubscribe}
          className="bg-wa-green hover:bg-wa-green/80 px-4 py-2 rounded text-wa-bg"
        >
          Subscribe to Push
        </button>
        <button
          onClick={() => testPush()}
          className="bg-wa-green hover:bg-wa-green/80 px-4 py-2 rounded text-wa-bg"
        >
          Test Push
        </button>
      </div>
    </div>
  );
}
