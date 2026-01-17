import { z } from "zod";

export const createBroadcastSchema = z.object({
  name: z.string().min(1, "Broadcast name is required"),
  message: z.string().min(1, "Message is required"),
  contactIds: z.array(z.number()).min(1, "At least one contact is required"),
  scheduledTime: z.string().optional().nullable(),
  type: z.enum(["instant", "once", "recurring"]).optional(),
  intervalValue: z.number().optional(),
  intervalUnit: z.enum(["minute", "hour", "day", "week", "month"]).optional(),
});

export type CreateBroadcastSchema = z.infer<typeof createBroadcastSchema>;
