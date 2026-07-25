export type CSVColumn<T> = {
  key: string;
  label: string;
  value: (row: T) => string | number | null;
};

/**
 * Builds an RFC 4180-ish CSV string. Extracted as a pure function so
 * escaping/formatting can be unit tested without touching the DOM.
 */
export function toCSV<T>(rows: T[], columns: CSVColumn<T>[]): string {
  const escape = (raw: string) => {
    if (/[",\r\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
    return raw;
  };

  const header = columns.map((c) => escape(c.label)).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = c.value(row);
        return escape(v === null || v === undefined ? "" : String(v));
      })
      .join(","),
  );

  return [header, ...lines].join("\r\n");
}

/** Triggers a browser download of the given CSV text. */
export function downloadCSV(filename: string, csvText: string): void {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
