import { Download, FileSearch } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { api } from "../services/api";
import "./HistoryList.css";

interface Log {
  id: number;
  type: "instant" | "once" | "recurring";
  contactName: string;
  message: string;
  status: "sending" | "sent" | "failed";
  timestamp: number;
  error?: string;
  hasTrace?: boolean;
}

const formatHistoryTime = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isThisYear = date.getFullYear() === now.getFullYear();

  const datePart = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: isThisYear ? undefined : "numeric",
  });

  const timePart = date
    .toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .toLowerCase()
    .replace(" ", "");

  return `${datePart}, ${timePart}`;
};

export function HistoryList() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchHistory = async () => {
    try {
      const data = await api.getHistory();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading && logs.length === 0) return <div>Loading history...</div>;

  return (
    <div class="history-list">
      <h3>Message History</h3>
      {logs.length === 0 ? (
        <p class="empty-state">No message history yet.</p>
      ) : (
        <div class="history-grid">
          {logs.map((log) => (
            <div key={log.id} class={`history-item status-${log.status}`}>
              <div
                class="history-header"
                onClick={() =>
                  setExpandedId(expandedId === log.id ? null : log.id)
                }
              >
                <div class="history-main">
                  <span class={`type-badge type-${log.type}`}>{log.type}</span>
                  <span class="contact-name">{log.contactName}</span>
                  <span class="timestamp">
                    {formatHistoryTime(log.timestamp)}
                  </span>
                </div>
                <div class="history-status">
                  {log.hasTrace && (
                    <span
                      title="Trace available"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        color: "var(--text-secondary)",
                        marginRight: "0.5rem",
                      }}
                    >
                      <FileSearch size={16} />
                    </span>
                  )}
                  {log.status === "sending" && <span class="spinner">⏳</span>}
                  {log.status === "sent" && (
                    <span class="icon-success">✅</span>
                  )}
                  {log.status === "failed" && (
                    <span class="icon-failed">❌</span>
                  )}
                  <span class="status-text">{log.status}</span>
                </div>
              </div>
              <div class="history-body">
                <p class="message-content">{log.message}</p>
                {log.error && expandedId === log.id && (
                  <div class="error-details">
                    <strong>Error:</strong> {log.error}
                  </div>
                )}
                {log.hasTrace && expandedId === log.id && (
                  <div class="trace-download" style={{ marginTop: "0.5rem" }}>
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(
                            `/api/history/${log.id}/trace`,
                          );
                          if (!response.ok) throw new Error("Download failed");
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `trace_${log.id}.zip`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                        } catch (error) {
                          console.error("Error downloading trace:", error);
                          alert("Failed to download trace");
                        }
                      }}
                      class="btn-small"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        padding: "0.5rem 1rem",
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: "var(--text)",
                        textDecoration: "none",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      <Download size={16} />
                      Download Trace
                    </button>
                  </div>
                )}
                {!log.hasTrace && expandedId === log.id && (
                  <div
                    class="trace-missing"
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      fontStyle: "italic",
                    }}
                  >
                    No trace found
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
