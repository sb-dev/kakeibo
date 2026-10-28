# Synthetic CSV exports

Synthetic files for the `kakeibo import` tests and documentation. No row comes from a real bank export, and no named bank format is claimed.

## Generic CSV format

A generic export is UTF-8 text with one header row and one posted transaction per row:

```csv
Date,Description,Amount
2026-10-01,Salary ACME LTD,1500.00
2026-10-02,"Tesco Stores, Leeds",-50.00
```

- Delimiter: comma or semicolon. Quote fields that contain the delimiter; double a quote inside a quoted field.
- Posted date: `YYYY-MM-DD` or `DD/MM/YYYY`.
- Amount: a decimal point and at most two decimal places. Use either one signed column (state which sign means money out) or separate money-out and money-in columns.
- Optional columns: a source transaction ID, a currency (`GBP` only) and a stable reference.
- Blank lines are ignored. Other columns, such as a balance, are kept as raw values but not used.

## Files

| File | Purpose |
|---|---|
| `current-account-signed.csv` | Comma, `YYYY-MM-DD`, signed amounts where negative is money out; quoted commas, escaped quotes, a blank line, a `+` sign and an unused balance column. |
| `credit-card-positive-out.csv` | Semicolon, `DD/MM/YYYY`, signed amounts where positive is money out, a currency column and a quoted semicolon. |
| `debit-credit.csv` | Separate `Paid out` and `Paid in` columns; blank and `0.00` mean no amount. |
| `with-ids.csv` | Source transaction IDs, including two identical same-day purchases with different IDs. |
| `with-ids-conflict.csv` | Reuses `T-1002` with a different amount, so importing it after `with-ids.csv` must stop. |
| `invalid-rows.csv` | An impossible date, excess precision, an empty description and a non-numeric amount. |
| `non-gbp.csv` | A `EUR` row, which must be rejected. |
| `overlap-a.csv` | 1–9 October, including two identical `Corner Cafe` purchases on 5 October. Declare it complete for 1–10 October. |
| `overlap-b-reordered.csv` | A reordered superset of `overlap-a.csv` up to 14 October with the same two identical purchases. |
| `overlap-c-third-purchase.csv` | `overlap-a.csv` with a third identical purchase on 5 October. |
| `overlap-reduced.csv` | `overlap-a.csv` with one `Corner Cafe` purchase and the 7 October row removed. |
| `overlap-changed.csv` | `overlap-a.csv` with a changed amount (2 October) and a changed description (7 October). |
| `changed-mapping.csv` | The rows of `overlap-a.csv` with renamed, reordered columns, semicolons and `DD/MM/YYYY` dates: an incompatible mapping. |
