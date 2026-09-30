# Social scout integration

The existing printer endpoints, polling cadence and stored-print workflow are independent of `/api/social`. Google Sheets is the authoritative scout store. The dashboard reads the latest sheet snapshot every 60 seconds and caches it in memory, with shared in-flight reads. It does not write to the workbook. No SQLite migration is required: this recovered dashboard uses local JSON print receipts, not SQLite.

## Private connection

1. Enable the Google Sheets API in your Google Cloud project.
2. Create a service account for this reader and share only the intended workbook with its email as **Viewer**. Keep the workbook private. Do not publish it to the web.
3. Store its JSON credentials outside the repository. Set `GOOGLE_APPLICATION_CREDENTIALS` to the absolute local path in `.env.local`.
4. Set `SOCIAL_SHEET_ID` privately in `.env.local`. Set `SOCIAL_SHEET_TAB="Muse Daily Scout"`. Restart the local server.
5. Open the dashboard. Check `Social growth` says connected and the last successful read advances. New daily data becomes visible within a minute.

The reader uses Google's authentication library and the `spreadsheets.readonly` scope. Existing Google Application Default Credentials with sheet access and the required scope are supported too. The connected ChatGPT Drive account does not automatically authenticate this local app.

References: [Sheets values API](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get), [server authentication](https://developers.google.com/identity/protocols/oauth2/service-account).

For a credential-free preview, set `SOCIAL_DEMO=true` and restart. Only `examples/muse-daily-scout.csv` is loaded, with an explicit sample-data label. Demo defaults off and takes precedence over the sheet ID.

## Fixed v1 contract

Tab: `Muse Daily Scout`. Header: row 1, columns A:N, exact spelling and order. No title rows, merged cells, formulas or added columns. All values are plain text, including dates and score. Blank optional values are empty cells, never `null`, `N/A` or JSON.

```csv
schema_version,id,scouted_at,platform,opportunity_type,creator,source_url,topic,title,reason,score,draft_text,status,notes
```

| Column | Constraint |
| --- | --- |
| schema_version | Required, literal `1` |
| id | Required, canonical UUID, stable for the same opportunity across retries |
| scouted_at | Required, RFC 3339 timestamp with seconds and `Z` or explicit offset, e.g. `2026-09-30T09:00:00-04:00` |
| platform | Required: `threads` or `instagram` |
| opportunity_type | Required: `reply`, `quote_post`, `content_idea`, `creator_watch`. `quote_post` is Threads only |
| creator | Max 200 characters, required except for `content_idea` |
| source_url | Max 2048 characters, HTTPS without embedded credentials, required except for `content_idea` |
| topic | Required, max 200 characters |
| title | Required, max 300 characters |
| reason | Required, max 2000 characters, why this is useful |
| score | Required, 0 to 10 inclusive, at most one decimal digit, ASCII decimal point, no percent or units |
| draft_text | Optional, max 4000 characters, proposed reply or content hook for human review |
| status | Required: `new`, `reviewed`, `used`, `dismissed`. Muse writes `new`; the human owns later status changes |
| notes | Optional, max 2000 characters |

NUL characters are prohibited. Do not trim or rename headers. CSV uses UTF-8, comma delimiters, one record per opportunity, RFC 4180 quoting: quote fields containing commas, quotes or line breaks; double embedded quotes. Each record must have exactly 14 fields. The Sheets reader pads trailing omitted blank cells because the Google API omits them.

## Write ownership and deduplication

Muse writes only this tab. Before writing, read its header and existing `id` and source/type/platform values. Reuse an existing UUID for the same platform + opportunity type + canonical source URL. For original ideas without a URL, reuse the same UUID for the same idea rather than assigning a new ID on every run. If the row already exists, skip it. Never overwrite human statuses, delete rows, reorder columns or change the other analytics tabs. Keep the CSV produced for a run available to retry without regenerating IDs. Write with `valueInputOption=RAW` to keep text literal and prevent draft text being interpreted as formulas.

## Failure and size behavior

Header mismatch, malformed response, authentication failure and overflow fail the read. Individual invalid rows are skipped with row numbers and field names, without logging private contents. Duplicate IDs keep the first valid row and report later copies as invalid. An all-invalid batch fails rather than replacing the last good snapshot with an apparently empty result. A valid header-only sheet is a successful empty snapshot.

Reads are bounded to 10,000 data rows. The extra column and row in `A1:O10002` detect overflow; added content in O or row 10002 fails validation. CSV input is limited to 5 MB and 25,000 characters per record; sheet responses are rejected after reading if larger than 5 MB. Keep the tab within these bounds, archive older entries deliberately if needed. Memory cache survives refresh failures but not a process restart. After failures, cached results are explicitly marked stale with the last successful read time. No private data is written to disk by this integration.

All rows are rendered as escaped React text. Source links are validated HTTPS URLs and open with `noopener noreferrer`. Drafts are for review. The app never sends replies, posts, follows or messages.

## Maintenance

`lib/social/schema.ts` is the source of truth; update tests, examples, documentation and the writer contract together for a new version. Never mutate v1 in place. Introduce a new tab/schema version and an explicit migration if the contract changes. The MCP printer widget remains printer-focused; the combined view is the local web dashboard.
