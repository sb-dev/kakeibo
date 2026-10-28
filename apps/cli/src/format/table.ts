export type Row = readonly [label: string, value: string];

/** A plain two-column table: labels left-aligned, values right-aligned. No dependencies. */
export function renderTable(rows: readonly Row[]): string {
  const labelWidth = Math.max(0, ...rows.map(([label]) => label.length));
  const valueWidth = Math.max(0, ...rows.map(([, value]) => value.length));
  return rows.map(([label, value]) => `${label.padEnd(labelWidth)}  ${value.padStart(valueWidth)}`).join("\n");
}
