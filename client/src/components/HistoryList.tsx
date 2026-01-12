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
                  log.error &&
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
