import { z } from "zod";

export const createScheduleSchema = z.object({
  type: z.enum(["instant", "once", "recurring"]),
  phoneNumber: z.string().min(1, "Phone number is required"),
  message: z.string().min(1, "Message is required"),
  scheduleTime: z.string().optional().nullable(),
  cronExpression: z.string().optional().nullable(),
  intervalValue: z.number().optional().nullable(),
  intervalUnit: z.string().optional().nullable(),
  toleranceMinutes: z.number().optional().nullable(),
});

export type CreateScheduleSchema = z.infer<typeof createScheduleSchema>;
