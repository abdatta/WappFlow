import type { Broadcast, Contact, CreateBroadcastDto } from "@shared/types";
import { Megaphone, Plus, Trash2 } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { api } from "../services/api";
import "./common.css";

export function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [formData, setFormData] = useState<CreateBroadcastDto>({
    name: "",
    message: "",
    contactIds: [],
    scheduledTime: undefined,
    type: "instant",
    intervalValue: 1,
    intervalUnit: "day",
  });

  const loadData = async () => {
    try {
      const [bData, cData] = await Promise.all([
        api.getBroadcasts(),
        api.getContacts(),
      ]);
      setBroadcasts(bData);
      setContacts(cData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Delete this broadcast?")) {
      await api.deleteBroadcast(id);
      loadData();
    }
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try {
      if (formData.contactIds.length === 0) {
        alert("Please select at least one contact");
        return;
      }
      // Prepare payload
      const payload = { ...formData };
      if (payload.type === "instant") {
        payload.scheduledTime = undefined;
        payload.intervalValue = undefined;
        payload.intervalUnit = undefined;
      } else if (payload.type === "once") {
        if (!payload.scheduledTime) {
          alert("Please select a time");
          return;
        }
        payload.intervalValue = undefined;
        payload.intervalUnit = undefined;
      } else if (payload.type === "recurring") {
        if (!payload.scheduledTime) {
          alert("Please select a start time");
          return;
        }
      }
      await api.createBroadcast(payload);
      setShowCreate(false);
      setFormData({
        name: "",
        message: "",
        contactIds: [],
        scheduledTime: undefined,
        type: "instant",
        intervalValue: 1,
        intervalUnit: "day",
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const toggleContact = (id: number) => {
    const current = formData.contactIds;
    if (current.includes(id)) {
      setFormData({
        ...formData,
        contactIds: current.filter((cid) => cid !== id),
      });
    } else {
      setFormData({ ...formData, contactIds: [...current, id] });
    }
  };

  const toggleSelectAll = () => {
    if (formData.contactIds.length === contacts.length) {
      setFormData({ ...formData, contactIds: [] });
    } else {
      setFormData({ ...formData, contactIds: contacts.map((c) => c.id) });
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div class="page-container">
      <div class="page-header">
        <h2>Broadcasts</h2>
        <button class="btn-primary" onClick={() => setShowCreate(!showCreate)}>
          <Plus size={18} /> New Broadcast
        </button>
      </div>

      {showCreate && (
        <form class="create-form" onSubmit={handleCreate}>
          <h3>New Broadcast</h3>
          <div class="form-group">
            <label>Campaign Name</label>
            <input
              type="text"
              value={formData.name}
              onInput={(e) =>
                setFormData({ ...formData, name: e.currentTarget.value })
              }
              required
            />
          </div>

          <div class="form-group">
            <label>Type</label>
            <div class="type-selector">
              {(["instant", "once", "recurring"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  class={formData.type === t ? "active" : ""}
                  onClick={() => setFormData({ ...formData, type: t })}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {formData.type !== "instant" && (
            <div class="form-group">
              <label>
                {formData.type === "recurring"
                  ? "Start Time"
                  : "Scheduled Time"}
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledTime || ""}
                onInput={(e) =>
                  setFormData({
                    ...formData,
                    scheduledTime: e.currentTarget.value,
                  })
                }
                required
              />
            </div>
          )}

          {formData.type === "recurring" && (
            <div class="form-group" style={{ display: "flex", gap: "10px" }}>
              <div style={{ flex: 1 }}>
                <label>Repeat Every</label>
                <input
                  type="number"
                  min="1"
                  value={formData.intervalValue}
                  onInput={(e) =>
                    setFormData({
                      ...formData,
                      intervalValue: parseInt(e.currentTarget.value),
                    })
                  }
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label>Unit</label>
                <select
                  value={formData.intervalUnit}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      intervalUnit: e.currentTarget.value as any,
                    })
                  }
                  style={{ width: "100%", padding: "0.5rem" }}
                >
                  <option value="minute">Minutes</option>
                  <option value="hour">Hours</option>
                  <option value="day">Days</option>
                  <option value="week">Weeks</option>
                  <option value="month">Months</option>
                </select>
              </div>
            </div>
          )}

          <div class="form-group">
            <label>Message</label>
            <textarea
              value={formData.message}
              onInput={(e) =>
                setFormData({ ...formData, message: e.currentTarget.value })
              }
              required
              rows={3}
            />
          </div>

          <div class="form-group">
            <label>Recipients ({formData.contactIds.length} selected)</label>
            <div class="contact-selector">
              <div class="selector-actions">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  class="btn-small"
                >
                  {formData.contactIds.length === contacts.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              <div class="contact-list-scroll">
                {contacts.map((contact) => (
                  <label key={contact.id} class="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.contactIds.includes(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                    />
                    <span>
                      {contact.name} ({contact.number})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-submit">
              Create Broadcast
            </button>
            <button
              type="button"
              class="btn-cancel"
              onClick={() => setShowCreate(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {broadcasts.length === 0 ? (
        <p class="empty-state">No broadcasts yet.</p>
      ) : (
        <div class="card-list">
          {broadcasts.map((b) => (
            <div class={`card status-${b.status}`} key={b.id}>
              <div class="card-header">
                <div class="card-title">
                  <Megaphone size={16} />
                  <span>{b.name}</span>
                </div>
                <div class="card-actions">
                  <span class={`status-badge ${b.status}`}>{b.status}</span>
                  <button onClick={() => handleDelete(b.id)} class="btn-icon">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div class="card-body">
                <p class="message-preview">{b.message}</p>
                <div class="card-meta">
                  {b.scheduledTime && (
                    <p>
                      Scheduled: {new Date(b.scheduledTime).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
