import React, { useEffect, useState } from "react";
import {
  listSchedules,
  createSchedule,
  deleteSchedule,
  runSchedule,
  pauseSchedule,
  resumeSchedule,
  updateSchedule,
  fetchTopContacts,
  fetchAllContacts,
} from "../lib/api";
import type { Contact } from "../lib/types";

interface Schedule {
  id: string;
  phone: string;
  text: string;
  disablePrefix: boolean;
  firstRunAt: string;
  nextRunAt: string;
  intervalMinutes: number | null;
  active: boolean;
  lastRunAt: string | null;
}

export default function Scheduling() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState({
    phone: "",
    text: "",
    disablePrefix: false,
    firstRunAt: "",
    intervalMinutes: "" as string | number,
    active: true,
  });
  const [selected, setSelected] = useState<Contact | null>(null);
  const [topContacts, setTopContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [edit, setEdit] = useState<{
    id: string;
    intervalMinutes: string | number;
    firstRunAt: string;
  } | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const suggestions = form.phone
    ? allContacts.filter(
        (c) =>
          c.phone?.includes(form.phone) ||
          c.name.toLowerCase().includes(form.phone.toLowerCase()),
      )
    : showAll
      ? allContacts
      : topContacts;

  useEffect(() => {
    refresh();
    fetchTopContacts().then((res) => setTopContacts(res.contacts));
    fetchAllContacts().then((res) => setAllContacts(res.contacts));
  }, []);

  async function refresh() {
    try {
      const data = await listSchedules();
      setSchedules(data.items);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = {
        text: form.text,
        disablePrefix: form.disablePrefix,
        active: form.active,
      };
      let phone = form.phone;
      if (!phone && selected?.phone) phone = selected.phone;
      if (!phone) throw new Error("Missing phone");
      payload.phone = phone;
      if (form.firstRunAt)
        payload.firstRunAt = new Date(form.firstRunAt).toISOString();
      if (form.intervalMinutes)
        payload.intervalMinutes = Number(form.intervalMinutes);
      await createSchedule(payload);
      setStatus("Schedule created");
      setForm({
        phone: "",
        text: "",
        disablePrefix: false,
        firstRunAt: "",
        intervalMinutes: "",
        active: true,
      });
      setSelected(null);
      refresh();
    } catch (err: any) {
      setStatus(err.response?.data?.error || err.message || "Error creating");
    }
  }

  async function handleDelete(id: string) {
    await deleteSchedule(id);
    refresh();
  }
  async function handleRun(id: string) {
    await runSchedule(id);
    refresh();
  }
  async function handlePause(id: string) {
    await pauseSchedule(id);
    refresh();
  }
  async function handleResume(id: string) {
    await resumeSchedule(id);
    refresh();
  }
  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const payload: any = {};
    if (edit.firstRunAt)
      payload.firstRunAt = new Date(edit.firstRunAt).toISOString();
    if (edit.intervalMinutes)
      payload.intervalMinutes = Number(edit.intervalMinutes);
    await updateSchedule(edit.id, payload);
    setEdit(null);
    refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scheduling</h1>
      {/* Create form */}
      <div className="bg-gray-800 p-4 rounded-lg space-y-4 max-w-xl">
        <h2 className="text-lg font-medium">Create Schedule</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block mb-1">Contact</label>
            <input
              type="text"
              value={form.phone}
              onChange={(e) => {
                setForm({ ...form, phone: e.target.value });
                setSelected(null);
                if (e.target.value) setShowAll(false);
              }}
              className="w-full px-3 py-2 rounded bg-gray-700 text-white"
            />
            {suggestions.length > 0 ? (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                {suggestions.map((c) => (
                  <button
                    key={c.phone || c.name}
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setForm({ ...form, phone: c.phone || "" });
                    }}
                    className="block w-full text-left bg-gray-700 hover:bg-gray-600 p-2 rounded"
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
                <p className="text-sm text-gray-400 mt-2">
                  No contacts yet. Add or import contacts to get started.
                </p>
              )
            )}
            {!form.phone &&
              !showAll &&
              allContacts.length > topContacts.length && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="text-blue-400 text-sm mt-2"
                >
                  View all
                </button>
              )}
            {selected && !form.phone && (
              <p className="text-xs text-gray-400 mt-1">
                Selected: {selected.name}
              </p>
            )}
          </div>
          <div>
            <label className="block mb-1">Message</label>
            <textarea
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              className="w-full px-3 py-2 rounded bg-gray-700 text-white"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={form.disablePrefix}
              id="createDisablePrefix"
              onChange={(e) =>
                setForm({ ...form, disablePrefix: e.target.checked })
              }
            />
            <label htmlFor="createDisablePrefix">Disable prefix</label>
          </div>
          <div>
            <label className="block mb-1">First run (local)</label>
            <input
              type="datetime-local"
              value={form.firstRunAt}
              onChange={(e) => setForm({ ...form, firstRunAt: e.target.value })}
              className="w-full px-3 py-2 rounded bg-gray-700 text-white"
            />
          </div>
          <div>
            <label className="block mb-1">Interval (minutes, min 60)</label>
            <input
              type="number"
              min="0"
              step="60"
              value={form.intervalMinutes}
              onChange={(e) =>
                setForm({ ...form, intervalMinutes: e.target.value })
              }
              className="w-full px-3 py-2 rounded bg-gray-700 text-white"
            />
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
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
          >
            Create
          </button>
          {status && <p className="text-yellow-400 text-sm">{status}</p>}
        </form>
      </div>
      {/* List */}
      <div className="bg-gray-800 p-4 rounded-lg">
        <h2 className="text-lg font-medium mb-4">Existing Schedules</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2">Message</th>
                <th className="px-3 py-2">Prefix</th>
                <th className="px-3 py-2">Next Run</th>
                <th className="px-3 py-2">Interval</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.id} className="odd:bg-gray-700">
                  <td className="px-3 py-2 whitespace-nowrap">{s.phone}</td>
                  <td className="px-3 py-2 whitespace-nowrap max-w-xs truncate">
                    {s.text}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {s.disablePrefix ? "Off" : "On"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(s.nextRunAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {s.intervalMinutes ?? "None"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {s.active ? "Yes" : "No"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap space-x-2">
                    <button
                      onClick={() =>
                        setEdit({
                          id: s.id,
                          intervalMinutes: s.intervalMinutes ?? "",
                          firstRunAt: s.firstRunAt,
                        })
                      }
                      className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRun(s.id)}
                      className="bg-green-600 hover:bg-green-700 px-2 py-1 rounded"
                    >
                      Run
                    </button>
                    {s.active ? (
                      <button
                        onClick={() => handlePause(s.id)}
                        className="bg-yellow-600 hover:bg-yellow-700 px-2 py-1 rounded"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        onClick={() => handleResume(s.id)}
                        className="bg-purple-600 hover:bg-purple-700 px-2 py-1 rounded"
                      >
                        Resume
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Edit modal */}
      {edit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded-lg space-y-4 w-96">
            <h3 className="text-lg font-medium">Edit Schedule</h3>
            <form onSubmit={handleUpdate} className="space-y-3">
              <div>
                <label className="block mb-1">First run (local)</label>
                <input
                  type="datetime-local"
                  value={edit.firstRunAt}
                  onChange={(e) =>
                    setEdit({ ...edit, firstRunAt: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded bg-gray-700 text-white"
                />
              </div>
              <div>
                <label className="block mb-1">Interval (minutes)</label>
                <input
                  type="number"
                  min="0"
                  step="60"
                  value={edit.intervalMinutes}
                  onChange={(e) =>
                    setEdit({ ...edit, intervalMinutes: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded bg-gray-700 text-white"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEdit(null)}
                  className="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
