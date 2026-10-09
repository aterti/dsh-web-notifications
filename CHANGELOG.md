# Changelog

All notable changes to this project are documented here. The format follows
Keep a Changelog; this project follows semantic versioning.

## 0.2.0 - 2026-10-09

- Renamed the package from `dsh-notifications` to `dsh-web-notifications`. The
  old name is already published on npm by an unrelated macOS menu-bar plugin,
  and the bundle row's module name, the client module id, its remote
  descriptors, and the stream carrier all follow the package name. The profile
  row id stays `notifications`, so a stored settings document is untouched.
- Removed the per-type cooldown. Every event that passes its own dedupe now
  emits its card and plays its tone; the Settings rows lose the Cooldown
  field, and `agentStalled` loses `toneEveryStall` (it only ever meant "play
  the tone inside the cooldown window", and there is no window). The
  `toneOnly` frame flag disappears with it. What still prevents duplicates is
  per-event identity: one card per turn, per approval request, per question,
  per goal revision. A stored profile that still carries `cooldownSeconds` or
  `toneEveryStall` keeps working — each leftover key is reported once as
  unknown — and `CONFIG_VERSION` stays at 1 because the host half never
  writes config, so there is no in-place migration to run.
- Four new notification types cover the agent-end states the first three
  left unnotified:
  - `inputRequired` — the agent stopped mid-task and is waiting on you. It
    observes the `user-questions/request` waterfall without claiming it, so
    it covers `ask_user_question` and plan mode alike: a request tagged with
    the `plan-review` intent is a finished plan, titled `Plan ready for
review` and previewed by the plan's own heading.
  - `turnFailed` — the turn ended with reason `error` (a provider or
    transport failure once retries were spent), with the failure message and
    its stable code.
  - `goalComplete` / `goalBlocked` — the `goal/change` session event for the
    `complete` and `block` operations only; a resumed or edited goal's
    snapshot is never read as an ending. `goalBlocked` ships disabled.
- Deliberately still silent: `turn/end` reasons `aborted` (the user stopped
  it, or a teardown did), `blocked` (a hook rejected the turn before its
  first step), and `interrupted` / `forked` (closers written for a crashed or
  forked log, which a session resume appends through the same live feed).
- `turnFailed` starts on the same tone as `agentStalled`, and `goalComplete`
  on the same tone as `turnComplete`; each Settings row now says so, and
  every type can still be given its own tone.
- Frame titles gained per-type variants resolved on the host, so the browser
  never has to guess wording a trigger meant.
- Adding a type is an additive config change: a stored document without the
  new `types.<id>` subtree is filled from the single `TYPE_DEFAULTS` table,
  and the Settings row falls back to those defaults instead of breaking on a
  missing subtree.
- First automated tests: `npm test` runs `node --test` over the trigger
  contracts, driven through fake host seams (a listener-recording context, a
  volatile-shaped config, a frame-recording controller). `npm run lint`,
  `npm run format`, and `npm run format:check` were added alongside.
- Settings section redesigned for clarity: a prominent master switch and
  three cards — Notification types, Alert behavior, Custom tones — styled
  with dsh's settings design tokens (card fill/stroke, hairline field
  dividers, host-style switch capsules, focus rings). A quiet attention
  strip appears only when something needs it (permission not granted or
  blocked, insecure context, reconnecting stream).
- Permission state now follows browser UI changes live via the Permissions
  API (`PermissionStatus.onchange`), instead of a one-shot read at mount.
- Custom tones: styled upload button with drag-and-drop and an uploading
  state, per-tone audition, size chips, "used by" chips, inline rename
  (Enter saves, Esc cancels), and two-step delete that names the fallback.
- Checkboxes replaced with switches; volume shows a Muted chip at zero; reset
  moved to a danger-styled footer with the apply-instantly hint.

## 0.1.0

Initial release.

- Three notification triggers: `turn_complete` (final answer of a turn, first
  ~140 characters, markdown stripped), `approval_required` (the agent's own
  stated reason, word-boundary truncation, deduped by request id), and
  `agent_stalled` (output-token truncation only, with the token limit when
  known).
- Live-only event feed: reconnects, resumes, and plugin loads never replay
  historical events.
- Browser notification cards (Firefox and Chrome) with per-type tags,
  click-through focus, and in-app toast fallback when OS cards are
  impossible.
- Web Audio tone player: one shared context, volume control, decode cache,
  single voice, gesture unlock with an explicit affordance.
- Seven generated preset tones plus custom tone upload (`.wav`, `.ogg`,
  `.mp3`), validated by content sniffing, size, and count caps, stored under
  the plugin data directory and served from a plugin-owned relative route.
- Multi-tab deduplication through a BroadcastChannel claim window (one card
  and tone per frame per browser).
- Settings section with per-type controls, cooldowns, Test/Preview/Test-tone
  actions, live permission state, stream status, and two-step reset to
  defaults.
- Versioned config with hot-reloaded fields; unknown keys are reported, not
  swallowed.
