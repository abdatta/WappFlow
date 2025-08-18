import React, { useEffect, useState } from "react";
import { fetchHealth } from "../lib/api";

interface AlertItem {
  ts: number;
  message: string;
}

export default function Alerts() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [lastReady, setLastReady] = useState<boolean | null>(null);

  useEffect(() => {
    const interval = setInterval(check, 5000);
    check();
    return () => clearInterval(interval);
  }, []);

  async function check() {
    try {
      const health = await fetchHealth();
      if (lastReady === null) {
        setLastReady(health.session.ready);
        return;
      }
      if (health.session.ready !== lastReady) {
        const message = health.session.ready
          ? "Relinked / Ready"
          : "QR required or offline";
        setAlerts((prev) =>
          [{ ts: Date.now(), message }, ...prev].slice(0, 20),
        );
        setLastReady(health.session.ready);
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Alerts</h1>
      <ul className="space-y-2">
        {alerts.map((a) => (
          <li key={a.ts} className="bg-gray-800 p-3 rounded-lg">
            <div className="text-sm text-gray-400">
              {new Date(a.ts).toLocaleString()}
            </div>
            <div>{a.message}</div>
          </li>
        ))}
        {alerts.length === 0 && <p>No alerts yet.</p>}
      </ul>
    </div>
  );
}
