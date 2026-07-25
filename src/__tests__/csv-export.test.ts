import { describe, it, expect } from "vitest";
import { toCSV } from "../lib/csv-export";

type Row = { name: string; qty: number | null; note: string | null };

const COLUMNS = [
  { key: "name", label: "Name", value: (r: Row) => r.name },
  { key: "qty", label: "Qty", value: (r: Row) => r.qty },
  { key: "note", label: "Note", value: (r: Row) => r.note },
];

describe("toCSV", () => {
  it("writes a header row followed by one row per record", () => {
    const rows: Row[] = [
      { name: "Widget", qty: 3, note: null },
      { name: "Gadget", qty: 0, note: "fragile" },
    ];
    const csv = toCSV(rows, COLUMNS);
    expect(csv).toBe(
      ["Name,Qty,Note", "Widget,3,", "Gadget,0,fragile"].join("\r\n"),
    );
  });

  it("returns just the header for an empty row set", () => {
    expect(toCSV([], COLUMNS)).toBe("Name,Qty,Note");
  });

  it("renders null and undefined values as empty fields", () => {
    const csv = toCSV([{ name: "Widget", qty: null, note: null }], COLUMNS);
    expect(csv).toBe(["Name,Qty,Note", "Widget,,"].join("\r\n"));
  });

  it("quotes fields containing commas", () => {
    const csv = toCSV([{ name: "Widget, Deluxe", qty: 1, note: null }], COLUMNS);
    expect(csv.split("\r\n")[1]).toBe('"Widget, Deluxe",1,');
  });

  it("quotes and escapes fields containing double quotes", () => {
    const csv = toCSV([{ name: 'The "Best" Widget', qty: 1, note: null }], COLUMNS);
    expect(csv.split("\r\n")[1]).toBe('"The ""Best"" Widget",1,');
  });

  it("quotes fields containing newlines", () => {
    const csv = toCSV([{ name: "Widget", qty: 1, note: "line one\nline two" }], COLUMNS);
    expect(csv.split("\r\n")[1]).toBe('Widget,1,"line one\nline two"');
  });

  it("quotes header labels that need escaping", () => {
    const csv = toCSV([], [{ key: "a", label: 'Name, "short"', value: () => null }]);
    expect(csv).toBe('"Name, ""short"""');
  });
});
