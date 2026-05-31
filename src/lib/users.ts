import { z } from "zod";

export const DMS_ROLES = ["owner", "manager", "sales"] as const;
export type DmsRole = (typeof DMS_ROLES)[number];

export const ROLE_LABELS: Record<DmsRole, string> = {
  owner:   "Owner",
  manager: "Manager",
  sales:   "Sales Representative",
};

export const userCreateSchema = z.object({
  email: z.string().email("Must be a valid email"),
  role: z.enum(DMS_ROLES),
  commission_percentage: z.number().min(0).max(100).optional(),
});

export const userUpdateSchema = z
  .object({
    role: z.enum(DMS_ROLES).optional(),
    commission_percentage: z.number().min(0).max(100).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine(
    (d) => Object.keys(d).length > 0,
    "At least one field must be provided"
  );
