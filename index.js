// Host half of dsh-web-notifications.
//
// Owns the config schema, the trigger listeners, and the live frame stream
// that browser tabs follow. Frames are pushed as they happen; the stream
// never replays history, so a reconnecting tab sees only what occurs after
// it re-subscribes.

import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { Config, NOTIFICATION_TYPES, PRESET_TONES, migrateConfig, reportUnknownKeys } from './config.js'
import { installTriggers } from './triggers.js'
import {
  TONE_ROUTE_PREFIX,
  createToneHandler,
  removeCustomTone,
  saveCustomTone,
  sanitizeName,
  validateUpload,
} from './tones.js'

export { Config }

const TITLES = Object.freeze({
  turnComplete: 'Turn complete',
  approvalRequired: 'Approval needed',
  agentStalled: 'Agent stalled',
  turnFailed: 'Turn failed',
  inputRequired: 'Waiting for your answer',
  goalComplete: 'Goal complete',
  goalBlocked: 'Goal blocked',
})

// Titles that vary per frame within one type. The trigger names the variant,
// the host owns the wording, so the browser never has to guess.
const TITLE_VARIANTS = Object.freeze({
  inputRequired: Object.freeze({ planReview: 'Plan ready for review' }),
})

const TEST_BODIES = Object.freeze({
  turnComplete: 'This is a test notification from dsh-web-notifications.',
  approvalRequired: 'Approval requested: this is a test notification from dsh-web-notifications.',
  agentStalled: 'The reply was cut off by the token limit. Type "continue" to resume.',
  turnFailed: 'The model request failed. (UNKNOWN)',
  inputRequired: 'Which of these should I change? Open dsh to answer.',
  goalComplete: 'Ship the notification settings redesign.',
  goalBlocked: 'The build still fails on the same missing dependency.',
})

/** Unique frame id; the browser uses ids for multi-tab claim and demo routing. */
function newFrameId(type) {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Remote controller: one follow stream per tab plus unary test/tone calls. */
export class NotificationsController extends TypertRemoteService {
  /**
   * @param ctx - owning Cordis Context.
   * @param config - validated plugin config section.
   * @param logger - host logger scoped to this plugin.
   */
  constructor(ctx, config, logger) {
    super(ctx, 'notificationsController', { namespace: 'notifications' })
    this.config = config
    this.logger = logger
    /** One send function per live follow stream (one per browser tab). */
    this.senders = new Set()
    applyRemoteMarkers(this, [
      { method: 'follow', options: { mode: 'stream' } },
      { method: 'testNotification' },
      { method: 'uploadTone' },
      { method: 'deleteTone' },
    ])
  }

  /**
   * Live-only frame stream. The gateway cancels via `signal` when the tab
   * disconnects; nothing is buffered across a disconnect.
   *
   * @param signal - cancellation signal owned by the stream carrier.
   * @returns async iterable of notification frames.
   */
  follow(signal) {
    const state = { queue: [], wake: null }
    const send = (frame) => {
      state.queue.push(frame)
      const wake = state.wake
      if (wake !== null) {
        state.wake = null
        wake()
      }
    }
    this.senders.add(send)
    const senders = this.senders
    return (async function* frames() {
      try {
        while (!signal.aborted) {
          while (state.queue.length > 0) yield state.queue.shift()
          if (signal.aborted) break
          await new Promise((resolve) => {
            state.wake = resolve
            signal.addEventListener(
              'abort',
              () => {
                if (state.wake === resolve) {
                  state.wake = null
                  resolve()
                }
              },
              { once: true },
            )
          })
        }
      } finally {
        senders.delete(send)
      }
    })()
  }

  /**
   * Push one faithful sample frame of the given type to every live stream.
   * Frames carry `demo: true` so the browser never suppresses them, and the
   * caller's nonce so only the requesting tab renders the demo card.
   *
   * @param input - `{ type, nonce? }` with one of the notification type ids.
   * @returns delivery summary or a business error.
   */
  testNotification(input) {
    const type = input !== null && typeof input === 'object' ? input.type : undefined
    if (typeof type !== 'string' || !NOTIFICATION_TYPES.includes(type)) {
      return { ok: false, error: 'unknown notification type' }
    }
    if (!this.config.enabled.get()) return { ok: false, error: 'notifications are disabled' }
    const nonce = input.nonce
    const id = typeof nonce === 'string' && /^[a-z0-9._-]{1,64}$/i.test(nonce) ? nonce : newFrameId(type)
    this.publish(this.buildFrame(type, TEST_BODIES[type], true, id))
    return { ok: true, id, receivers: this.senders.size }
  }

  /**
   * Store one uploaded custom tone inside the plugin data directory. The
   * caller (a browser tab) adds the returned record to the config manifest;
   * the host never writes config itself.
   *
   * @param input - `{ name, extension, data }` with base64 file bytes.
   * @returns the tone record to manifest, or a business error.
   */
  async uploadTone(input) {
    if (input === null || typeof input !== 'object') return { ok: false, error: 'invalid upload' }
    const name = sanitizeName(input.name)
    if (name === undefined) return { ok: false, error: 'tone name is empty or unusable' }
    const extension = typeof input.extension === 'string' ? input.extension.toLowerCase() : ''
    let buffer
    try {
      buffer = Buffer.from(String(input.data ?? ''), 'base64')
    } catch {
      return { ok: false, error: 'upload payload is not valid base64' }
    }
    const validated = validateUpload(buffer, extension, this.config.toneMaxBytes.get())
    if (validated.error !== undefined) return { ok: false, error: validated.error }
    if ((this.config.customTones.get() ?? []).length >= this.config.toneMaxCount.get())
      return { ok: false, error: `tone limit reached (${this.config.toneMaxCount.get()})` }
    // Fresh id per upload: files are never overwritten, so a rename or a
    // re-upload of the same name cannot clobber a tone another type uses.
    const id = `tone-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`
    const file = `${id}.${extension}`
    await saveCustomTone(this.config.dataRoot, file, buffer)
    this.logger.info(`custom tone stored: id=${id} format=${validated.format} bytes=${buffer.length}`)
    return { ok: true, tone: { id, name, file, bytes: buffer.length } }
  }

  /**
   * Delete one custom tone file. The caller removes the manifest entry and
   * reassigns any type that used the tone.
   *
   * @param input - `{ id }` tone id.
   * @returns success or a business error.
   */
  async deleteTone(input) {
    const id = input !== null && typeof input === 'object' ? input.id : undefined
    if (typeof id !== 'string' || id === '') return { ok: false, error: 'invalid tone id' }
    const entry = (this.config.customTones.get() ?? []).find((tone) => tone.id === id)
    if (entry === undefined) return { ok: false, error: 'unknown tone' }
    await removeCustomTone(this.config.dataRoot, entry.file)
    this.logger.info(`custom tone removed: id=${id}`)
    return { ok: true }
  }

  /**
   * Assemble one notification frame with the tone configured for its type.
   *
   * @param type - notification type id.
   * @param body - already-truncated card body.
   * @param demo - whether the frame came from the settings panel.
   * @param id - frame id, fresh per frame when not supplied.
   * @param titleVariant - optional per-frame title variant within the type
   *   (a plan-review question, for example); unknown variants fall back to the
   *   type's base title.
   * @returns the frame object sent to browsers.
   */
  buildFrame(type, body, demo, id = newFrameId(type), titleVariant) {
    const title = TITLE_VARIANTS[type]?.[titleVariant] ?? TITLES[type]
    return {
      id,
      type,
      // Demo frames (Test buttons, host probes) carry a distinct title so
      // they can never be mistaken for a real trigger firing.
      title: demo ? `Test: ${title}` : title,
      body,
      tone: this.config.types[type].tone.get(),
      demo,
      at: Date.now(),
    }
  }

  /**
   * Fan one frame out to every live follow stream.
   *
   * @param frame - notification frame.
   */
  publish(frame) {
    for (const send of this.senders) send(frame)
  }
}

/**
 * Attach Remote markers without decorator syntax. The plugin ships as plain
 * JS, so the published decorator is invoked with a minimal method-decorator
 * context, exactly as a TypeScript build would call it; the initializer runs
 * against the instance so the prototype descriptor is recorded.
 *
 * @param instance - service instance whose methods are exposed.
 * @param specs - method names with optional `{ mode: 'stream' }` options.
 */
function applyRemoteMarkers(instance, specs) {
  for (const spec of specs) {
    const decorate = spec.options === undefined ? Remote : Remote(spec.options)
    decorate(instance[spec.method], {
      kind: 'method',
      name: spec.method,
      static: false,
      private: false,
      addInitializer(initialize) {
        initialize.call(instance)
      },
    })
  }
}

/**
 * Activate the plugin: validate the config surface and register the remote
 * controller. The service self-registers with the fiber and disappears with
 * it; the follow streams are dropped explicitly on unload.
 *
 * @param ctx - host Cordis Context.
 * @param config - validated plugin config section.
 */
export function apply(ctx, config) {
  const logger = ctx.logger('notifications')
  migrateConfig(logger, config)
  reportUnknownKeys(logger, config)
  const controller = new NotificationsController(ctx, config, logger)
  installTriggers(ctx, config, controller)
  // Tone files are served from a plugin-owned prefix so the browser can use
  // document-relative URLs; webServer is injected at runtime because the
  // service only exists on web profiles.
  ctx.inject(['webServer'], (hostCtx) => {
    hostCtx.effect(
      () =>
        hostCtx.webServer.register({
          kind: 'prefix',
          path: TONE_ROUTE_PREFIX,
          handler: createToneHandler({
            presetDir: fileURLToPath(new URL('tones/', import.meta.url)),
            presetNames: PRESET_TONES,
            config,
          }),
        }),
      'notifications: tone route',
    )
  })
  // Stream generators normally unwind through gateway cancellation; clearing
  // the sender set guarantees no frame can reach a stale stream after unload.
  ctx.effect(() => () => controller.senders.clear(), 'notifications: drop live streams on unload')
}
