import type { Schedule } from "@shared/types";
import { Clock, RefreshCw, Trash2, Zap } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { Link } from "wouter-preact";
import { api } from "../services/api";
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
      const unit = schedule.intervalUnit || "day";
      const value = schedule.intervalValue || 1;
      const unitStr = value > 1 ? `${unit}s` : unit;
      const valuePrefix = value > 1 ? ` ${value}` : "";

      let text = `Every${valuePrefix} ${unitStr}`;

      if (schedule.nextRun) {
        text += `. Next Run: ${formatFriendlyDate(new Date(schedule.nextRun))}`;
      }

      return text;
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
        <>
          <div class="schedule-section">
            <h3>Upcoming & Recurring</h3>
            <div class="schedule-list">
              {schedules
                .filter(
                  (s) =>
                    s.type === "recurring" ||
                    (s.type === "once" &&
                      (s.status === "pending" || s.status === "active")),
                )
                .map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    onDelete={handleDelete}
                    getIcon={getIcon}
                    getTimingText={getTimingText}
                  />
                ))}
              {schedules.filter(
                (s) =>
                  s.type === "recurring" ||
                  (s.type === "once" &&
                    (s.status === "pending" || s.status === "active")),
              ).length === 0 && (
                <p class="section-empty">No active schedules</p>
              )}
            </div>
          </div>

          <div class="schedule-section history-section">
            <h3>History</h3>
            <div class="schedule-list">
              {schedules
                .filter(
                  (s) =>
                    s.type === "instant" ||
                    (s.type === "once" &&
                      (s.status === "completed" ||
                        s.status === "failed" ||
                        s.status === "cancelled")),
                )
                .map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    onDelete={handleDelete}
                    getIcon={getIcon}
                    getTimingText={getTimingText}
                  />
                ))}
              {schedules.filter(
                (s) =>
                  s.type === "instant" ||
                  (s.type === "once" &&
                    (s.status === "completed" ||
                      s.status === "failed" ||
                      s.status === "cancelled")),
              ).length === 0 && <p class="section-empty">No history</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ScheduleCard({
  schedule,
  onDelete,
  getIcon,
  getTimingText,
}: {
  schedule: Schedule;
  onDelete: (id: number) => void;
  getIcon: (type: string) => any;
  getTimingText: (s: Schedule) => string;
}) {
  const s = schedule;
  return (
    <div class={`schedule-card status-${s.status}`}>
      <div class="schedule-header">
        <div class="schedule-timing">
          {getIcon(s.type)}
          <span>{getTimingText(s)}</span>
        </div>
        <button onClick={() => onDelete(s.id)} class="btn-icon">
          <Trash2 size={18} />
        </button>
      </div>

      <div class="schedule-body">
        <p class="message-preview">{s.message}</p>
      </div>

      <div class="schedule-footer">
        <span class="phone-badge">{s.contactName}</span>
      </div>
    </div>
  );
}
