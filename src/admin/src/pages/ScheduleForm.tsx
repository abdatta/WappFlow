import React, { useState, useEffect } from "react";
import { createSchedule, fetchTopContacts, fetchAllContacts } from "../lib/api";
import type { Contact } from "../lib/types";

interface Props {
  onCreated: () => void;
}

export default function ScheduleForm({ onCreated }: Props) {
  const [form, setForm] = useState({
    phone: "",
    text: "",
    enablePrefix: false,
    firstRunAt: "",
    intervalValue: "" as string | number,
    intervalUnit: "minutes" as "minutes" | "hours" | "days",
    active: true,
  });
  const [selected, setSelected] = useState<Contact | null>(null);
  const [topContacts, setTopContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [focused, setFocused] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchTopContacts().then((res) => setTopContacts(res.contacts));
    fetchAllContacts().then((res) => setAllContacts(res.contacts));
  }, []);

  const suggestions = selected
    ? []
    : form.phone
      ? allContacts.filter(
          (c) =>
            c.phone?.includes(form.phone) ||
            c.name.toLowerCase().includes(form.phone.toLowerCase()),
        )
      : showAll
        ? allContacts
        : topContacts;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = {
        text: form.text,
        enablePrefix: form.enablePrefix,
        active: form.active,
      };
      if (selected) {
        if (selected.phone) payload.phone = selected.phone;
        else payload.name = selected.name;
      } else if (form.phone) {
        payload.phone = form.phone;
      } else {
        throw new Error("Missing contact");
      }
      if (form.firstRunAt)
        payload.firstRunAt = new Date(form.firstRunAt).toISOString();
      if (form.intervalValue) {
        const mult =
          form.intervalUnit === "hours"
            ? 60
            : form.intervalUnit === "days"
              ? 1440
              : 1;
        payload.intervalMinutes = Number(form.intervalValue) * mult;
      }
      await createSchedule(payload);
      setStatus("Schedule created");
      setForm({
        phone: "",
        text: "",
        enablePrefix: false,
        firstRunAt: "",
        intervalValue: "",
        intervalUnit: "minutes",
        active: true,
      });
      setSelected(null);
      setShowAll(false);
      onCreated();
    } catch (err: any) {
      setStatus(err.response?.data?.error || err.message || "Error creating");
    }
  }

  return (
    <div className="bg-wa-panel p-4 rounded-lg space-y-4 max-w-xl">
      <form onSubmit={handleCreate} className="space-y-3">
        <div className="relative">
          <label className="block mb-1">To</label>
          <input
            type="text"
            value={form.phone}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 100)}
            onChange={(e) => {
              setForm({ ...form, phone: e.target.value });
              setSelected(null);
              if (e.target.value) setShowAll(false);
            }}
            className="w-full px-3 py-2 rounded bg-wa-hover text-white"
          />
          {focused && (
            <div className="absolute z-10 mt-1 w-full bg-wa-hover max-h-48 overflow-y-auto rounded shadow-lg">
              {suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((c) => (
                    <button
                      key={c.phone || c.name}
                      type="button"
                      onMouseDown={() => {
                        setSelected(c);
                        setForm({
                          ...form,
                          phone: c.phone ? `${c.name} (${c.phone})` : c.name,
                        });
                      }}
                      className="block w-full text-left bg-wa-hover hover:bg-wa-panel p-2 rounded"
                    >
                      <div className="font-medium">{c.name}</div>
                      {c.phone && (
                        <div className="text-xs text-gray-400">{c.phone}</div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                !form.phone && (
                  <p className="text-sm text-gray-400 p-2">
                    No contacts yet. Add or import contacts to get started.
                  </p>
                )
              )}
              {!form.phone &&
                !showAll &&
                allContacts.length > topContacts.length && (
                  <button
                    type="button"
                    onMouseDown={() => setShowAll(true)}
                    className="text-wa-green text-sm px-2 py-1"
                  >
                    View all
                  </button>
                )}
            </div>
          )}
        </div>
        <div>
          <label className="block mb-1">Message</label>
          <textarea
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            className="w-full px-3 py-2 rounded bg-wa-hover text-white"
          />
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={form.enablePrefix}
            id="createEnablePrefix"
            onChange={(e) =>
              setForm({ ...form, enablePrefix: e.target.checked })
            }
          />
          <label htmlFor="createEnablePrefix">Enable prefix</label>
        </div>
        <div>
          <label className="block mb-1">First run (local)</label>
          <input
            type="datetime-local"
            value={form.firstRunAt}
            onChange={(e) => setForm({ ...form, firstRunAt: e.target.value })}
            className="w-full px-3 py-2 rounded bg-wa-hover text-white"
          />
        </div>
        <div>
          <label className="block mb-1">Interval</label>
          <div className="flex space-x-2">
            <input
              type="number"
              min="0"
              value={form.intervalValue}
              onChange={(e) =>
                setForm({ ...form, intervalValue: e.target.value })
              }
              className="w-full px-3 py-2 rounded bg-wa-hover text-white"
            />
            <select
              value={form.intervalUnit}
              onChange={(e) =>
                setForm({ ...form, intervalUnit: e.target.value as any })
              }
              className="px-2 py-2 rounded bg-wa-hover text-white"
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={form.active}
            id="createActive"
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
          />
          <label htmlFor="createActive">Active</label>
        </div>
        <button
          type="submit"
          className="bg-wa-green hover:bg-wa-green/80 px-4 py-2 rounded text-wa-bg"
        >
          Create
        </button>
        {status && <p className="text-yellow-400 text-sm">{status}</p>}
      </form>
    </div>
  );
}
