import { useState } from "preact/hooks";
import { useLocation } from "wouter-preact";
import { api } from "../services/api";
import "./CreateSchedule.css";

export function CreateSchedule() {
  const [, setLocation] = useLocation();
  const [type, setType] = useState<"instant" | "once" | "recurring">("instant");
  const [contactName, setContactName] = useState("");
  const [message, setMessage] = useState("");
  const [dateTime, setDateTime] = useState("");

  // Recurring state
  const [intervalValue, setIntervalValue] = useState("1");
  const [intervalUnit, setIntervalUnit] = useState<
    "minute" | "hour" | "day" | "week" | "month"
  >("day");
  const [startDateTime, setStartDateTime] = useState("");
  const [tolerance, setTolerance] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload: any = {
        type,
        contactName,
        message,
      };

      if (type === "once") {
        payload.scheduleTime = new Date(dateTime).toISOString();
      } else if (type === "recurring") {
        if (!startDateTime) throw new Error("Start time is required");
        // We use nextRun as the start time (this will be mapped in backend/type)
        // Actually, shared types say nextRun is on Schedule, not DTO.
        // Wait, DTO doesn't have nextRun. We should probably map request->nextRun in backend or use `scheduleTime` field for initial start?
        // Let's check DTO. It has `scheduleTime`. I can use that for initial nextRun.
        payload.scheduleTime = new Date(startDateTime).toISOString();
        payload.intervalValue = parseInt(intervalValue);
        payload.intervalUnit = intervalUnit;
        if (tolerance) payload.toleranceMinutes = parseInt(tolerance);
      }

      await api.createSchedule(payload);
      setLocation("/");
    } catch (err: any) {
      alert("Failed to create schedule: " + err.message);
      setSubmitting(false);
    }
  };

  return (
    <div class="create-page">
      <h2>Create Schedule</h2>

      <div class="type-selector">
        {["instant", "once", "recurring"].map((t) => (
          <button
            key={t}
            class={type === t ? "active" : ""}
            onClick={() => setType(t as any)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div class="form-group">
          <label>Contact Name</label>
          <input
            type="text"
            placeholder="John Doe"
            value={contactName}
            onInput={(e: any) => setContactName(e.target.value)}
            required
          />
        </div>

        <div class="form-group">
          <label>Message</label>
          <textarea
            rows={4}
            value={message}
            onInput={(e: any) => setMessage(e.target.value)}
            required
          />
        </div>

        {type === "once" && (
          <div class="form-group">
            <label>Date & Time</label>
            <input
              type="datetime-local"
              value={dateTime}
              onInput={(e: any) => setDateTime(e.target.value)}
              required
            />
          </div>
        )}

        {type === "recurring" && (
          <>
            <div class="form-group">
              <label>Start From</label>
              <input
                type="datetime-local"
                value={startDateTime}
                onInput={(e: any) => setStartDateTime(e.target.value)}
                required
              />
            </div>

            <div class="form-group" style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label>Repeat Every</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={intervalValue}
                  onInput={(e: any) => setIntervalValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (["e", "E", "+", "-", "."].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Unit</label>
                <select
                  value={intervalUnit}
                  onChange={(e: any) => setIntervalUnit(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--text)",
                    fontSize: "1rem",
                    height: "46px", // match input height approx
                  }}
                >
                  <option value="minute">Minutes</option>
                  <option value="hour">Hours</option>
                  <option value="day">Days</option>
                  <option value="week">Weeks</option>
                  <option value="month">Months</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Tolerance (Optional)</label>
              <input
                type="number"
                min="0"
                placeholder="Skip if late by X minutes"
                value={tolerance}
                onInput={(e: any) => setTolerance(e.target.value)}
              />
              <small>
                If the system is down and misses the run time by this many
                minutes, the run will be skipped instead of running late.
              </small>
            </div>
          </>
        )}

        <button type="submit" disabled={submitting}>
          {submitting
            ? type === "instant"
              ? "Sending..."
              : "Creating..."
            : type === "instant"
              ? "Send Now"
              : "Create Schedule"}
        </button>
      </form>
    </div>
  );
}
