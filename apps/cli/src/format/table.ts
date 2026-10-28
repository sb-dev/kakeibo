export type Row = readonly [label: string, value: string];

/** A plain two-column table: labels left-aligned, values right-aligned. No dependencies. */
export function renderTable(rows: readonly Row[]): string {
  const labelWidth = Math.max(0, ...rows.map(([label]) => label.length));
  const valueWidth = Math.max(0, ...rows.map(([, value]) => value.length));
  return rows.map(([label, value]) => `${label.padEnd(labelWidth)}  ${value.padStart(valueWidth)}`).join("\n");
}

/** A plain multi-column table with a header row. Columns listed in `right` are right-aligned. */
export function renderGrid(header: readonly string[], rows: readonly (readonly string[])[], right: readonly number[] = []): string {
  const widths = header.map((title, column) => Math.max(title.length, ...rows.map((row) => (row[column] ?? "").length)));
  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, column) => (right.includes(column) ? cell.padStart(widths[column] ?? 0) : cell.padEnd(widths[column] ?? 0)))
      .join("  ")
      .trimEnd();
  return [line(header), ...rows.map(line)].join("\n");
}
