import React, { useEffect, useState } from "react";
import { fetchHealth } from "../lib/api";

interface Health {
  session: { ready: boolean; qr: string | null };
  sentToday: number;
  perMinAvailable: number;
  dailyCap: number;
  headless: boolean;
}

export default function DashboardMetrics() {
  const [health, setHealth] = useState<Health | null>(null);

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

  if (!health) return null;

  return (
    <div className="grid grid-cols-4 gap-4">
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
  );
}
