// Shared Types

export interface Contact {
  id: number;
  name: string;
  number: string;
  email?: string;
  companyName?: string;
  createdAt: string;
}

export interface Broadcast {
  id: number;
  name: string;
  message: string;
  status: "draft" | "scheduled" | "processing" | "completed" | "failed";
  scheduledTime?: string;
  type?: "instant" | "once" | "recurring";
  intervalValue?: number;
  intervalUnit?: "minute" | "hour" | "day" | "week" | "month";
  nextRun?: string;
  lastRun?: string;
  createdAt: string;
}

export interface BroadcastRecipient {
  id: number;
  broadcastId: number;
  contactId: number;
  status: "pending" | "sent" | "failed";
  sentAt?: string;
  error?: string;
}

export interface CreateContactDto {
  name: string;
  number: string;
  email?: string;
  companyName?: string;
}

export interface CreateBroadcastDto {
  name: string;
  message: string;
  contactIds: number[];
  scheduledTime?: string;
  type?: "instant" | "once" | "recurring";
  intervalValue?: number;
  intervalUnit?: "minute" | "hour" | "day" | "week" | "month";
}

export interface Schedule {
  id: number;
  type: "instant" | "once" | "recurring";
  contactName: string;
  message: string;
  scheduleTime?: string; // ISO string for 'once'
  intervalValue?: number;
  intervalUnit?: "minute" | "hour" | "day" | "week" | "month";
  toleranceMinutes?: number;
  status:
    | "pending"
    | "active"
    | "completed"
    | "failed"
    | "cancelled"
    | "paused";
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
}

export interface MessageLog {
  id: number;
  scheduleId: number;
  status: "sent" | "failed";
  timestamp: string;
  error?: string;
}

export interface CreateScheduleDto {
  type: "instant" | "once" | "recurring";
  contactName: string;
  message: string;
  scheduleTime?: string;
  intervalValue?: number;
  intervalUnit?: "minute" | "hour" | "day" | "week" | "month";
  toleranceMinutes?: number;
}

export interface Feedback {
  id: number;
  content: string;
  isAddressed: boolean;
  createdAt: string;
}

export interface CreateFeedbackDto {
  content: string;
}

export interface UpdateFeedbackDto {
  content?: string;
  isAddressed?: boolean;
}
