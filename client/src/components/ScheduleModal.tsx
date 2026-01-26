import type { Schedule } from "@shared/types";
import { X } from "lucide-preact";
import { useState, useEffect } from "preact/hooks";
import { api } from "../services/api";
import "./ScheduleModal.css";

interface ScheduleModalProps {
  schedule?: Schedule;
  mode: "edit" | "create";
  onClose: () => void;
  onSuccess: () => void;
}

export function ScheduleModal({
  schedule,
  mode,
  onClose,
  onSuccess,
}: ScheduleModalProps) {
  const [type, setType] = useState<"once" | "recurring">(
    schedule?.type === "recurring" ? "recurring" : "once"
  );
  const [contactName, setContactName] = useState(schedule?.contactName || "");
  const [message, setMessage] = useState(schedule?.message || "");
  const [dateTime, setDateTime] = useState("");
  const [intervalValue, setIntervalValue] = useState(
    schedule?.intervalValue?.toString() || "1"
  );
  const [intervalUnit, setIntervalUnit] = useState<
    "minute" | "hour" | "day" | "week" | "month"
  >((schedule?.intervalUnit as any) || "day");
  const [tolerance, setTolerance] = useState(
    schedule?.toleranceMinutes?.toString() || ""
  );
  const [submitting, setSubmitting] = useState(false);

  // Suggestions
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    api.getContactSuggestions().then(setSuggestions).catch(console.error);
  }, []);

  useEffect(() => {
    // Pre-fill dateTime from schedule in local time format
    const formatLocalDateTime = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const hours = String(date.getHours()).padStart(2, "0");
      const minutes = String(date.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    if (schedule?.scheduleTime) {
      const date = new Date(schedule.scheduleTime);
      setDateTime(formatLocalDateTime(date));
    } else if (schedule?.nextRun) {
      const date = new Date(schedule.nextRun);
      setDateTime(formatLocalDateTime(date));
    }
  }, [schedule]);

  const filteredSuggestions = suggestions.filter((s) =>
    s.toLowerCase().includes(contactName.toLowerCase())
  );

  const handleSelectSuggestion = (name: string) => {
    setContactName(name);
    setShowSuggestions(false);
  };

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
        if (!dateTime) throw new Error("Date & time is required");
        payload.scheduleTime = new Date(dateTime).toISOString();
      } else if (type === "recurring") {
        if (!dateTime) throw new Error("Start time is required");
        payload.scheduleTime = new Date(dateTime).toISOString();
        payload.intervalValue = parseInt(intervalValue);
        payload.intervalUnit = intervalUnit;
        if (tolerance) payload.toleranceMinutes = parseInt(tolerance);
      }

      if (mode === "edit" && schedule) {
        await api.updateSchedule(schedule.id, payload);
      } else {
        await api.createSchedule(payload);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Failed: " + err.message);
      setSubmitting(false);
    }
  };

  const title = mode === "edit" ? "Edit Schedule" : "Create from Schedule";

  return (
    <div class="schedule-modal-backdrop" onClick={onClose}>
      <div class="schedule-modal" onClick={(e) => e.stopPropagation()}>
        <div class="schedule-modal-header">
          <h3>{title}</h3>
          <button class="schedule-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div class="schedule-modal-body">
            <div class="type-selector">
              {["once", "recurring"].map((t) => (
                <button
                  key={t}
                  type="button"
                  class={type === t ? "active" : ""}
                  onClick={() => setType(t as any)}
                >
                  {t === "once" ? "Once" : "Recurring"}
                </button>
              ))}
            </div>

            <div class="form-group">
              <label>Contact Name</label>
              <input
                type="text"
                placeholder="John Doe"
                value={contactName}
                onInput={(e: any) => {
                  setContactName(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                required
                autocomplete="off"
              />
              {showSuggestions &&
                contactName &&
                filteredSuggestions.length > 0 && (
                  <ul class="suggestions-dropdown">
                    {filteredSuggestions.map((name) => (
                      <li
                        key={name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(name);
                        }}
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
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

            <div class="form-group">
              <label>{type === "once" ? "Date & Time" : "Start From"}</label>
              <input
                type="datetime-local"
                value={dateTime}
                onInput={(e: any) => setDateTime(e.target.value)}
                required
              />
            </div>

            {type === "recurring" && (
              <>
                <div class="form-group">
                  <label>Repeat Every</label>
                  <div class="interval-row">
                    <div>
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
                    <div>
                      <select
                        value={intervalUnit}
                        onChange={(e: any) => setIntervalUnit(e.target.value)}
                      >
                        <option value="minute">Minutes</option>
                        <option value="hour">Hours</option>
                        <option value="day">Days</option>
                        <option value="week">Weeks</option>
                        <option value="month">Months</option>
                      </select>
                    </div>
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
          </div>

          <div class="schedule-modal-footer">
            <button type="button" class="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" class="btn-submit" disabled={submitting}>
              {submitting
                ? mode === "edit"
                  ? "Saving..."
                  : "Creating..."
                : mode === "edit"
                  ? "Save Changes"
                  : "Create Schedule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
