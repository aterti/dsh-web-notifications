# dsh-web-notifications

A small, installable [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) plugin that alerts you — with a tone and a browser notification card — when something happens in an agent session while you are not looking at the tab.

## What it notifies

| Id                 | Fires when                                                                        | Card body                                                                                                               |
| ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `turnComplete`     | The agent finished tool calling and delivered the final answer of a turn          | First ~140 characters of the answer, markdown stripped, one line                                                        |
| `approvalRequired` | The agent asks permission to act                                                  | The agent's own stated reason, truncated on a word boundary                                                             |
| `agentStalled`     | Generation stopped because the output-token limit was hit                         | `The reply was cut off by the token limit. Type "continue" to resume.` plus `(N output tokens)` when the limit is known |
| `turnFailed`       | The turn died on a provider or network error, after retries were spent            | The failure message plus its stable code, e.g. `Rate limit exceeded (RATE_LIMIT)`                                       |
| `inputRequired`    | The agent stopped mid-task and is waiting on you: a question, or a plan to review | The question, or the plan's own heading titled `Plan ready for review`; ` (+N more)` when several questions were asked  |
| `goalComplete`     | A tracked goal reached its end                                                    | The goal's objective                                                                                                    |
| `goalBlocked`      | A goal stopped because the agent cannot continue without you (off by default)     | The reason the goal gave for stopping                                                                                   |

`turnFailed` starts on the same tone as `agentStalled` (`alarm`), and `goalComplete` on the same tone as `turnComplete` (`chime`); the Settings panel says so on each row and lets you give any type its own tone.

What never fires: intermediate assistant messages with tool calls, tool results, subagent turns (off by default), aborted turns (you stopped them, or a teardown did), turns a hook rejected before their first step, the closers written for a crashed or forked log, resume/history replay, plugin load, duplicate cards per turn, approval decisions (only the request itself), and policy auto-approvals. Reconnects never replay historical events: the trigger feed is live-only by construction.

## Install

From GitHub:

```sh
dsh plugin --profile web add github:aterti/dsh-web-notifications
```

From a local checkout:

```sh
dsh plugin --profile web add /path/to/dsh-web-notifications
```

The plugin registers a `Notifications` section in Settings. No dsh source changes are required; everything lives in the plugin.

**Reloading changed code:** dsh caches imported plugin modules per process. After changing the host half (`index.js`, `triggers.js`, `tones.js`, `config.js`, `text.js`, `tones/*.wav`) restart the dsh process (for example `systemctl restart dsh`); toggling the plugin off/on is not enough. After changing `client.js`, just refresh the browser page.

## Browsers

Supported: current Firefox and Chrome.

- Notification permission is only requested from an explicit button (browsers reject `requestPermission()` outside a user gesture); the live permission state is shown in Settings.
- The `Notification` API has no `sound` option, so tones play through one shared Web Audio context. After a page reload the context starts suspended until the first click/keypress; a "Click to enable sound" button appears if a tone is needed before any gesture.
- Cards use a per-type `tag`, so repeat spam collapses (Chrome replaces the previous card, Firefox while it is still on screen).
- Multiple tabs of the same browser dedupe through a `BroadcastChannel` claim window: exactly one tab shows the card and plays the tone per frame. Tabs in different browsers cannot see each other's channel and will each alert once.
- Clicking a card focuses the dsh tab; the plugin never types anything for you.
- When OS cards are impossible (permission denied, insecure context, unsupported browser), alerts degrade to in-app toasts plus tone.

## HTTPS behind a reverse proxy

Browser notifications require a secure context: serve dsh over HTTPS. A Caddy setup looks like:

```caddyfile
dsh.example.com {
    reverse_proxy 127.0.0.1:3080
}
```

Notes:

- Caddy obtains and renews certificates automatically for a public hostname.
- The plugin's tone files are served from the relative prefix `/notifications/tones/...`; the proxy must pass through all dsh paths at the site root. The notification stream rides dsh's own WebSocket at `/api/remote.mux`, which also needs the root path (no prefix stripping).
- Add the public host to the `trustedHosts` field of dsh's `client-connection` config, otherwise the browser origin is rejected.
- Plain HTTP on a LAN is a non-secure context: cards degrade to in-app toasts, tones still play.

## Configuration

All settings live in the `Notifications` section and apply without a restart.

| Field                   | Default  | Meaning                                                                       |
| ----------------------- | -------- | ----------------------------------------------------------------------------- |
| `enabled`               | `true`   | Master switch                                                                 |
| `volume`                | `70`     | Tone volume 0-100 (shared player)                                             |
| `muteWhenFocused`       | `false`  | Silence tones while this tab is focused                                       |
| `onlyWhenHidden`        | `true`   | Suppress cards while this tab is visible and focused (tone still plays)       |
| `maxBodyChars`          | `200`    | Card body cap for approval, failure, question, and goal bodies (hard max 250) |
| `subagentNotifications` | `false`  | Also notify for subagent sessions                                             |
| `toneMaxBytes`          | `512000` | Upload size cap per custom tone                                               |
| `toneMaxCount`          | `50`     | Cap on stored custom tones                                                    |
| `types.<id>.enabled`    | `true`   | Per-type switch (`goalBlocked` defaults to `false`)                           |
| `types.<id>.tone`       | per type | Tone id, `none`, or a custom tone                                             |

Per-type defaults: `turnComplete` chime, `approvalRequired` ping, `agentStalled` alarm, `turnFailed` alarm, `inputRequired` knock, `goalComplete` chime, `goalBlocked` triple-tick (disabled). Adding a type is an additive config change: a stored document without the new `types.<id>` subtree is filled from the defaults in `config.js`, so the config version does not move.

There is no rate window. Every event that passes its own dedupe emits a card and plays its tone; the only anti-duplication left is per-event identity (one card per turn, per approval request, per question, per goal revision).

Test and Preview: **Test** sends a real demo frame (OS card + tone, titled `Test: …`, rendered only in the tab that pressed it, never suppressed); **Preview** shows the card shape as an in-app toast; **Test tone** plays the selected tone alone. Demo frames ignore suppression.

Unknown config keys are reported in the host log, not swallowed. The config document is versioned (`version: 1`) with a migration path in `config.js`. The removed per-type `cooldownSeconds` and `toneEveryStall` keys are harmless leftovers: each one is reported once as unknown and can be deleted from the profile patch by hand.

## Tones

Seven presets (`chime`, `ping`, `bubble`, `marimba`, `knock`, `alarm`, `triple-tick`) are generated deterministically by `tools/generate-tones.mjs` and committed as WAVs. Custom tones: upload `.wav`, `.ogg`, or `.mp3`; the browser must decode the file and the host re-validates the container by magic bytes, the size cap, and the count cap. Names are sanitized to `[a-z0-9._-]` and spaces; uploads never overwrite (fresh id per upload). Files live under the plugin data directory (`~/.dsh/notifications/custom/` by default) and are served through the plugin-owned route. Deleting a tone that a type uses falls back to that type's default tone.

## Privacy

Approval reasons, question text, and provider failure messages are delivered to open tabs and logged only as request id plus length; the full text is never persisted by this plugin. The plugin writes nothing outside its data directory, phones home nowhere, and adds nothing to the model's context.

## Development

```sh
npm test          # trigger contracts, node:test, no build step
npm run lint      # eslint
npm run format    # prettier
```

The tests drive `installTriggers` through fake host seams — a listener-recording Cordis context, a config shaped like the volatile schema, a frame-recording controller — so they pin what fires, with what body and title, and what stays silent. Both question and approval observers must delegate with `next()`; the tests assert it, because claiming either waterfall would break the real answerer.

Adding a notification type touches five tables: `TYPE_DEFAULTS` in `config.js`, the trigger in `triggers.js`, `TITLES` (plus `TITLE_VARIANTS`) and `TEST_BODIES` in `index.js`, and `TYPE_IDS` / `TYPE_DEFAULT_TONES` / `PREVIEW_BODIES` / `TYPE_DEFAULTS` / `DICTIONARY` in `client.js` — the browser half imports nothing, so it mirrors the host tables by hand.

## Out of scope

OS daemons, browser extensions, MCP, cloud sync, desktop apps, extra sound packs, do-not-disturb schedules, mobile, and any change to dsh's approval policy or agent loop.

## License

MIT — see [LICENSE](LICENSE).
