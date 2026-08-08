import type { z } from "zod";

/**
 * Flattens a zod ZodError into a field -> first-message map. Mirrors the
 * shape already used by API routes' `parsed.error.flatten().fieldErrors`,
 * so the same shape flows FE-validate -> FE-submit -> API-response.
 */
export function zodErrorsToFieldMap(error: z.ZodError): Record<string, string> {
  const flat = error.flatten().fieldErrors as Record<string, string[] | undefined>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(flat)) {
    if (v && v[0]) out[k] = v[0];
  }
  // Top-level/refine errors with an empty path attach to a synthetic key so
  // callers can still surface them (e.g. as a form-level banner).
  const formErrors = error.flatten().formErrors;
  if (formErrors.length > 0) out._form = formErrors[0];
  return out;
}

/**
 * Runs `schema.safeParse(data)` and returns a field -> first-message map on
 * failure, or `{}` on success. Pure, no DOM dependency — safe to call from a
 * component's exported `validateXForm` function and unit-test directly.
 */
export function validateWithSchema<T>(schema: z.ZodType<T>, data: unknown): Record<string, string> {
  const parsed = schema.safeParse(data);
  if (parsed.success) return {};
  return zodErrorsToFieldMap(parsed.error);
}

/**
 * Converts a failed API response body's `errors: Record<string,string[]>`
 * shape (produced server-side by `parsed.error.flatten().fieldErrors`) into
 * the same `Record<string,string>` shape used by client-side `errors` state,
 * so server-caught validation issues merge into the same inline messages.
 */
export function apiFieldErrorsToMap(errors: Record<string, string[]> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!errors) return out;
  for (const [k, v] of Object.entries(errors)) {
    if (v && v[0]) out[k] = v[0];
  }
  return out;
}
