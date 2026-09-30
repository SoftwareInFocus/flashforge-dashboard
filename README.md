# Personal dashboard: FlashForge AD5X and social scout

Small Next.js + TypeScript dashboard. Keep Flash Studio for slicing, profiles, sending jobs and print controls. Runs on loopback. No cloud deployment or application database. Private social data uses Google authentication on the server. The personal ChatGPT plugin lives in `plugin/`.

## Setup

1. Enable LAN Only mode on the AD5X. Connect this Mac to the same network. Flash Studio can continue using its LAN connection.
2. Copy `.env.example` to `.env.local`. Enter the printer IPv4 address, serial number and LAN check code from the printer. Port defaults to 8898. Never use `NEXT_PUBLIC_` for credentials.
3. Run `npm install`, then `npm run dev`.
4. Open http://127.0.0.1:8789.

After editing configuration, restart the server. Reserve the printer IP in your router if it changes frequently. For a production local run: `npm run build` followed by `npm start`. Both run scripts bind only to loopback. Do not expose the service through a tunnel or change the bind address without adding access controls.

## Behavior

Polls every 3 seconds after each request finishes. Server requests have a 5 second timeout; simultaneous tabs share in-flight reads and a 2 second cache. Offline states clear displayed telemetry, retain only last-online time, and retry automatically. Missing fields show unavailable rather than zero. Progress uses the documented fraction (0 to 1). Elapsed and remaining time use seconds. IFS slots appear only if provided by firmware. Raw credentials and full printer responses are never sent to the browser or logged.

Read-only V1: pause/resume/cancel are deliberately omitted until verified with the actual printer and firmware. Use Flash Studio for those operations.

## API choice

Uses native server-side fetch against POST `http://PRINTER_IP:8898/detail`, with `{serialNumber, checkCode}`. The published `@ghosttypes/ff-api` types describe the wire schema. Its info implementation uses a global Axios request without a timeout, so V1 uses direct REST for a bounded request and a deliberately small response. No TCP control session is acquired.

References: https://github.com/GhostTypes/ff-5mp-api-ts (Info module, FFPrinterDetail and MachineInfo mapping), https://github.com/Parallel-7/flashforge-api-docs/wiki/AD5X

## Checks

`npm run typecheck`, `npm test`, `npm run build`.

Physical printer integration is unverified until local credentials are configured. Firmware may omit fields or reject LAN credentials. No fabricated live/demo data is shown.

## ChatGPT plugin

See [plugin setup](plugin/README.md) for the MCP server, embedded dashboard, sidebar metadata and connection steps. Run `npm run plugin:build`, then `npm run plugin:http`. Hosted ChatGPT requires a registered tunnel or HTTPS connection. Plugin installation and physical printer integration remain unverified.

## Stored printer files and restarting a print

Open http://127.0.0.1:8789/ and use **Recent stored prints**. Select a file, review each tool’s IFS slot, then review the print. Confirm the bed is clear before choosing **Start this print**. Bed leveling defaults on. External-spool files require checking the spool yourself.

The printer’s REST API returns up to ten recent stored files, not a complete file catalog or a record of successful prints. File estimates are the original slice estimates. The adapter revalidates files, loaded slots, materials and readiness before a start. Color differences are shown during review. Failed or uncertain command delivery is never retried automatically. Check the physical printer and live status before sending another start.

Local start receipts are stored in `.local/printer-jobs/` and excluded from Git. An interrupted process can leave `start.lock`, blocking new starts. Only remove that lock after checking the printer and confirming no start request is in flight. Restart ChatGPT after updating the plugin to load the added tools.

## Daily social scout

The local web dashboard has separate printer and social views in a vertical icon menu. Social includes post metrics, weekly analysis, experiments, run logs and the daily scout from a validated private workbook snapshot. Configure either private Google access or a private GitHub workbook mirror. Run `npm run social:sync` to refresh it, or `npm run social:watch` for a running five-minute sync loop. See [configuration and exact v1 schema](docs/social-scout.md), [Muse writer prompt](docs/muse-prompt.md), and [fictional CSV sample](examples/muse-daily-scout.csv). Credentials, sheet IDs and real scout content belong only in local configuration or the private workbook, never in Git. Set `SOCIAL_DEMO=true` to preview clearly labeled samples. Printer monitoring works without social configuration.
