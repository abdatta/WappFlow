import type { CreateScheduleDto, Schedule } from "@shared/types";

const API_BASE = "/api";

export const api = {
  // Schedules
  getSchedules: async (): Promise<Schedule[]> => {
    const res = await fetch(`${API_BASE}/schedules`);
    if (!res.ok) throw new Error("Failed to fetch schedules");
    return res.json();
  },

  createSchedule: async (data: CreateScheduleDto): Promise<Schedule> => {
    const res = await fetch(`${API_BASE}/schedules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to create schedule");
    return res.json();
  },

  deleteSchedule: async (id: number): Promise<void> => {
    const res = await fetch(`${API_BASE}/schedules/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) throw new Error("Failed to delete schedule");
  },

  // WhatsApp
  getWhatsAppStatus: async (): Promise<{
    status: string;
    authenticated: boolean;
    qrCode: string | null;
  }> => {
    const res = await fetch(`${API_BASE}/whatsapp/status`);
    if (!res.ok) throw new Error("Failed to get status");
    return res.json();
  },

  reconnectWhatsApp: async (): Promise<void> => {
    const res = await fetch(`${API_BASE}/whatsapp/reconnect`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to reconnect");
  },

  // Notifications
  getVapidKey: async (): Promise<string> => {
    const res = await fetch(`${API_BASE}/notifications/vapid-public-key`);
    if (!res.ok) throw new Error("Failed to get VAPID key");
    const data = await res.json();
    return data.publicKey;
  },

  subscribeToPush: async (subscription: PushSubscription): Promise<void> => {
    const res = await fetch(`${API_BASE}/notifications/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    });
    if (!res.ok) throw new Error("Failed to subscribe");
  },
};
