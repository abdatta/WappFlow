import React, { useState } from "react";
import DashboardMetrics from "./DashboardMetrics";
import SendForm from "./SendForm";
import ScheduleForm from "./ScheduleForm";
import ScheduleList from "./ScheduleList";
import type { Contact } from "../lib/types";

export default function Send() {
  const [mode, setMode] = useState<"send" | "schedule">("schedule");
  const [refreshKey, setRefreshKey] = useState(0);
  const [recipients, setRecipients] = useState<Contact[]>([]);
  const [text, setText] = useState("");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Stats</h2>
        <DashboardMetrics />
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Messaging</h2>
        {mode === "send" ? (
          <SendForm
            onSelectSchedule={() => setMode("schedule")}
            recipients={recipients}
            onRecipientsChange={setRecipients}
            text={text}
            onTextChange={setText}
          />
        ) : (
          <ScheduleForm
            onCreated={() => setRefreshKey((k) => k + 1)}
            onSelectSend={() => setMode("send")}
            recipients={recipients}
            onRecipientsChange={setRecipients}
            text={text}
            onTextChange={setText}
          />
        )}
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Schedules</h2>
        <ScheduleList refreshKey={refreshKey} />
      </div>
    </div>
  );
}
