import React, { useState, useEffect } from "react";
import { sendMessage } from "../lib/api";
import type { Contact } from "../lib/types";
import { PaperAirplaneIcon, ChevronDownIcon, ClockIcon } from "../lib/icons";
import RecipientInput from "../components/RecipientInput";

interface Props {
  onSelectSchedule: () => void;
  recipients: Contact[];
  onRecipientsChange: (recipients: Contact[]) => void;
  text: string;
  onTextChange: (text: string) => void;
}

export default function SendForm({
  onSelectSchedule,
  recipients,
  onRecipientsChange,
  text,
  onTextChange,
}: Props) {
  const [enablePrefix, setEnablePrefix] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (recipients.length === 0) {
      setStatus("Please select at least one recipient.");
      return;
    }
    try {
      for (const recipient of recipients) {
        const payload: any = { text, enablePrefix };
        if (recipient.phone) payload.phone = recipient.phone;
        else payload.name = recipient.name;
        await sendMessage(payload);
      }
      setStatus(`Message sent to ${recipients.length} recipient(s)`);
      onRecipientsChange([]);
      onTextChange("");
    } catch (err: any) {
      setStatus(err.response?.data?.error || "Failed to send");
    }
  }

  return (
    <div className="bg-wa-panel p-4 rounded-lg space-y-4 max-w-md">
      <form onSubmit={handleSubmit} className="space-y-4">
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
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="enablePrefixSend"
            checked={enablePrefix}
            onChange={(e) => setEnablePrefix(e.target.checked)}
          />
          <label htmlFor="enablePrefixSend">Enable prefix</label>
        </div>
        <div className="flex justify-end">
          <div className="relative inline-flex">
            <button
              type="submit"
              className="bg-wa-green hover:bg-wa-green/80 px-3 py-2 rounded-l text-wa-bg flex items-center space-x-1"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
              <span>Send</span>
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
                    onSelectSchedule();
                  }}
                  className="block w-full text-left px-3 py-2 hover:bg-wa-hover"
                >
                  <div className="flex items-center space-x-2">
                    <ClockIcon className="w-5 h-5" />
                    <span>Schedule</span>
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
