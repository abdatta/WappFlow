// Shared Types

export interface Contact {
  name: string;
  phone?: string;
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
