import { z } from "zod";

export const referenceSchema = z.object({
  name:         z.string().min(2, "Name is required"),
  phone:        z.string().min(7, "Phone number is required"),
  relationship: z.string().min(1, "Relationship is required"),
});

export const phase2Schema = z.object({
  phase2Token:        z.string().uuid("Invalid token"),
  appId:              z.string().uuid("Invalid application ID"),

  voidChequePath:     z.string().min(1, "Void cheque is required"),
  proofInsurancePath: z.string().min(1, "Proof of insurance is required"),
  payslipPath:        z.string().min(1, "Most recent payslip is required"),

  dealertrackConsent: z
    .boolean()
    .refine((v) => v, "You must consent to the DealerTrack credit bureau check"),

  references: z
    .array(referenceSchema)
    .length(2, "Exactly 2 references are required"),
});

export type Phase2FormData = z.infer<typeof phase2Schema>;
export type ReferenceData  = z.infer<typeof referenceSchema>;
