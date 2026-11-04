import { z } from "zod";

const email = z.string().trim().max(254).email("Enter a valid email address.");
export const registerSchema = z
  .object({
    display_name: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters.")
      .max(100),
    email,
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(128, "Use no more than 128 characters."),
  })
  .strict();
export const loginSchema = z
  .object({
    email,
    password: z.string().min(1, "Enter your password.").max(128),
  })
  .strict();
export const applicationSchema = z
  .object({
    organizer_name: z
      .string()
      .trim()
      .min(2, "Enter at least 2 characters.")
      .max(120, "Use no more than 120 characters."),
    contact_email: email,
    contact_phone: z
      .string()
      .trim()
      .regex(
        /^\+?[0-9 ()-]{7,25}$/,
        "Enter a valid phone number, including the country code.",
      )
      .refine((v) => {
        const n = v.replace(/\D/g, "").length;
        return n >= 7 && n <= 15;
      }, "Use 7 to 15 digits."),
    description: z
      .string()
      .trim()
      .min(30, "Tell us a little more (at least 30 characters).")
      .max(2000, "Use no more than 2,000 characters."),
  })
  .strict();
export const reviewSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    feedback: z.string().trim().max(2000).optional().default(""),
  })
  .strict()
  .refine((v) => v.decision !== "rejected" || v.feedback.length > 0, {
    path: ["feedback"],
    message: "Explain what the applicant needs to correct.",
  });
export const profileSchema = z
  .object({ display_name: z.string().trim().min(2).max(100) })
  .strict();
export const uuidSchema = z.uuid();
export const filterSchema = z.enum(["all", "pending", "approved", "rejected"]);
export const pageSchema = z.coerce.number().int().min(1).max(10000);
export type ApplicationInput = z.infer<typeof applicationSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
