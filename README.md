# dsh-web-notifications

Tone and browser-notification alerts for [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) in current Firefox and Chrome, for when an agent session needs you and you are not looking at the tab. Adds a `Notifications` section to Settings; no dsh source changes.

## Install

```sh
dsh plugin --profile web add github:aterti/dsh-web-notifications
```

Or from a local checkout:

```sh
dsh plugin --profile web add /path/to/dsh-web-notifications
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
| Goal blocked            | A goal stops because the agent cannot continue without you — off by default |

## Settings

| Control                                          | What it does                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| **Enable notifications**                         | Master switch                                                       |
| Per-type switch                                  | Turns that one alert off                                            |
| Per-type tone picker                             | Any preset, **None**, or one of your uploaded tones                 |
| **Test** / **Preview** / **Test tone**           | A real card and tone; the card shape as a toast; the tone alone     |
| **Tone volume**                                  | 0 to 100                                                            |
| **Mute tones while this tab is focused**         | Silence tones when you are already looking at the tab               |
| **Only show cards when this tab is not focused** | Suppress cards while the tab is visible and focused; the tone plays |
| **Maximum card body length**                     | Text cap on approval, failure, question, and goal cards             |
| **Also notify for subagent sessions**            | Include alerts raised by subagents                                  |
| **Custom tones**                                 | Upload, audition, rename, delete                                    |
| **Reset to defaults**                            | Asks for a second click                                             |

## Tones

Seven built in: **Chime**, **Ping**, **Bubble**, **Marimba**, **Knock**, **Alarm**, **Triple tick**.

You can upload your own tones too — `.wav`, `.ogg`, or `.mp3`, up to 500 KB each and 50 stored by default — and they appear in every tone picker. Uploads are checked by their contents, not just by their extension.

## Privacy

Approval reasons, question text, and failure messages go to open tabs and are logged only as request id plus length; the plugin never persists them. It writes nothing outside its data directory, phones home nowhere, adds nothing to the model's context, and changes nothing in dsh's approval policy or agent loop.

MIT — see [LICENSE](LICENSE).
