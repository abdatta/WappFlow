import { useEffect, useState } from "preact/hooks";
import { api } from "../services/api";
import type { Schedule } from "@shared/types";
import { Trash2, RefreshCw, Zap, Clock } from "lucide-preact";
import { Link } from "wouter-preact";
import "./Schedules.css";

export function Schedules() {
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

  const formatFriendlyDate = (date: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const inputDate = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );

    const diffTime = inputDate.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    const timeStr = date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (diffDays === 0) {
      return `Today at ${timeStr}`;
    } else if (diffDays === 1) {
      return `Tomorrow at ${timeStr}`;
    } else if (diffDays === -1) {
      return `Yesterday at ${timeStr}`;
    } else if (diffDays > 1 && diffDays <= 7) {
      const dayName = date.toLocaleDateString([], { weekday: "long" });
      return `${dayName} at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString([], {
        month: "short",
        day: "numeric",
      });
      return `${dateStr} at ${timeStr}`;
    }
  };

  const getTimingText = (schedule: Schedule) => {
    const type = schedule.type;

    if (type === "instant") {
      if (schedule.lastRun) {
        const date = new Date(schedule.lastRun);
        return `Sent ${formatFriendlyDate(date)}`;
      }
      return "Sent instantly";
    }

    if (type === "once" && schedule.scheduleTime) {
      const date = new Date(schedule.scheduleTime);
      return `Scheduled for ${formatFriendlyDate(date)}`;
    }

    if (type === "recurring") {
      if (schedule.cronExpression) {
        return `Cron: ${schedule.cronExpression}`;
      }
      if (schedule.scheduleTime) {
        const time = new Date(schedule.scheduleTime).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        return `Every day at ${time}`;
      }
      return "Recurring schedule";
    }

    return "Scheduled";
  };

  if (loading && schedules.length === 0) return <div>Loading...</div>;

  return (
    <div class="schedules-page">
      <h2>Your Schedules</h2>

      {schedules.length === 0 ? (
        <p class="empty-state">
          No schedules yet.{" "}
          <Link href="/create" class="create-link">
            Create one!
          </Link>
        </p>
      ) : (
        <div class="schedule-list">
          {schedules.map((s) => (
            <div key={s.id} class={`schedule-card status-${s.status}`}>
              <div class="schedule-header">
                <div class="schedule-timing">
                  {getIcon(s.type)}
                  <span>{getTimingText(s)}</span>
                </div>
                <button onClick={() => handleDelete(s.id)} class="btn-icon">
                  <Trash2 size={18} />
                </button>
              </div>

              <div class="schedule-body">
                <p class="message-preview">{s.message}</p>
              </div>

              <div class="schedule-footer">
                <span class="phone-badge">{s.phoneNumber}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
