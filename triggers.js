// Trigger listeners for the notification contracts.
//
// turn_complete:     `turn/end` with reason `completed`; body is the final
//                    assistant text of that turn.
// approval_required: the `approval/request` waterfall, observed without
//                    claiming the request.
// agent_stalled:     `turn/end` with reason `max-tokens` (the output-token
//                    limit), never natural stops, aborts, or provider errors.
// turn_failed:       `turn/end` with reason `error`: the turn died on a
//                    provider or transport failure once retries were spent.
// input_required:    the `user-questions/request` waterfall, observed without
//                    claiming it. The turn is still open here (the tool call
//                    is blocked), so no `turn/end` will ever describe this
//                    state: the agent stopped producing output and is waiting
//                    on the human. A request whose question carries the
//                    `plan-review` intent is a finished plan awaiting review.
// goal_complete:     the `goal/change` session event for the `complete`
//                    operation: a tracked objective reached its end.
// goal_blocked:      the `goal/change` session event for the `block`
//                    operation: automatic continuation stopped and needs the
//                    human. Disabled by default.
//
// What never fires from `turn/end`: `aborted` (the user stopped it themselves,
// or a teardown did, so there is nothing to tell them), `blocked` (a hook rejected the
// turn before its first step), and `interrupted` / `forked` (closers written
// for a crashed or forked log, not live endings; a session resume appends them
// through the same live feed, so they are filtered explicitly).
//
// `session/event` is the post-commit live append feed: it never replays on
// resume or plugin load, so triggers are live-only by construction.

import { plainLine, truncateAtWord } from './text.js'

/** Character cap for the turn_complete body, per the product contract. */
const TURN_BODY_CHARS = 140
/** Hard ceiling for every non-turn-complete body regardless of user config. */
const BODY_HARD_MAX = 250
/** Bound on dedupe bookkeeping sets; oldest entries are evicted first. */
const DEDUPE_KEEP = 200
/** Frame title variant the host resolves for a plan-review question. */
const PLAN_REVIEW_VARIANT = 'planReview'

/**
 * Join the text blocks of an assistant message; tool calls, reasoning, and
 * attachments contribute nothing to a notification body.
 * @param blocks - message content blocks.
 * @returns concatenated visible text.
 */
function joinText(blocks) {
  let text = ''
  for (const block of blocks ?? []) if (block.type === 'text') text += block.text
  return text
}

/**
 * First markdown heading of a block, used to name a reviewed plan by its own
 * title instead of its first paragraph.
 * @param markdown - plan or question detail text.
 * @returns the heading line, or undefined when the block has none.
 */
function firstHeading(markdown) {
  return String(markdown ?? '')
    .split('\n')
    .find((line) => /^#{1,6}\s+\S/.test(line))
}

/**
 * Add a key to an insertion-ordered set, evicting the oldest entry past the
 * bound so long-lived sessions cannot grow the dedupe logs without limit.
 * @param set - the tracking set.
 * @param key - key to remember.
 */
function boundedAdd(set, key) {
  set.add(key)
  if (set.size > DEDUPE_KEEP) set.delete(set.values().next().value)
}

/**
 * Register the trigger listeners on the context; every listener is a fiber
 * effect and disappears with the plugin.
 *
 * @param ctx - host Cordis Context.
 * @param config - validated plugin config section.
 * @param controller - live frame controller to publish through.
 */
export function installTriggers(ctx, config, controller) {
  const logger = ctx.logger('notifications')
  /** Last assistant text per session, tagged with the turn that produced it. */
  const lastText = new Map()
  /** Sessions identified as subagents from their header origin. */
  const subagentSessions = new Set()
  /** (session, turn) pairs that already fired turn_complete. */
  const firedTurns = new Set()
  /** Approval dedupe keys already notified. */
  const seenApprovals = new Set()
  /** Question dedupe keys already notified. */
  const seenQuestions = new Set()
  /** `goalId:revision` pairs already notified. */
  const seenGoals = new Set()
  /** Effective non-turn-complete body cap: user config clamped to the hard ceiling. */
  function bodyCap() {
    return Math.min(config.maxBodyChars.get(), BODY_HARD_MAX)
  }

  /**
   * Publish one card for a fired trigger. There is no rate window: every event
   * that passes its own dedupe emits a card and plays its tone.
   * @param type - notification type id.
   * @param body - card body text.
   * @param titleVariant - optional host-resolved title variant for this frame.
   */
  function publish(type, body, titleVariant) {
    if (!config.enabled.get() || !config.types[type].enabled.get()) return
    controller.publish(controller.buildFrame(type, body, false, undefined, titleVariant))
  }

  function fireTurnComplete(session, turn) {
    const key = `${session.id}:${turn}`
    if (firedTurns.has(key)) return
    boundedAdd(firedTurns, key)
    const entry = lastText.get(session.id)
    // A completed turn with no final text (or text from an older turn) has
    // nothing to preview; stay silent.
    if (entry === undefined || entry.turn !== turn) return
    const body = plainLine(entry.text, TURN_BODY_CHARS)
    if (body === '') return
    publish('turnComplete', body)
  }

  function fireStalled(session) {
    let body = 'The reply was cut off by the token limit. Type "continue" to resume.'
    const limit = session.requestHeader()?.config?.maxTokens
    if (typeof limit === 'number' && limit > 0) body += ` (${limit} output tokens)`
    publish('agentStalled', body)
  }

  function fireTurnFailed(session, failure) {
    // `failure` is the structured LlmFailure verbatim, or a flattened
    // `{ message, code: 'UNKNOWN' }`. The code is kept because it is the part
    // that says whether retrying or switching route would help.
    const code = typeof failure?.code === 'string' && failure.code !== '' ? ` (${failure.code})` : ''
    // The code keeps its slot first and the message gets what remains, so
    // the combined body never crosses the cap; a code longer than the cap is
    // the one that gets cut.
    const cap = bodyCap()
    const message = plainLine(failure?.message ?? 'The model request failed.', Math.max(0, cap - code.length))
    const body = `${message}${code}`
    // Privacy: the provider message can echo request content, so only the code
    // and its length reach the log; the text exists only in the card body.
    logger.info(
      `turn failed notification: session=${session.id} code=${failure?.code ?? 'none'} messageLength=${String(failure?.message ?? '').length}`,
    )
    publish('turnFailed', body.length > cap ? truncateAtWord(body, cap) : body)
  }

  function fireGoal(goal, type) {
    if (goal === undefined || typeof goal.id !== 'string') return
    const key = `${goal.id}:${goal.revision}`
    if (seenGoals.has(key)) return
    boundedAdd(seenGoals, key)
    const raw =
      type === 'goalBlocked'
        ? (goal.blockedReason?.message ?? 'The goal stopped and needs your input.')
        : (goal.objective ?? 'Goal complete.')
    logger.info(`goal notification: goalId=${goal.id} type=${type} reasonLength=${raw.length}`)
    publish(type, plainLine(raw, bodyCap()))
  }

  function notifyApproval(req) {
    if (!config.enabled.get() || !config.types.approvalRequired.enabled.get()) return
    if (subagentSessions.has(req.agent.id) && !config.subagentNotifications.get()) return
    // The waterfall carries no durable request id; prefer the tool call id
    // and fall back to a session/tool/reason fingerprint.
    const key = req.callId ?? `${req.agent.id}|${req.toolName}|${req.reason ?? ''}`
    if (seenApprovals.has(key)) return
    boundedAdd(seenApprovals, key)
    // Reason resolution: structured display reason, then plain reason, then
    // the assistant text immediately before the ask, then a generic fallback.
    const raw =
      req.displayReason?.en ?? req.reason ?? lastText.get(req.agent.id)?.text ?? `Approval requested: ${req.toolName}`
    // Privacy: log only the request identity and the reason length. The full
    // reason exists in memory for the card body and is never persisted.
    logger.info(`approval notification: callId=${req.callId ?? 'none'} tool=${req.toolName} reasonLength=${raw.length}`)
    publish('approvalRequired', plainLine(raw, bodyCap()))
  }

  function notifyQuestion(req) {
    if (!config.enabled.get() || !config.types.inputRequired.enabled.get()) return
    const questions = Array.isArray(req?.questions) ? req.questions : []
    const first = questions[0]
    if (first === undefined || typeof first.question !== 'string' || first.question === '') return
    const agentId = req.agent?.id
    if (agentId !== undefined && subagentSessions.has(agentId) && !config.subagentNotifications.get()) return
    // A timed ask carries its tool call id; an indefinite one does not, so it
    // falls back to a question fingerprint.
    const key = req.wait?.callId ?? `${agentId ?? 'none'}|${first.id ?? ''}|${first.question.slice(0, 60)}`
    if (seenQuestions.has(key)) return
    boundedAdd(seenQuestions, key)
    // Plan mode asks through the same waterfall, tagged by intent: the plan
    // markdown rides in `detail`, so the card names the plan by its heading.
    const review = questions.some((question) => question?.intent?.kind === 'plan-review')
    const more = questions.length > 1 ? ` (+${questions.length - 1} more)` : ''
    const source = (review ? (firstHeading(first.detail) ?? first.question) : first.question) + more
    // Privacy: question text is never persisted; only its length is logged.
    logger.info(
      `question notification: callId=${req.wait?.callId ?? 'none'} planReview=${review} questions=${questions.length} questionLength=${first.question.length}`,
    )
    publish('inputRequired', plainLine(source, bodyCap()), review ? PLAN_REVIEW_VARIANT : undefined)
  }

  ctx.on('session/event', (session, event) => {
    if (event.type === 'assistant/message') {
      if (session.header.origin === 'subagent') subagentSessions.add(session.id)
      const text = joinText(event.data.message.content)
      if (text !== '') lastText.set(session.id, { turn: event.data.turn, text })
      return
    }
    if (event.type !== 'turn/end' && event.type !== 'goal/change') return
    if (session.header.origin === 'subagent') subagentSessions.add(session.id)
    if (session.header.origin === 'subagent' && !config.subagentNotifications.get()) return
    if (event.type === 'goal/change') {
      // Only the two terminal operations notify. Every other goal mutation
      // (create, edit, pause, resume) also carries a full snapshot, and a
      // resumed goal's snapshot can still read `complete` from an earlier
      // revision, so the operation, never the phase alone, decides.
      const operation = event.data?.operation
      if (operation === 'complete') fireGoal(event.data.goal, 'goalComplete')
      else if (operation === 'block') fireGoal(event.data.goal, 'goalBlocked')
      return
    }
    const reason = event.data.reason?.kind
    if (reason === 'completed') fireTurnComplete(session, event.data.turn)
    else if (reason === 'max-tokens') fireStalled(session)
    else if (reason === 'error') fireTurnFailed(session, event.data.reason.error)
    // `aborted`, `blocked`, `interrupted`, and `forked` end a turn without a
    // notification, by contract.
  })

  ctx.on('approval/request', (req, next) => {
    // Observer only: the waterfall must continue, otherwise this listener
    // would claim the request and every approval would resolve as
    // 'unavailable'.
    notifyApproval(req)
    return next()
  })

  ctx.on('user-questions/request', (req, next) => {
    // Observer only, for the same reason as the approval waterfall: claiming
    // it would answer the question with nothing and every ask would fail.
    notifyQuestion(req)
    return next()
  })
}
