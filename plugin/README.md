# FlashForge AD5X personal plugin

Implementation: MCP server, bundled React MCP Apps dashboard, global sidebar and conversation-panel entrypoints, plugin manifest and a short usage skill. Supports reviewed starts of stored prints. No slicing, cloud deployment or application database.

## Run

From `/path/to/flashforge-dashboard`:

```sh
npm install
npm run plugin:build
npm run plugin:http
```

The HTTP server listens only at `http://127.0.0.1:8787/mcp`. `npm run plugin:start` runs STDIO instead. The server loads the repository's `.env.local` itself, so it works regardless of the launching client's working directory. Node 22+ required. Put `PRINTER_IP`, `PRINTER_SERIAL`, and `PRINTER_CHECK_CODE` in that file locally; never paste credentials into chat. The printer must be in LAN mode on the same network.

`npm run plugin:preview` opens a development host at http://127.0.0.1:8788. It exercises the actual MCP process and UI bridge. It is not an installation in ChatGPT. The preview is loopback-only and must not be tunneled.

## Connect to ChatGPT

### Desktop local process

The bundled `mcp.json` uses a repository-relative path, requiring the repository root as working directory. Configure an absolute path for desktop hosts that launch elsewhere. A compatible desktop host can launch that server with Node. In ChatGPT desktop, Settings → MCP servers → Add server → STDIO: command `node`, argument `/path/to/flashforge-dashboard/plugin/dist/server.mjs`. Save and restart. This verifies local tools; rendering and sidebar availability depend on the host and plugin installation.

For a complete personal plugin, add this `plugin/` folder through a local marketplace using OpenAI's packaging instructions. The manifest and MCP wiring are included. Actual host import/installation is not yet verified. If the host launches from another directory, configure a local absolute path in its settings.

### Hosted ChatGPT

Hosted ChatGPT cannot call this Mac's loopback address directly. Keep the HTTP server running and register it through Secure MCP Tunnel if available to your account. In ChatGPT enable Developer mode, go to Plugins → plus → Connection → Tunnel and select the configured tunnel. Tunnel setup requires account/workspace association. Configure forwarding to `http://127.0.0.1:8787/mcp`, preserving a localhost upstream Host header. Do not forward the printer's own HTTP port.

If using another HTTPS forwarding service, add access control before exposing the endpoint. `MCP_BEARER_TOKEN` enables bearer checks on `/mcp`; configure the same token on the supported client connection. No public endpoint or tunnel has been provisioned by this build.

After registering the MCP connection, copy the actual `plugin_asdk_app...` technical ID. Use the official plugin-creator workflow to map that registered connection into a hosted personal plugin. Do not invent an ID or treat the local `mcp.json` as a hosted connection.

## Verify in ChatGPT

Ask “How is my AD5X print doing?” and “Open my printer dashboard.” Verify the tools and UI. Check idle, printing, paused and powered-off states against the printer display. Confirm the sidebar entry opens the dashboard. Credentials stay on the Mac; printer status returned through tools is visible to ChatGPT.

The UI polls only while visible, every three seconds after the previous request completes. Timeout errors clear telemetry and retry. Missing data stays unavailable. Pause/resume/cancel remain in Flash Studio.

## Maintenance

Run `npm run plugin:build` after changes. Run `npm run typecheck` and `npm test`. Refresh registered tool/resource metadata in ChatGPT after changes. Change the resource URI version for breaking UI changes. Source is in `plugin/src/`; generated files are in `plugin/dist/`.

## Official documentation

- [MCP server and UI](https://developers.openai.com/plugins/build/app-quickstart)
- [Sidebar extensions](https://developers.openai.com/plugins/build/extensions)
- [Package and install](https://developers.openai.com/plugins/build/plugins)
- [Connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Desktop MCP configuration](https://learn.chatgpt.com/docs/extend/mcp)

Verified locally: STDIO and HTTP MCP initialization, tool discovery/calls, UI resource, strict input validation, read-only annotations and embedded UI bridge. ChatGPT installation, Secure MCP Tunnel access, and physical printer integration remain unverified.
