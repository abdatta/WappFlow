import axios from "axios";
import type { Contact } from "./types";

// A simple API wrapper around axios. The admin token is stored
// locally in memory for demonstration purposes. In a real admin
// application you would provide a login form or other secure
// mechanism to obtain the token.
let adminToken: string | null = null;

export function setAdminToken(token: string) {
  adminToken = token;
}

const instance = axios.create({
  baseURL: "/api",
  timeout: 10000,
});

instance.interceptors.request.use((config) => {
  if (adminToken) {
    config.headers = config.headers || {};
    config.headers["Authorization"] = `Bearer ${adminToken}`;
  }
  return config;
});

export async function fetchHealth() {
  const res = await instance.get("/health");
  return res.data;
}

export async function sendMessage(data: {
  phone: string;
  text: string;
  disablePrefix?: boolean;
}) {
  const res = await instance.post("/send", data);
  return res.data;
}

export async function subscribePush(subscription: any) {
  const res = await instance.post("/push/subscribe", subscription);
  return res.data;
}

export async function testPush() {
  const res = await instance.post("/push/test");
  return res.data;
}

export async function listSchedules() {
  const res = await instance.get("/schedules");
  return res.data;
}

export async function createSchedule(payload: any) {
  const res = await instance.post("/schedules", payload);
  return res.data;
}

export async function updateSchedule(id: string, payload: any) {
  const res = await instance.put(`/schedules/${id}`, payload);
  return res.data;
}

export async function deleteSchedule(id: string) {
  const res = await instance.delete(`/schedules/${id}`);
  return res.data;
}

export async function runSchedule(id: string) {
  const res = await instance.post(`/schedules/${id}/run`);
  return res.data;
}

export async function pauseSchedule(id: string) {
  const res = await instance.post(`/schedules/${id}/pause`);
  return res.data;
}

export async function resumeSchedule(id: string) {
  const res = await instance.post(`/schedules/${id}/resume`);
  return res.data;
}

export async function fetchTopContacts(
  n?: number,
): Promise<{ contacts: Contact[] }> {
  const res = await instance.get("/contacts/top", { params: { n } });
  return res.data;
}

export async function fetchAllContacts(): Promise<{ contacts: Contact[] }> {
  const res = await instance.get("/contacts/all");
  return res.data;
}
