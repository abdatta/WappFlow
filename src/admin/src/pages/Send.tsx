import React, { useState, useEffect } from "react";
import { sendMessage, fetchTopContacts, fetchAllContacts } from "../lib/api";
import type { Contact } from "../lib/types";

export default function Send() {
  const [phone, setPhone] = useState("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [text, setText] = useState("");
  const [disablePrefix, setDisablePrefix] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [topContacts, setTopContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchTopContacts().then((res) => setTopContacts(res.contacts));
    fetchAllContacts().then((res) => setAllContacts(res.contacts));
  }, []);

  const filtered = search
    ? allContacts.filter(
        (c) =>
          c.phone?.includes(search) ||
          c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = { text, disablePrefix };
      if (phone) payload.phone = phone;
      else if (selected) payload.name = selected.name;
      else throw new Error("Missing recipient");
      await sendMessage(payload);
      setStatus("Message sent successfully");
      setPhone("");
      setSelected(null);
      setText("");
    } catch (err: any) {
      setStatus(err.response?.data?.error || "Failed to send");
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Send Message</h1>
      <div className="bg-gray-800 p-4 rounded-lg space-y-4 max-w-md">
        <div>
          <h2 className="text-lg font-semibold mb-2">Top contacts</h2>
          {topContacts.length === 0 ? (
            <p className="text-sm text-gray-400">
              No contacts yet. Add or import contacts to get started.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {topContacts.map((c) => (
                <button
                  key={c.phone || c.name}
                  type="button"
                  onClick={() => {
                    setSelected(c);
                    setPhone(c.phone || "");
                  }}
                  className="bg-gray-700 hover:bg-gray-600 p-2 rounded text-left"
                >
                  <div className="font-medium">{c.name || c.phone}</div>
                  {c.phone && (
                    <div className="text-xs text-gray-400">{c.phone}</div>
                  )}
                </button>
              ))}
            </div>
          )}
          {allContacts.length > topContacts.length && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="text-blue-400 text-sm mt-2"
            >
              View all
            </button>
          )}
          {showAll && (
            <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
              {allContacts.map((c) => (
                <button
                  key={c.phone || c.name}
                  type="button"
                  onClick={() => {
                    setSelected(c);
                    setPhone(c.phone || "");
                    setShowAll(false);
                  }}
                  className="block w-full text-left bg-gray-700 hover:bg-gray-600 p-2 rounded"
                >
                  <div className="font-medium">{c.name || c.phone}</div>
                  {c.phone && (
                    <div className="text-xs text-gray-400">{c.phone}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block mb-1">Search contacts</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-700 text-white"
          />
          {search && (
            <div className="mt-2 max-h-40 overflow-auto space-y-2">
              {filtered.map((c) => (
                <button
                  key={c.phone || c.name}
                  type="button"
                  onClick={() => {
                    setSelected(c);
                    setPhone(c.phone || "");
                    setSearch("");
                  }}
                  className="block w-full text-left bg-gray-700 hover:bg-gray-600 p-2 rounded"
                >
                  <div className="font-medium">{c.name || c.phone}</div>
                  {c.phone && (
                    <div className="text-xs text-gray-400">{c.phone}</div>
                  )}
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-sm text-gray-400">No contacts found</p>
              )}
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1">Phone (E.164)</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setSelected(null);
              }}
              className="w-full px-3 py-2 rounded bg-gray-700 text-white"
            />
            {selected && !phone && (
              <p className="text-xs text-gray-400 mt-1">
                Selected: {selected.name}
              </p>
            )}
          </div>
          <div>
            <label className="block mb-1">Message</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-700 text-white"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="disablePrefixSend"
              checked={disablePrefix}
              onChange={(e) => setDisablePrefix(e.target.checked)}
            />
            <label htmlFor="disablePrefixSend">Disable prefix</label>
          </div>
          <button
            type="submit"
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
          >
            Send
          </button>
          {status && <p className="text-yellow-400 text-sm">{status}</p>}
        </form>
      </div>
    </div>
  );
}
