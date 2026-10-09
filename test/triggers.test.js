// Trigger-contract tests.
//
// `installTriggers` is driven through the same three seams the host gives it:
// a fake Cordis context that records listeners, a fake config shaped like the
// volatile schema (every leaf read with `.get()`), and a fake controller that
// records the `buildFrame` arguments instead of assembling a frame. So these
// tests pin what fires, with what body and title, and what stays silent —
// never the browser delivery path.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installTriggers } from '../triggers.js'
import { NOTIFICATION_TYPES, TYPE_DEFAULTS } from '../config.js'

/** One volatile config leaf, read the way the live config object is read. */
function volatile(value) {
  return { get: () => value }
}

/**
 * Build the config subtree the triggers read, sourced from the same
 * `TYPE_DEFAULTS` table the schema is built from so the two cannot drift.
 */
function makeConfig(overrides = {}) {
  const types = {}
  for (const type of NOTIFICATION_TYPES) {
    const defaults = TYPE_DEFAULTS[type]
    const value = { ...defaults, ...(overrides.types?.[type] ?? {}) }
    types[type] = {
      enabled: volatile(value.enabled),
      tone: volatile(value.tone),
    }
  }
  return {
    enabled: volatile(overrides.enabled ?? true),
    maxBodyChars: volatile(overrides.maxBodyChars ?? 200),
    subagentNotifications: volatile(overrides.subagentNotifications ?? false),
    types,
  }
}

function makeSession({ id = 'session-1', origin, maxTokens } = {}) {
  return {
    id,
    header: { origin },
    requestHeader: () => (maxTokens === undefined ? undefined : { config: { maxTokens } }),
  }
}

/** Install the triggers over a fresh fake host and return its probe surface. */
function harness(configOverrides) {
  const listeners = new Map()
  const frames = []
  const logs = []
  const ctx = {
    logger: () => ({
      info: (line) => logs.push(line),
      warn: (line) => logs.push(line),
      error: (line) => logs.push(line),
    }),
    on: (type, handler) => {
      const list = listeners.get(type) ?? []
      list.push(handler)
      listeners.set(type, list)
    },
  }
  const controller = {
    // The id is the host's to mint; the triggers always pass undefined.
    buildFrame: (type, body, demo, _id, titleVariant) => ({ type, body, demo, titleVariant }),
    publish: (frame) => frames.push(frame),
  }
  installTriggers(ctx, makeConfig(configOverrides), controller)

  const dispatch = (type, ...args) => {
    for (const handler of listeners.get(type) ?? []) handler(...args)
  }
  /** Run one waterfall and report whether the observer delegated with `next()`. */
  const waterfall = (type, request) => {
    let delegated = 0
    let settled
    for (const handler of listeners.get(type) ?? []) {
      settled = handler(request, () => {
        delegated += 1
        return 'settled-by-answerer'
      })
    }
    return { delegated, settled }
  }
  return {
    frames,
    logs,
    session: (options) => makeSession(options),
    emit: (session, event) => dispatch('session/event', session, event),
    askQuestion: (request) => waterfall('user-questions/request', request),
    askApproval: (request) => waterfall('approval/request', request),
  }
}

const assistantText = (turn, text) => ({
  type: 'assistant/message',
  data: {
    turn,
    message: {
      content: [
        { type: 'text', text },
        { type: 'toolCall', name: 'bash' },
      ],
    },
  },
})
const turnEnd = (turn, reason) => ({ type: 'turn/end', data: { turn, reason } })
const goalChange = (operation, goal) => ({ type: 'goal/change', data: { operation, goal } })

test('a completed turn notifies with the final answer text', () => {
  const host = harness()
  const session = host.session()
  host.emit(session, assistantText(1, '## Done\n\nThe plugin now **ships**.'))
  host.emit(session, turnEnd(1, { kind: 'completed' }))
  assert.deepEqual(host.frames, [
    { type: 'turnComplete', body: 'Done The plugin now ships.', demo: false, titleVariant: undefined },
  ])
})

test('a completed turn with no final text stays silent', () => {
  const host = harness()
  const session = host.session()
  host.emit(session, turnEnd(1, { kind: 'completed' }))
  host.emit(session, assistantText(1, 'stale text from another turn'))
  const other = host.session({ id: 'session-2' })
  host.emit(other, turnEnd(7, { kind: 'completed' }))
  assert.equal(host.frames.length, 0)
})

test('a max-tokens end stalls with the configured output cap', () => {
  const host = harness()
  const session = host.session({ maxTokens: 8192 })
  host.emit(session, turnEnd(1, { kind: 'max-tokens' }))
  assert.equal(host.frames[0].type, 'agentStalled')
  assert.match(host.frames[0].body, /token limit/)
  assert.match(host.frames[0].body, /\(8192 output tokens\)/)
})

test('an errored turn fails with the provider message and code', () => {
  const host = harness()
  const session = host.session()
  host.emit(session, turnEnd(1, { kind: 'error', error: { message: 'Rate limit exceeded', code: 'RATE_LIMIT' } }))
  assert.equal(host.frames.length, 1)
  assert.equal(host.frames[0].type, 'turnFailed')
  assert.equal(host.frames[0].body, 'Rate limit exceeded (RATE_LIMIT)')
  // Privacy: the failure text is never logged, only its length.
  assert.ok(!host.logs.some((line) => line.includes('Rate limit exceeded')))
  assert.ok(host.logs.some((line) => line.includes('messageLength=19')))
})

test('an errored turn with no structured failure still notifies', () => {
  const host = harness()
  host.emit(host.session(), turnEnd(1, { kind: 'error', error: undefined }))
  assert.equal(host.frames[0].type, 'turnFailed')
  assert.equal(host.frames[0].body, 'The model request failed.')
})

test('aborted, blocked, interrupted, and forked ends never notify', () => {
  const host = harness()
  const session = host.session()
  host.emit(session, assistantText(1, 'some answer'))
  for (const reason of [
    { kind: 'aborted', reason: { kind: 'user' } },
    { kind: 'aborted', reason: { kind: 'hook', reason: 'blocked by policy' } },
    { kind: 'blocked' },
    { kind: 'interrupted' },
    { kind: 'forked' },
  ]) {
    host.emit(session, turnEnd(1, reason))
  }
  assert.deepEqual(host.frames, [])
})

test('a completed goal notifies once per revision', () => {
  const host = harness()
  const session = host.session()
  const goal = { id: 'goal-1', revision: 4, objective: 'Ship the redesign', phase: 'complete' }
  host.emit(session, goalChange('complete', goal))
  host.emit(session, goalChange('complete', goal))
  assert.equal(host.frames.length, 1)
  assert.equal(host.frames[0].type, 'goalComplete')
  assert.equal(host.frames[0].body, 'Ship the redesign')
})

test('a non-terminal goal mutation never notifies', () => {
  const host = harness()
  const session = host.session()
  // A resumed or edited goal still carries its full snapshot, so the phase
  // alone must not read as an ending.
  host.emit(session, goalChange('resume', { id: 'goal-1', revision: 5, objective: 'Ship', phase: 'complete' }))
  host.emit(session, goalChange('edit', { id: 'goal-1', revision: 6, objective: 'Ship', phase: 'active' }))
  host.emit(session, goalChange('clear', { cleared: { id: 'goal-1', revision: 7 } }))
  assert.deepEqual(host.frames, [])
})

test('a blocked goal is silent by default and notifies when enabled', () => {
  const off = harness()
  off.emit(
    off.session(),
    goalChange('block', {
      id: 'goal-1',
      revision: 2,
      phase: 'blocked',
      blockedReason: { code: 'env', message: 'Registry unreachable' },
    }),
  )
  assert.deepEqual(off.frames, [])

  const on = harness({ types: { goalBlocked: { enabled: true } } })
  on.emit(
    on.session(),
    goalChange('block', {
      id: 'goal-1',
      revision: 2,
      phase: 'blocked',
      blockedReason: { code: 'env', message: 'Registry unreachable' },
    }),
  )
  assert.equal(on.frames[0].type, 'goalBlocked')
  assert.equal(on.frames[0].body, 'Registry unreachable')
})

test('a question notifies and never claims the answerer waterfall', () => {
  const host = harness()
  const { delegated, settled } = host.askQuestion({
    agent: { id: 'session-1' },
    questions: [{ id: 'q1', question: 'Which layout should I use?' }],
  })
  assert.equal(delegated, 1)
  assert.equal(settled, 'settled-by-answerer')
  assert.equal(host.frames[0].type, 'inputRequired')
  assert.equal(host.frames[0].body, 'Which layout should I use?')
  assert.equal(host.frames[0].titleVariant, undefined)
})

test('a plan review is titled as such and previewed by the plan heading', () => {
  const host = harness()
  host.askQuestion({
    agent: { id: 'session-1' },
    wait: { callId: 'call-9', timed: true },
    questions: [
      {
        id: 'plan',
        question: 'Approve this plan and leave plan mode?',
        detail: 'Intro line.\n\n# Notification type expansion\n\n- add types',
        intent: { kind: 'plan-review', approve: 'Approve' },
      },
    ],
  })
  assert.equal(host.frames[0].type, 'inputRequired')
  assert.equal(host.frames[0].titleVariant, 'planReview')
  // The heading marker itself is stripped by the shared markdown-to-one-line
  // helper, so the card reads as a title, not as markdown.
  assert.equal(host.frames[0].body, 'Notification type expansion')
})

test('repeat questions are deduped, and extra questions are counted', () => {
  const host = harness()
  const request = { agent: { id: 'session-1' }, wait: { callId: 'call-1' }, questions: [{ id: 'q1', question: 'A?' }] }
  host.askQuestion(request)
  host.askQuestion(request)
  assert.equal(host.frames.length, 1)
  host.askQuestion({
    agent: { id: 'session-1' },
    wait: { callId: 'call-2' },
    questions: [
      { id: 'q1', question: 'A?' },
      { id: 'q2', question: 'B?' },
    ],
  })
  assert.equal(host.frames[1].body, 'A? (+1 more)')
})

test('question bodies respect the configured body cap', () => {
  const host = harness({ maxBodyChars: 40 })
  host.askQuestion({ agent: { id: 'session-1' }, questions: [{ id: 'q1', question: 'a'.repeat(200) }] })
  assert.ok(host.frames[0].body.length <= 40)
})

test('there is no rate window: back-to-back events each emit their own card', () => {
  const host = harness()
  const session = host.session()
  host.emit(session, assistantText(1, 'first answer'))
  host.emit(session, turnEnd(1, { kind: 'completed' }))
  host.emit(session, assistantText(2, 'second answer'))
  host.emit(session, turnEnd(2, { kind: 'completed' }))
  assert.deepEqual(
    host.frames.map((frame) => frame.body),
    ['first answer', 'second answer'],
  )

  host.emit(session, turnEnd(3, { kind: 'max-tokens' }))
  host.emit(session, turnEnd(4, { kind: 'max-tokens' }))
  const stalled = host.frames.filter((frame) => frame.type === 'agentStalled')
  assert.equal(stalled.length, 2)
})

test('one turn still notifies once, whatever the rate', () => {
  const host = harness()
  const session = host.session()
  host.emit(session, assistantText(1, 'only answer'))
  host.emit(session, turnEnd(1, { kind: 'completed' }))
  host.emit(session, turnEnd(1, { kind: 'completed' }))
  assert.equal(host.frames.length, 1)
})

test('subagent sessions stay silent unless subagent notifications are on', () => {
  const off = harness()
  const child = off.session({ id: 'child-1', origin: 'subagent' })
  off.emit(child, assistantText(1, 'child answer'))
  off.emit(child, turnEnd(1, { kind: 'completed' }))
  off.askQuestion({ agent: { id: 'child-1' }, questions: [{ id: 'q1', question: 'Child asks' }] })
  assert.deepEqual(off.frames, [])

  const on = harness({ subagentNotifications: true })
  const watched = on.session({ id: 'child-2', origin: 'subagent' })
  on.emit(watched, assistantText(1, 'child answer'))
  on.emit(watched, turnEnd(1, { kind: 'completed' }))
  assert.equal(on.frames[0].type, 'turnComplete')
})

test('the master switch silences every type', () => {
  const host = harness({ enabled: false })
  const session = host.session()
  host.emit(session, assistantText(1, 'answer'))
  host.emit(session, turnEnd(1, { kind: 'completed' }))
  host.emit(session, turnEnd(2, { kind: 'error', error: { message: 'boom', code: 'UNKNOWN' } }))
  host.askQuestion({ agent: { id: 'session-1' }, questions: [{ id: 'q1', question: 'A?' }] })
  assert.deepEqual(host.frames, [])
})

test('an approval still notifies and delegates to the real answerer', () => {
  const host = harness()
  const { delegated, settled } = host.askApproval({
    agent: { id: 'session-1' },
    toolName: 'bash',
    callId: 'call-1',
    reason: 'Delete the build cache',
  })
  assert.equal(delegated, 1)
  assert.equal(settled, 'settled-by-answerer')
  assert.equal(host.frames[0].type, 'approvalRequired')
  assert.equal(host.frames[0].body, 'Delete the build cache')
})
