import { useEffect, useState } from "preact/hooks";
import { api } from "../services/api";
import type { Schedule } from "@shared/types";
import { Trash2, RefreshCw, Zap, Clock } from "lucide-preact";

export function Dashboard() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSchedules = async () => {
    try {
      const data = await api.getSchedules();
      setSchedules(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
    // Auto refresh every 10s
    const interval = setInterval(loadSchedules, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Delete this schedule?")) {
      await api.deleteSchedule(id);
      loadSchedules();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "instant":
        return <Zap size={16} />;
      case "recurring":
        return <RefreshCw size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  if (loading && schedules.length === 0) return <div>Loading...</div>;

  return (
    <div class="dashboard-page">
      <h2>Your Schedules</h2>

      {schedules.length === 0 ? (
        <p style={{ textAlign: "center" }}>No schedules yet. Create one!</p>
      ) : (
        <div class="schedule-list">
          {schedules.map((s) => (
            <div key={s.id} class={`schedule-card status-${s.status}`}>
              <div class="schedule-header">
                <div class="schedule-type">
                  {getIcon(s.type)} <span>{s.type.toUpperCase()}</span>
                </div>
                <span class={`badge ${s.status}`}>{s.status}</span>
              </div>
              <div class="schedule-body">
                <p>
                  <strong>To:</strong> {s.phoneNumber}
                </p>
                <p class="message-preview">"{s.message}"</p>
                {s.scheduleTime && (
                  <p>
                    <small>
                      Runs at: {new Date(s.scheduleTime).toLocaleString()}
                    </small>
                  </p>
                )}
                {s.cronExpression && (
                  <p>
                    <small>Cron: {s.cronExpression}</small>
                  </p>
                )}
                {s.lastRun && (
                  <p>
                    <small>
                      Last Run: {new Date(s.lastRun).toLocaleString()}
                    </small>
                  </p>
                )}
              </div>
              <div class="schedule-actions">
                <button onClick={() => handleDelete(s.id)} class="btn-icon">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
