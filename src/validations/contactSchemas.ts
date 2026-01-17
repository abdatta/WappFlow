import { z } from "zod";

export const createContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  number: z.string().min(1, "Number is required"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  companyName: z.string().optional().nullable(),
});

export type CreateContactSchema = z.infer<typeof createContactSchema>;
