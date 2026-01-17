import type { Contact, CreateContactDto } from "@shared/types";
import { Download, Plus, Trash2, Upload, Users } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { api } from "../services/api";
import "./common.css"; // Reuse or create a common CSS

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Form state
  const [formData, setFormData] = useState<CreateContactDto>({
    name: "",
    number: "",
    email: "",
    companyName: "",
  });

  const loadContacts = async () => {
    try {
      const data = await api.getContacts();
      setContacts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Delete this contact?")) {
      await api.deleteContact(id);
      loadContacts();
    }
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    try {
      await api.createContact(formData);
      setShowCreate(false);
      setFormData({ name: "", number: "", email: "", companyName: "" });
      loadContacts();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = ["name", "number", "email", "companyName"];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      headers.join(",") +
      "\n" +
      "Example Name,1234567890,example@test.com,Example Corp";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "contacts_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      const lines = text.split(/\r\n|\n/);
      const headers = lines[0].split(",").map((h) => h.trim());

      // Simple validation of headers
      if (!headers.includes("name") || !headers.includes("number")) {
        alert("Invalid CSV format. Missing 'name' or 'number' columns.");
        return;
      }

      const contactsToUpload = [];
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Determine delimiter (comma or semicolon) - simplified for now assumes comma
        // A better parser would handle quoted strings containing commas.
        // Since I cannot install libraries, I'll do a basic split which is brittle but likely sufficient for the template.
        const values = line.split(",");

        const contact: any = {};
        headers.forEach((header, index) => {
          if (values[index]) {
            contact[header] = values[index].trim();
          }
        });

        if (contact.name && contact.number) {
          contactsToUpload.push(contact);
        }
      }

      if (contactsToUpload.length > 0) {
        try {
          const res = await api.createContactsBulk(contactsToUpload);
          let msg = `Imported ${res.success} contacts.`;
          if (res.failed > 0) {
            msg += ` Failed: ${res.failed}. Check console for details.`;
            console.error("Import errors:", res.errors);
          }
          alert(msg);
          loadContacts();
        } catch (err: any) {
          alert("Failed to upload: " + err.message);
        }
      } else {
        alert("No valid contacts found in file.");
      }

      // Reset input
      input.value = "";
    };

    reader.readAsText(file);
  };

  if (loading && contacts.length === 0) return <div>Loading...</div>;

  return (
    <div class="page-container">
      <div class="page-header">
        <h2>Contacts</h2>
        <div class="actions">
          <button class="btn-secondary" onClick={handleDownloadTemplate}>
            <Download size={18} /> Template
          </button>
          <label
            class="btn-secondary"
            style={{
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Upload size={18} /> Upload CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
          </label>
          <button
            class="btn-primary"
            onClick={() => setShowCreate(!showCreate)}
          >
            <Plus size={18} /> Add Contact
          </button>
        </div>
      </div>

      {showCreate && (
        <form class="create-form" onSubmit={handleCreate}>
          <h3>New Contact</h3>
          <div class="form-group">
            <label>Name</label>
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
            <label>Number (with country code)</label>
            <input
              type="text"
              value={formData.number}
              onInput={(e) =>
                setFormData({ ...formData, number: e.currentTarget.value })
              }
              required
              placeholder="e.g. 1234567890"
            />
          </div>
          <div class="form-group">
            <label>Email (Optional)</label>
            <input
              type="email"
              value={formData.email}
              onInput={(e) =>
                setFormData({ ...formData, email: e.currentTarget.value })
              }
            />
          </div>
          <div class="form-group">
            <label>Company Name (Optional)</label>
            <input
              type="text"
              value={formData.companyName}
              onInput={(e) =>
                setFormData({ ...formData, companyName: e.currentTarget.value })
              }
            />
          </div>
          <div class="form-actions">
            <button type="submit" class="btn-submit">
              Save
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

      {contacts.length === 0 ? (
        <p class="empty-state">No contacts yet.</p>
      ) : (
        <div class="card-list">
          {contacts.map((c) => (
            <div class="card" key={c.id}>
              <div class="card-header">
                <div class="card-title">
                  <Users size={16} />
                  <span>{c.name}</span>
                </div>
                <button onClick={() => handleDelete(c.id)} class="btn-icon">
                  <Trash2 size={16} />
                </button>
              </div>
              <div class="card-body">
                <p>
                  <strong>Number:</strong> {c.number}
                </p>
                {c.email && (
                  <p>
                    <strong>Email:</strong> {c.email}
                  </p>
                )}
                {c.companyName && (
                  <p>
                    <strong>Company:</strong> {c.companyName}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
