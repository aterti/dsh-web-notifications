// Config schema for dsh-web-notifications.
//
// The settings loader validates non-strictly: unknown keys survive silently,
// so `reportUnknownKeys` surfaces them in the host log instead. Every field
// except `version` and `dataRoot` is volatile, which means edits made in the
// Settings UI are applied to the live config object in place (read them with
// `.get()`) without restarting the plugin fiber.

import z from '@deepseek-ai/schemastery'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'

/** Config document revision; bump when the shape changes and add a migration. */
export const CONFIG_VERSION = 1

/** Preset tone ids; audio files are produced by tools/generate-tones.mjs. */
export const PRESET_TONES = Object.freeze(['chime', 'ping', 'bubble', 'marimba', 'knock', 'alarm', 'triple-tick'])

/**
 * Per-type defaults, the single source for the schema below, the host test
 * bodies, and the trigger tests. The browser half mirrors this table by hand
 * (it imports nothing), so a new type is added in both places.
 */
export const TYPE_DEFAULTS = Object.freeze({
  turnComplete: { enabled: true, tone: 'chime' },
  approvalRequired: { enabled: true, tone: 'ping' },
  agentStalled: { enabled: true, tone: 'alarm' },
  // `turnFailed` deliberately starts on the same tone as `agentStalled`, and
  // `goalComplete` on the same tone as `turnComplete`; the Settings panel says
  // so, and each type can be given its own tone there.
  turnFailed: { enabled: true, tone: 'alarm' },
  inputRequired: { enabled: true, tone: 'knock' },
  goalComplete: { enabled: true, tone: 'chime' },
  // Off by default: goals only exist in sessions that created one, so most
  // users would never see this fire.
  goalBlocked: { enabled: false, tone: 'triple-tick' },
})

/** Notification type ids shared with the browser half. */
export const NOTIFICATION_TYPES = Object.freeze(Object.keys(TYPE_DEFAULTS))

const toneRecordShape = {
  id: z.string().min(1),
  name: z.string().min(1),
  file: z.string().min(1),
  bytes: z.number().step(1).min(0),
}

const typeShape = (defaults) => ({
  enabled: z.boolean().default(defaults.enabled).volatile(),
  tone: z.string().default(defaults.tone).volatile(),
})

// Plain shape objects (not schemas) so `reportUnknownKeys` can walk the same
// key tree the schema is built from. Adding a type here is additive: a stored
// document without the new `types.<id>` subtree is filled from `TYPE_DEFAULTS`
// by the loader, so `CONFIG_VERSION` does not move.
//
// The per-type `cooldownSeconds` and `toneEveryStall` keys were removed: every
// event now emits its card and tone. A document still carrying them keeps
// working — the loader is non-strict, and each leftover key is reported once as
// an unknown key rather than breaking the load. `CONFIG_VERSION` stays at 1
// because the host half never writes config (the browser owns every write), so
// there is no in-place migration to run; the stale lines are deleted by hand or
// by a fresh Settings write.
const typeShapes = Object.fromEntries(
  Object.entries(TYPE_DEFAULTS).map(([name, defaults]) => [name, typeShape(defaults)]),
)

const globalShape = {
  version: z.number().step(1).default(CONFIG_VERSION),
  // Plugin-owned data directory; nothing is ever written outside it.
  dataRoot: z.string().default(dshHomePath('notifications')),
  enabled: z.boolean().default(true).volatile(),
  volume: z.number().step(1).min(0).max(100).default(70).volatile(),
  muteWhenFocused: z.boolean().default(false).volatile(),
  onlyWhenHidden: z.boolean().default(true).volatile(),
  maxBodyChars: z.number().step(1).min(20).max(250).default(200).volatile(),
  subagentNotifications: z.boolean().default(false).volatile(),
  toneMaxBytes: z.number().step(1).min(1024).max(8388608).default(512000).volatile(),
  toneMaxCount: z.number().step(1).min(1).max(500).default(50).volatile(),
  customTones: z.array(z.object(toneRecordShape)).default([]).volatile(),
  types: z.object(Object.fromEntries(Object.entries(typeShapes).map(([name, shape]) => [name, z.object(shape)]))),
}

export const Config = z.object(globalShape)

/**
 * `version` fences future shape changes. v1 is the first revision, so there is
 * nothing to migrate yet. When the shape changes, add a rewrite step here that
 * persists through the settings service and bump CONFIG_VERSION; a document
 * newer than this plugin is reported rather than silently truncated.
 *
 * @param logger - host logger scoped to this plugin.
 * @param config - validated (non-strict) config section.
 */
export function migrateConfig(logger, config) {
  if (typeof config.version === 'number' && config.version > CONFIG_VERSION) {
    logger.warn(
      `notifications: config version ${config.version} is newer than plugin v${CONFIG_VERSION}; ` +
        'unknown keys will be reported, not migrated',
    )
  }
}

/**
 * Report config keys the schema does not declare. The loader keeps unknown
 * keys, so a typo in the profile patch would otherwise be invisible.
 *
 * @param logger - host logger scoped to this plugin.
 * @param config - validated (non-strict) config section.
 */
export function reportUnknownKeys(logger, config) {
  reportKeys(logger, '', config, globalShape)
  reportKeys(logger, 'types.', config.types, typeShapes)
  for (const typeName of Object.keys(typeShapes)) {
    reportKeys(logger, `types.${typeName}.`, config.types?.[typeName], typeShapes[typeName])
  }
  const customTones = config.customTones?.get?.() ?? []
  for (const [index, tone] of customTones.entries()) {
    reportKeys(logger, `customTones[${index}].`, tone, toneRecordShape)
  }
}

/**
 * Log one warning per key present in `value` but absent from `shape`.
 *
 * @param logger - host logger scoped to this plugin.
 * @param prefix - dotted path prefix for the reported key.
 * @param value - config subtree (may be undefined).
 * @param shape - declared shape for that subtree.
 */
function reportKeys(logger, prefix, value, shape) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return
  for (const key of Object.keys(value)) {
    if (!(key in shape)) logger.warn(`notifications: unknown config key "${prefix}${key}" ignored`)
  }
}
