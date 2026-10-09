# dsh-web-notifications

Tone and browser-notification alerts for [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) in current Firefox and Chrome, for when an agent session needs you and you are not looking at the tab. Adds a `Notifications` section to Settings; no dsh source changes.

## Install

```sh
dsh plugin --profile web add github:aterti/dsh-web-notifications
```

Host-side edits need a dsh restart; `client.js` edits only need a browser refresh.

## What it notifies

Exactly the rows the Settings panel shows, in panel order:

| Row                     | Fires when                                                                  |
| ----------------------- | --------------------------------------------------------------------------- |
| Turn complete           | The agent finishes its final answer for a turn                              |
| Approval needed         | The agent asks permission, showing its stated reason                        |
| Waiting for your answer | The agent stops mid-task to wait for you: a question, or a plan to review   |
| Turn failed             | A turn dies on a provider or network error, after retries are spent         |
| Agent stalled           | A reply is cut off by the output-token limit                                |
| Goal complete           | A tracked goal finishes                                                     |
| Goal blocked            | A goal stops because the agent cannot continue without you. Off by default. |

## Settings

| Control                                          | What changes when you touch it                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Enable notifications**                         | Off means nothing at all: no cards, no tones, for any type.                                         |
| Per-type switch                                  | Drop one alert and keep the rest: keep _Approval needed_, silence _Turn complete_.                  |
| Per-type tone picker                             | Gives each alert its own sound, so you know which one fired without looking.                        |
| **Test**                                         | Sends a real alert, card and tone, exactly like a live one, in the tab you clicked.                 |
| **Preview**                                      | Shows what the card would look like, as a toast inside dsh. Nothing leaves the page.                |
| **Test tone**                                    | Plays that sound alone, so you can choose by ear.                                                   |
| **Tone volume**                                  | How loud the alert sounds, 0 to 100.                                                                |
| **Mute tones while this tab is focused**         | No sound while you are already looking at dsh. Cards still appear.                                  |
| **Only show cards when this tab is not focused** | No card while you are looking at the tab, since you already know. The tone still rings.             |
| **Maximum card body length**                     | How much of the agent's reason, question, or error text fits in the card before it is cut.          |
| **Also notify for subagent sessions**            | Off: sessions another agent spawned stay quiet, and only the session you are talking to alerts you. |
| **Custom tones**                                 | Your own sounds, then chosen per alert type.                                                        |
| **Reset to defaults**                            | Puts every setting back. Needs a second click, so it cannot happen by accident.                     |

## Tones

Eleven built in: **Chime**, **Ping**, **Bubble**, **Marimba**, **Knock**, **Alarm**, **Triple tick**, **Ding**, **Chimes**, **Ding deep**, **Dum**. Seven are generated in this repository; the last four come from a CC0 pack by Robin Lamb, credited in [tones/CREDITS.md](tones/CREDITS.md).

You can upload your own tones too (`.wav`, `.ogg`, or `.mp3`, up to 500 KB each and 50 stored by default) and they appear in every tone picker. Uploads are checked by their contents, not just by their extension.

## Privacy

Approval reasons, question text, and failure messages go to open tabs and are logged only as request id plus length; the plugin never persists them. It writes nothing outside its data directory, phones home nowhere, adds nothing to the model's context, and changes nothing in dsh's approval policy or agent loop.

MIT. See [LICENSE](LICENSE).
