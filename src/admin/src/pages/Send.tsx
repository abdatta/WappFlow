import React, { useState } from "react";
import DashboardMetrics from "./DashboardMetrics";
import SendForm from "./SendForm";
import ScheduleForm from "./ScheduleForm";
import ScheduleList from "./ScheduleList";

export default function Send() {
  const [mode, setMode] = useState<"send" | "schedule">("send");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <DashboardMetrics />
      <div className="space-y-4">
        <div className="flex justify-end">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "send" | "schedule")}
            className="bg-wa-panel px-2 py-1 rounded text-white"
          >
            <option value="send">Send</option>
            <option value="schedule">Schedule Send</option>
          </select>
        </div>
        {mode === "send" ? (
          <SendForm />
        ) : (
          <ScheduleForm onCreated={() => setRefreshKey((k) => k + 1)} />
        )}
      </div>
      <ScheduleList refreshKey={refreshKey} />
    </div>
  );
}
