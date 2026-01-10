// Shared Types

export interface Schedule {
  id: number;
  type: "instant" | "once" | "recurring";
  phoneNumber: string;
  message: string;
  scheduleTime?: string; // ISO string for 'once'
  cronExpression?: string; // for 'recurring' (legacy/advanced)
  intervalValue?: number;
  intervalUnit?: "minute" | "hour" | "day" | "week" | "month";
  toleranceMinutes?: number;
  status: "pending" | "active" | "completed" | "failed" | "cancelled";
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
  phoneNumber: string;
  message: string;
  scheduleTime?: string;
  cronExpression?: string;
  intervalValue?: number;
  intervalUnit?: "minute" | "hour" | "day" | "week" | "month";
  toleranceMinutes?: number;
}
