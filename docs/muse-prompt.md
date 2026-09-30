Continue the daily Instagram and Threads social scout in this same thread. Keep the existing research goals and daily cadence. From now on, write selected opportunities into the existing Google workbook `Social Content Performance`, tab `Muse Daily Scout`. Resolve the exact workbook from the link I provide if duplicate titles exist. Do not create another workbook.

Only write to `Muse Daily Scout`. Do not modify `Post Metrics`, `Weekly Analysis`, `Experiments`, `Run Log`, sharing settings or any other tab. The dashboard reads this tab, so the contract below is fixed.

Row 1, columns A:N must be exactly this header, in this order:

```csv
schema_version,id,scouted_at,platform,opportunity_type,creator,source_url,topic,title,reason,score,draft_text,status,notes
```

Rules:
- `schema_version`: literal `1`.
- `id`: canonical UUID. Keep it stable across retries and for the same opportunity. Read existing rows first. Deduplicate by platform + opportunity type + canonical source URL. For ideas without a URL, deduplicate by the same underlying idea. If already present, skip it. Save the CSV for each run so retries reuse its IDs.
- `scouted_at`: actual scouting time, RFC 3339 with seconds and timezone, such as `2026-09-30T09:00:00-04:00`.
- `platform`: exactly `threads` or `instagram`.
- `opportunity_type`: exactly `reply`, `quote_post`, `content_idea` or `creator_watch`. `quote_post` is Threads only.
- `creator`: creator handle or name, max 200 characters. Required except for original `content_idea` rows.
- `source_url`: verified canonical HTTPS source URL without embedded credentials, max 2048 characters. Required except for original `content_idea` rows.
- `topic`: required, max 200 characters.
- `title`: required, max 300 characters.
- `reason`: required, max 2000 characters. Explain why this opportunity fits my audience and what I can contribute. Separate observed evidence from assumptions. Do not invent engagement metrics or claim guaranteed growth.
- `score`: required number expressed as text, from 0 to 10 inclusive, at most one decimal digit. No percent sign, units or explanatory text.
- `draft_text`: optional proposed reply, quote-post angle or original-content hook, max 4000 characters. Keep my voice direct, conversational and practical. Use empty text when a draft isn't useful.
- `status`: exactly `new` for new rows. I own later changes to `reviewed`, `used` and `dismissed`. Never overwrite those changes.
- `notes`: optional, max 2000 characters. Use it for relevant context or uncertainty.

Keep values as literal plain text. Blank optional values are empty cells. Do not use `null`, `N/A`, formulas or JSON. No NUL characters. Do not add, rename, reorder or remove columns. No merged cells or title rows. Never write personal messages, private client information or unrelated account data into this tab.

If using the Sheets API, append a 14-cell row using `valueInputOption=RAW`. If writing via the UI, preserve the existing text formatting and dropdown validation. If exporting CSV, use UTF-8 and RFC 4180 quoting: commas separate fields; fields containing commas, quotes or line breaks are quoted; embedded quotes are doubled. Every record has exactly 14 fields.

Before each run, verify the header exactly matches. Validate all records against these rules before writing. If the header changed, access fails, or the tab exceeds 10,000 data rows, stop the write and report the specific issue. Do not repair it by changing the schema or creating a replacement tab. If the tab is missing, report that rather than writing elsewhere.

After writing, read back the appended IDs and values. Report the count saved and any skipped duplicates or failed records. Don't claim the save succeeded until readback matches. Keep the results for manual review. Do not post, reply, follow, message, publish or schedule anything on my behalf.
