/**
 * Parses a fetch Response into `{ data, error }`.
 *
 * - JSON responses: returns the parsed body; surfaces `body.error` if present.
 * - Non-JSON responses: returns `{ data: null, error: "<status>: <text>" }`.
 */
export async function parseApiResponse<T>(
  res: Response,
): Promise<{ data: T | null; error?: string }> {
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = (await res.json()) as T & { error?: string };
    return { data, error: data.error };
  }

  const text = await res.text();
  const cleaned = text.replace(/\s+/g, " ").trim();
  return {
    data: null,
    error: cleaned
      ? `Request failed (${res.status}): ${cleaned.slice(0, 180)}`
      : `Request failed (${res.status})`,
  };
}
