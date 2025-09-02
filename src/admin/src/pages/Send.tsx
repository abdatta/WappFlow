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
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchTopContacts().then((res) => setTopContacts(res.contacts));
    fetchAllContacts().then((res) => setAllContacts(res.contacts));
  }, []);

  const suggestions = selected
    ? []
    : phone
      ? allContacts.filter(
          (c) =>
            c.phone?.includes(phone) ||
            c.name.toLowerCase().includes(phone.toLowerCase()),
        )
      : showAll
        ? allContacts
        : topContacts;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload: any = { text, disablePrefix };
      if (selected) {
        if (selected.phone) payload.phone = selected.phone;
        else payload.name = selected.name;
      } else if (phone) {
        payload.phone = phone;
      } else {
        throw new Error("Missing recipient");
      }
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
      <div className="bg-wa-panel p-4 rounded-lg space-y-4 max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1">Contact</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setSelected(null);
                if (e.target.value) setShowAll(false);
              }}
              className="w-full px-3 py-2 rounded bg-wa-hover text-white"
            />
            {suggestions.length > 0 ? (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-2">
                {suggestions.map((c) => (
                  <button
                    key={c.phone || c.name}
                    type="button"
                    onClick={() => {
                      setSelected(c);
                      setPhone(c.phone ? `${c.name} (${c.phone})` : c.name);
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
              !phone && (
                <p className="text-sm text-gray-400 mt-2">
                  No contacts yet. Add or import contacts to get started.
                </p>
              )
            )}
            {!phone && !showAll && allContacts.length > topContacts.length && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-wa-green text-sm mt-2"
              >
                View all
              </button>
            )}
          </div>
          <div>
            <label className="block mb-1">Message</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 rounded bg-wa-hover text-white"
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
            className="bg-wa-green hover:bg-wa-green/80 px-4 py-2 rounded text-wa-bg"
          >
            Send
          </button>
          {status && <p className="text-yellow-400 text-sm">{status}</p>}
        </form>
      </div>
    </div>
  );
}
