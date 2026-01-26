import type { Schedule } from "@shared/types";
import {
  Clock,
  Copy,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Trash2,
  Zap,
} from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { Link } from "wouter-preact";
import {
  DropdownMenu,
  type DropdownMenuItem,
} from "../components/DropdownMenu";
import { HistoryList } from "../components/HistoryList";
import { ScheduleModal } from "../components/ScheduleModal";
import { api } from "../services/api";
import "./Schedules.css";

export function Schedules() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"edit" | "create">("edit");
  const [selectedSchedule, setSelectedSchedule] = useState<
    Schedule | undefined
  >();

  // Active menu state
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

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

  const handleTogglePause = async (schedule: Schedule) => {
    try {
      const newStatus = schedule.status === "active" ? "paused" : "active";
      await api.updateScheduleStatus(schedule.id, newStatus);
      loadSchedules();
    } catch (err) {
      console.error("Failed to toggle pause status", err);
      alert("Failed to update status");
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setModalMode("edit");
    setModalOpen(true);
    setActiveMenuId(null);
  };

  const handleCreateFrom = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setModalMode("create");
    setModalOpen(true);
    setActiveMenuId(null);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedSchedule(undefined);
  };

  const handleModalSuccess = () => {
    loadSchedules();
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
      date.getDate()
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
                      (s.status === "pending" ||
                        s.status === "active" ||
                        s.status === "paused"))
                )
                .map((s) => (
                  <ScheduleCard
                    key={s.id}
                    schedule={s}
                    onDelete={handleDelete}
                    onTogglePause={handleTogglePause}
                    onEdit={handleEdit}
                    onCreateFrom={handleCreateFrom}
                    getIcon={getIcon}
                    getTimingText={getTimingText}
                    isMenuOpen={activeMenuId === s.id}
                    onMenuToggle={(open) => setActiveMenuId(open ? s.id : null)}
                  />
                ))}
              {schedules.filter(
                (s) =>
                  s.type === "recurring" ||
                  (s.type === "once" &&
                    (s.status === "pending" ||
                      s.status === "active" ||
                      s.status === "paused"))
              ).length === 0 && (
                <p class="section-empty">No active schedules</p>
              )}
            </div>
          </div>

          <HistoryList />
        </>
      )}

      {modalOpen && (
        <ScheduleModal
          schedule={selectedSchedule}
          mode={modalMode}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  );
}

function ScheduleCard({
  schedule,
  onDelete,
  onTogglePause,
  onEdit,
  onCreateFrom,
  getIcon,
  getTimingText,
  isMenuOpen,
  onMenuToggle,
}: {
  schedule: Schedule;
  onDelete: (id: number) => void;
  onTogglePause: (schedule: Schedule) => void;
  onEdit: (schedule: Schedule) => void;
  onCreateFrom: (schedule: Schedule) => void;
  getIcon: (type: string) => any;
  getTimingText: (s: Schedule) => string;
  isMenuOpen: boolean;
  onMenuToggle: (open: boolean) => void;
}) {
  const s = schedule;
  const isRecurring = s.type === "recurring";
  const isPaused = s.status === "paused";
  const isInstant = s.type === "instant";

  // Build menu items
  const menuItems: DropdownMenuItem[] = [];

  if (!isInstant) {
    menuItems.push({
      label: "Edit",
      icon: Pencil,
      onClick: () => onEdit(s),
    });
    menuItems.push({
      label: "Create from",
      icon: Copy,
      onClick: () => onCreateFrom(s),
    });
  }

  if (isRecurring) {
    menuItems.push({
      label: isPaused ? "Resume" : "Pause",
      icon: isPaused ? Play : Pause,
      onClick: () => onTogglePause(s),
    });
  }

  menuItems.push({
    label: "Delete",
    icon: Trash2,
    onClick: () => onDelete(s.id),
    danger: true,
  });

  return (
    <div
      class={`schedule-card status-${s.status} ${isMenuOpen ? "z-active" : ""}`}
    >
      <div class="schedule-header">
        <div class="schedule-timing">
          {getIcon(s.type)}
          <span>{getTimingText(s)}</span>
        </div>
        <div class="schedule-actions">
          {s.status === "paused" && <span class="badge-paused">Paused</span>}
          <DropdownMenu
            items={menuItems}
            isOpen={isMenuOpen}
            onOpenChange={onMenuToggle}
          />
        </div>
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
