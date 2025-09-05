import React, { useState, useEffect } from "react";
import { createSchedule } from "../lib/api";
import type { Contact } from "../lib/types";
import { ChevronDownIcon, PaperAirplaneIcon, ClockIcon } from "../lib/icons";
import RecipientInput from "../components/RecipientInput";

interface Props {
  onCreated: () => void;
  onSelectSend: () => void;
  recipients: Contact[];
  onRecipientsChange: (recipients: Contact[]) => void;
  text: string;
  onTextChange: (text: string) => void;
}

export default function ScheduleForm({
  onCreated,
  onSelectSend,
  recipients,
  onRecipientsChange,
  text,
  onTextChange,
}: Props) {
  const [form, setForm] = useState({
    enablePrefix: false,
    firstRunAt: "",
    intervalValue: "1" as string | number,
    intervalUnit: "hours" as "hours" | "days" | "weeks",
    active: true,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (recipients.length === 0) {
      setStatus("Please select at least one recipient.");
      return;
    }
    try {
      for (const recipient of recipients) {
        const payload: any = {
          text,
          enablePrefix: form.enablePrefix,
          active: form.active,
        };
        if (recipient.phone) {
          payload.phone = recipient.phone;
        } else {
          payload.name = recipient.name;
        }
        if (form.firstRunAt)
          payload.firstRunAt = new Date(form.firstRunAt).toISOString();
        if (form.intervalValue) {
          const mult =
            form.intervalUnit === "weeks"
              ? 10080
              : form.intervalUnit === "days"
                ? 1440
                : 60;
          payload.intervalMinutes = Number(form.intervalValue) * mult;
        }
        await createSchedule(payload);
      }
      setStatus(`Schedules created for ${recipients.length} recipient(s)`);
      setForm({
        enablePrefix: false,
        firstRunAt: "",
        intervalValue: "1",
        intervalUnit: "hours",
        active: true,
      });
      onRecipientsChange([]);
      onTextChange("");
      onCreated();
    } catch (err: any) {
      setStatus(err.response?.data?.error || err.message || "Error creating");
    }
  }

  const intervalLimits = {
    hours: 23,
    days: 6,
    weeks: 52,
  };

  const intervalNumbers = Array.from(
    { length: intervalLimits[form.intervalUnit] },
    (_, i) => i + 1,
  );

  return (
    <div className="bg-wa-panel p-4 rounded-lg space-y-4 max-w-md">
      <form onSubmit={handleCreate} className="space-y-4">
        <RecipientInput
          recipients={recipients}
          onRecipientsChange={onRecipientsChange}
        />
        <div>
          <label className="block mb-1">Message</label>
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            className="w-full px-3 py-2 rounded bg-wa-hover text-white"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block mb-1">First run at</label>
            <input
              type="datetime-local"
              value={form.firstRunAt}
              onChange={(e) => setForm({ ...form, firstRunAt: e.target.value })}
              className="w-full px-3 py-2 rounded bg-wa-hover text-white"
            />
          </div>
          <div>
            <label className="block mb-1">Interval</label>
            <div className="flex">
              <select
                value={form.intervalValue}
                onChange={(e) =>
                  setForm({ ...form, intervalValue: e.target.value })
                }
                className="w-1/2 px-3 py-2 rounded-l bg-wa-hover text-white"
              >
                {intervalNumbers.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <select
                value={form.intervalUnit}
                onChange={(e) =>
                  setForm({
                    ...form,
                    intervalUnit: e.target.value as any,
                    intervalValue: 1,
                  })
                }
                className="w-1/2 px-3 py-2 rounded-r bg-wa-hover text-white"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
                <option value="weeks">Weeks</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="enablePrefixSchedule"
            checked={form.enablePrefix}
            onChange={(e) =>
              setForm({ ...form, enablePrefix: e.target.checked })
            }
          />
          <label htmlFor="enablePrefixSchedule">Enable prefix</label>
        </div>
        <div className="flex justify-end">
          <div className="relative inline-flex">
            <button
              type="submit"
              className="bg-wa-green hover:bg-wa-green/80 px-3 py-2 rounded-l text-wa-bg flex items-center space-x-1"
            >
              <ClockIcon className="w-5 h-5" />
              <span>Schedule</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              className="bg-wa-green hover:bg-wa-green/80 px-2 rounded-r text-wa-bg border-l border-wa-bg flex items-center"
            >
              <ChevronDownIcon className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-40 bg-wa-panel rounded shadow-lg z-20">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onSelectSend();
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-wa-hover"
                >
                  <div className="flex items-center space-x-2">
                    <PaperAirplaneIcon className="w-5 h-5" />
                    <span>Send now</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
        {status && <p className="text-yellow-400 text-sm">{status}</p>}
      </form>
    </div>
  );
}
