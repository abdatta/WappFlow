import React, { useState, useEffect, useRef } from "react";
import { fetchTopContacts, fetchAllContacts } from "../lib/api";
import type { Contact } from "../lib/types";

interface Props {
  recipients: Contact[];
  onRecipientsChange: (recipients: Contact[]) => void;
}

export default function RecipientInput({
  recipients,
  onRecipientsChange,
}: Props) {
  const [search, setSearch] = useState("");
  const [topContacts, setTopContacts] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTopContacts().then((res) => setTopContacts(res.contacts));
    fetchAllContacts().then((res) => setAllContacts(res.contacts));
  }, []);

  const suggestions = (
    search
      ? allContacts.filter(
          (c) =>
            c.phone?.includes(search) ||
            c.name.toLowerCase().includes(search.toLowerCase()),
        )
      : showAll
        ? allContacts
        : topContacts
  ).filter(
    (c) => !recipients.find((r) => (r.phone || r.name) === (c.phone || c.name)),
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && search === "" && recipients.length > 0) {
      onRecipientsChange(recipients.slice(0, -1));
    }
  };

  const handleSelectContact = (contact: Contact) => {
    onRecipientsChange([...recipients, contact]);
    setSearch("");
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <label className="block mb-1">To</label>
      <div className="w-full px-3 py-1.5 rounded bg-wa-hover text-white flex items-center flex-wrap gap-1">
        {recipients.map((contact) => (
          <div
            key={contact.phone || contact.name}
            className="bg-wa-green text-wa-bg rounded-full px-2 py-0.5 flex items-center gap-1 text-sm"
          >
            {contact.name}
            <button
              type="button"
              onClick={() =>
                onRecipientsChange(
                  recipients.filter(
                    (r) =>
                      (r.phone || r.name) !== (contact.phone || contact.name),
                  ),
                )
              }
              className="bg-transparent hover:bg-wa-green/50 rounded-full leading-none"
              style={{ padding: "2px" }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={search}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value) setShowAll(false);
          }}
          onKeyDown={handleKeyDown}
          className="bg-transparent outline-none flex-grow min-w-[100px]"
          placeholder={recipients.length === 0 ? "Search contacts" : ""}
        />
      </div>
      {focused && (
        <div className="absolute z-10 mt-1 w-full bg-wa-hover max-h-48 overflow-y-auto rounded shadow-lg">
          {suggestions.length > 0 ? (
            <div className="space-y-2 p-1">
              {suggestions.map((c) => (
                <button
                  key={c.phone || c.name}
                  type="button"
                  onMouseDown={() => handleSelectContact(c)}
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
            !search &&
            recipients.length === 0 && (
              <p className="text-sm text-gray-400 p-2">
                No contacts yet. Add or import contacts to get started.
              </p>
            )
          )}
          {!search && !showAll && allContacts.length > topContacts.length && (
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
  );
}
