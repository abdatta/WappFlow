import type { CreateScheduleDto, Schedule } from "@shared/types";

const API_BASE = "/api";

export const api = {
  // History
  getHistory: async (): Promise<any[]> => {
    const res = await fetch(`${API_BASE}/history`);
    if (!res.ok) throw new Error("Failed to fetch history");
    return res.json();
  },

  // Schedules
  getSchedules: async (): Promise<Schedule[]> => {
    const res = await fetch(`${API_BASE}/schedules`);
    if (!res.ok) throw new Error("Failed to fetch schedules");
    return res.json();
  },

  sendInstantMessage: async (data: {
    contactName: string;
    message: string;
  }): Promise<void> => {
    const res = await fetch(`${API_BASE}/whatsapp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to send message");
    }
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
    authenticated: boolean;
  }> => {
    const res = await fetch(`${API_BASE}/whatsapp/status`);
    if (!res.ok) throw new Error("Failed to get status");
    return res.json();
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
