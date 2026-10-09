// Browser half of dsh-web-notifications.
//
// Loaded through the dsh client module loader. The frozen module table only
// offers `react`, so this file is hand-written plain JavaScript built on
// React.createElement; it deliberately imports no dsh client packages so it
// keeps working when dsh reshuffles its internal bundles.

window.__ModuleLoader__.load({
  id: 'dsh-web-notifications',
  factory(require) {
    const React = require('react')
    const { createElement: h, useEffect, useRef, useState, useSyncExternalStore } = React

    const NS = 'notifications'
    const TONE_NONE = 'none'
    const TYPE_IDS = [
      'turnComplete',
      'approvalRequired',
      'agentStalled',
      'turnFailed',
      'inputRequired',
      'goalComplete',
      'goalBlocked',
    ]
    const PRESET_TONES = ['chime', 'ping', 'bubble', 'marimba', 'knock', 'alarm', 'triple-tick']
    // Mirrors the per-type tone defaults in config.js; used to reassign a
    // type when its selected custom tone is deleted.
    const TYPE_DEFAULT_TONES = {
      turnComplete: 'chime',
      approvalRequired: 'ping',
      agentStalled: 'alarm',
      turnFailed: 'alarm',
      inputRequired: 'knock',
      goalComplete: 'chime',
      goalBlocked: 'triple-tick',
    }
    const UPLOAD_EXTENSIONS = ['wav', 'ogg', 'mp3']
    // Mirrors the TEST_BODIES in index.js; used for in-panel preview toasts.
    const PREVIEW_BODIES = {
      turnComplete: 'This is a test notification from dsh-web-notifications.',
      approvalRequired: 'Approval requested: this is a test notification from dsh-web-notifications.',
      agentStalled: 'The reply was cut off by the token limit. Type "continue" to resume.',
      turnFailed: 'The model request failed. (UNKNOWN)',
      inputRequired: 'Which of these should I change? Open dsh to answer.',
      goalComplete: 'Ship the notification settings redesign.',
      goalBlocked: 'The build still fails on the same missing dependency.',
    }
    // Mirrors the defaults in config.js; used by Reset to defaults.
    const CONFIG_DEFAULTS = {
      enabled: true,
      volume: 70,
      muteWhenFocused: false,
      onlyWhenHidden: true,
      maxBodyChars: 200,
      subagentNotifications: false,
      toneMaxBytes: 512000,
      toneMaxCount: 50,
    }
    const TYPE_DEFAULTS = {
      turnComplete: { enabled: true, tone: 'chime' },
      approvalRequired: { enabled: true, tone: 'ping' },
      agentStalled: { enabled: true, tone: 'alarm' },
      turnFailed: { enabled: true, tone: 'alarm' },
      inputRequired: { enabled: true, tone: 'knock' },
      goalComplete: { enabled: true, tone: 'chime' },
      goalBlocked: { enabled: false, tone: 'triple-tick' },
    }

    const DICTIONARY = {
      'section.title': 'Notifications',
      loading: 'Loading notification settings…',
      'master.enable': 'Enable notifications',
      'card.types': 'Notification types',
      'card.behavior': 'Alert behavior',
      'status.stream.retrying': 'Notification stream reconnecting…',
      'permission.deniedHint':
        'Allow notifications for this site in your browser site settings, then reload this page.',
      'permission.enable': 'Enable browser notifications',
      'permission.insecure':
        'This page is not a secure context, so the browser blocks notification cards. Reach dsh over https, or open it on localhost; alerts appear as in-app toasts until then.',
      'permission.unsupported': 'This browser has no Notification API; alerts appear as in-app toasts.',
      'field.volume': 'Tone volume',
      'field.volume.muted': 'Muted',
      'field.muteWhenFocused': 'Mute tones while this tab is focused',
      'field.onlyWhenHidden': 'Only show cards when this tab is not focused',
      'field.maxBodyChars': 'Maximum card body length',
      'field.subagentNotifications': 'Also notify for subagent sessions',
      'type.turnComplete': 'Turn complete',
      'type.turnComplete.hint': 'Fires when the agent finishes its final answer for a turn.',
      'type.approvalRequired': 'Approval needed',
      'type.approvalRequired.hint': 'Fires when the agent asks permission, showing its stated reason.',
      'type.agentStalled': 'Agent stalled',
      'type.agentStalled.hint': 'Fires when a reply is cut off by the output-token limit.',
      'type.turnFailed': 'Turn failed',
      'type.turnFailed.hint':
        'Fires when a turn dies on a provider or network error, after retries are spent. Starts on the same Alarm tone as Agent stalled — give it its own below if you want them told apart by ear.',
      'type.inputRequired': 'Waiting for your answer',
      'type.inputRequired.hint':
        'Fires when the agent stops mid-task to wait for you: a question, or a finished plan ready for review.',
      'type.goalComplete': 'Goal complete',
      'type.goalComplete.hint':
        'Fires when a tracked goal finishes. Starts on the same Chime tone as Turn complete — give it its own below if you want them told apart by ear.',
      'type.goalBlocked': 'Goal blocked',
      'type.goalBlocked.hint':
        'Fires when a goal stops because the agent cannot continue without you, with the reason it gave. Off by default.',
      'type.enabledAria': 'Enable {type} notifications',
      'type.tone': 'Tone',
      'type.test': 'Test',
      'type.testTone': 'Test tone',
      'type.preview': 'Preview',
      'preview.title': 'Preview: {title}',
      'action.reset': 'Reset to defaults',
      'action.resetConfirm': 'Click again to reset everything',
      'action.applyHint': 'Changes apply instantly.',
      'tone.none': 'None',
      'tone.chime': 'Chime',
      'tone.ping': 'Ping',
      'tone.bubble': 'Bubble',
      'tone.marimba': 'Marimba',
      'tone.knock': 'Knock',
      'tone.alarm': 'Alarm',
      'tone.triple-tick': 'Triple tick',
      'tones.title': 'Custom tones',
      'tones.hint': 'Upload .wav, .ogg, or .mp3 files; they appear in the tone pickers.',
      'tones.empty': 'No custom tones yet.',
      'tones.upload': 'Upload tone',
      'tones.uploading': 'Uploading…',
      'tones.drop': 'Or drop an audio file anywhere in this card.',
      'tones.delete': 'Delete',
      'tones.deleteConfirm': 'Confirm delete',
      'tones.save': 'Save',
      'tones.cancel': 'Cancel',
      'tones.rename': 'Rename tone',
      'tones.play': 'Play tone',
      'tones.usedBy': 'Used by: {types}',
      'tones.fallback': '{types} will fall back to its default tone.',
      'tones.count': '{count} of {max} tones · max {size} KB each',
      'tones.badType': 'Only .wav, .ogg, and .mp3 files are accepted.',
      'tones.tooBig': 'That file is larger than the configured tone size limit.',
      'tones.badDecode': 'That file could not be decoded as audio.',
      'tones.failed': 'Upload failed: {error}',
      'sound.unlock': 'Click to enable sound',
    }

    // ---- remote contribution -------------------------------------------------
    // Hand-written invocation descriptors. The host gateway resolves the real
    // service from its Remote markers (source-mode discovery), so the client
    // only needs strict codecs for parameters; results travel as plain JSON.

    function parseObject(value, label) {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError(`${label} must be an object`)
      }
      return value
    }

    const testInputCodec = {
      mode: 'strict',
      typeSymbol: 'dsh-web-notifications#testNotificationInput',
      create: () => ({
        parse(value) {
          const input = parseObject(value, 'test notification input')
          if (typeof input.type !== 'string') throw new TypeError('test notification input requires a string type')
          const parsed = { type: input.type }
          if (typeof input.nonce === 'string') parsed.nonce = input.nonce
          return parsed
        },
      }),
    }

    const uploadInputCodec = {
      mode: 'strict',
      typeSymbol: 'dsh-web-notifications#uploadToneInput',
      create: () => ({
        parse(value) {
          const input = parseObject(value, 'tone upload input')
          for (const field of ['name', 'extension', 'data']) {
            if (typeof input[field] !== 'string') throw new TypeError(`tone upload input requires a string ${field}`)
          }
          return { name: input.name, extension: input.extension, data: input.data }
        },
      }),
    }

    const toneIdCodec = {
      mode: 'strict',
      typeSymbol: 'dsh-web-notifications#toneIdInput',
      create: () => ({
        parse(value) {
          const input = parseObject(value, 'tone id input')
          if (typeof input.id !== 'string') throw new TypeError('tone id input requires a string id')
          return { id: input.id }
        },
      }),
    }

    const REMOTE = {
      package: 'dsh-web-notifications',
      descriptors: [
        {
          id: 'dsh-web-notifications#notifications/follow',
          service: 'notificationsController',
          namespace: 'notifications',
          method: 'follow',
          mode: 'stream',
          invocation: { kind: 'direct' },
          parameters: [],
          cancellation: { parameter: 'signal' },
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-web-notifications#notifications/testNotification',
          service: 'notificationsController',
          namespace: 'notifications',
          method: 'testNotification',
          invocation: { kind: 'direct' },
          parameters: [{ name: 'input', wire: 'input', source: 'json', codec: testInputCodec }],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-web-notifications#notifications/uploadTone',
          service: 'notificationsController',
          namespace: 'notifications',
          method: 'uploadTone',
          invocation: { kind: 'direct' },
          parameters: [{ name: 'input', wire: 'input', source: 'json', codec: uploadInputCodec }],
          result: { mode: 'src-json' },
        },
        {
          id: 'dsh-web-notifications#notifications/deleteTone',
          service: 'notificationsController',
          namespace: 'notifications',
          method: 'deleteTone',
          invocation: { kind: 'direct' },
          parameters: [{ name: 'input', wire: 'input', source: 'json', codec: toneIdCodec }],
          result: { mode: 'src-json' },
        },
      ],
    }

    // ---- in-app toast store --------------------------------------------------
    // Used whenever an OS notification card is impossible (permission not
    // granted, insecure context, or a browser that refuses page-context
    // notifications). The list reference is replaced on every change so
    // useSyncExternalStore sees stable snapshots.

    let toastSeq = 0
    let toastList = []
    const toastListeners = new Set()

    function notifyToasts() {
      for (const listener of toastListeners) listener()
    }

    function pushToast(frame) {
      toastList = [...toastList, { key: ++toastSeq, title: frame.title, body: frame.body }]
      notifyToasts()
    }

    function dismissToast(key) {
      toastList = toastList.filter((toast) => toast.key !== key)
      notifyToasts()
    }

    function subscribeToasts(listener) {
      toastListeners.add(listener)
      return () => toastListeners.delete(listener)
    }

    function clearToasts() {
      toastList = []
      notifyToasts()
    }

    // ---- multi-tab coordination ----------------------------------------------
    // Every open tab receives every frame, so without coordination each frame
    // would produce one card and one tone per tab. A BroadcastChannel claim
    // window elects exactly one tab per frame. Dedupe is per browser: tabs in
    // different browsers cannot see each other's channel, which is accepted
    // and documented.

    const TAB_ID = Math.random().toString(36).slice(2, 10)
    let tabChannel = null
    /** Demo nonces this tab requested; demos render only here. */
    const pendingDemos = new Set()
    let demoSeq = 0

    function openTabChannel() {
      tabChannel = new BroadcastChannel('dsh-web-notifications')
      return () => {
        tabChannel.close()
        tabChannel = null
      }
    }

    /**
     * Decide whether this tab presents a real frame. Every tab announces its
     * claim and waits one short window; the smallest (frame time, tab id)
     * wins, so exactly one tab shows the card and plays the tone.
     * @param frame - incoming frame.
     * @returns true when this tab won (or coordination is unavailable).
     */
    async function claimFrame(frame) {
      if (tabChannel === null) return true
      const claims = new Map()
      const onClaim = (event) => {
        const data = event.data
        if (data !== null && typeof data === 'object' && data.kind === 'claim' && data.id === frame.id)
          claims.set(data.tab, data.at)
      }
      tabChannel.addEventListener('message', onClaim)
      tabChannel.postMessage({ kind: 'claim', id: frame.id, tab: TAB_ID, at: frame.at })
      await new Promise((resolve) => setTimeout(resolve, 150))
      tabChannel.removeEventListener('message', onClaim)
      for (const [tab, at] of claims) {
        if (at < frame.at || (at === frame.at && tab < TAB_ID)) return false
      }
      return true
    }

    // ---- delivery ------------------------------------------------------------

    function osNotificationsUsable() {
      // Firefox and Chrome both hide the Notification API in insecure
      // contexts, so checking the constructor plus isSecureContext covers
      // "API missing" and "API blocked" with one branch.
      return typeof window.Notification === 'function' && window.isSecureContext === true
    }

    function showOsNotification(frame) {
      try {
        const notification = new window.Notification(frame.title, {
          body: frame.body,
          // One card per notification type: Chrome replaces the previous card
          // carrying the same tag, Firefox replaces it only while it is still
          // on screen. Both collapse repeat spam, which is the intent.
          tag: `dsh-web-notifications-${frame.type}`,
          // The Notification API has no sound option (and Firefox ignores
          // renotify), so audio is driven by the shared tone player instead.
          silent: true,
        })
        // Clicking the card focuses the dsh tab; it never types anything.
        notification.onclick = () => window.focus()
        return true
      } catch {
        // Some browser configurations throw for page-context notifications;
        // fall back to the in-app toast rather than losing the alert.
        return false
      }
    }

    async function deliver(frame, settings) {
      const demo = frame.demo === true
      if (demo) {
        // Demo frames reach every tab but render only in the tab that
        // requested one, identified by the nonce it supplied to the host.
        if (!pendingDemos.delete(frame.id)) return
      } else if (!(await claimFrame(frame))) {
        // Another tab won the claim window; it shows the card and plays the
        // tone, so this tab stays completely silent for this frame.
        return
      }
      // The tone plays for every presented frame, including one whose card is
      // suppressed below; `muteWhenFocused` silences it, and frames from the
      // settings panel are never muted.
      void playTone(frame.tone, settings, demo)
      // Suppression: while this tab is visible and focused the user is
      // looking at the answer already, so real cards stay quiet. Frames
      // triggered from the settings panel are never suppressed, so the panel
      // can be exercised while it has focus.
      if (!demo && settings.onlyWhenHidden === true && document.visibilityState === 'visible' && document.hasFocus())
        return
      if (osNotificationsUsable() && window.Notification.permission === 'granted' && showOsNotification(frame)) return
      pushToast(frame)
    }

    function makeFrameHandler(form) {
      return (frame) => {
        if (!frame || typeof frame.type !== 'string' || !TYPE_IDS.includes(frame.type)) return
        const value = form.getSnapshot().value
        if (!value) return
        if (frame.demo !== true) {
          if (value.enabled !== true) return
          const typeConfig = value.types && value.types[frame.type]
          if (!typeConfig || typeConfig.enabled !== true) return
        }
        void deliver(frame, value)
      }
    }

    // ---- tone player ---------------------------------------------------------
    // One shared AudioContext per page (autoplay policy is per-context and
    // browsers cap their number), one master gain for the volume setting, and
    // one active source so hammering Test never overlaps tones.

    let audioContext = null
    let masterGain = null
    let activeSource = null
    /** Tone id -> decoded AudioBuffer, or 'failed' to cache a bad lookup. */
    const decodedTones = new Map()
    const soundListeners = new Set()
    /** True while the context is suspended and needs a user gesture. */
    let soundBlocked = false

    function notifySound() {
      for (const listener of soundListeners) listener()
    }

    function setSoundBlocked(blocked) {
      if (soundBlocked === blocked) return
      soundBlocked = blocked
      notifySound()
    }

    function subscribeSound(listener) {
      soundListeners.add(listener)
      return () => soundListeners.delete(listener)
    }

    function getSoundBlocked() {
      return soundBlocked
    }

    function ensureContext() {
      if (audioContext === null) {
        audioContext = new AudioContext()
        masterGain = audioContext.createGain()
        masterGain.connect(audioContext.destination)
      }
      return audioContext
    }

    function applyVolume(volume) {
      if (masterGain === null) return
      // Squared curve: perceived loudness tracks the 0-100 slider better.
      const level = Math.max(0, Math.min(100, Number(volume) || 0)) / 100
      masterGain.gain.value = level * level * 0.9
    }

    /** Resume a suspended context; only succeeds inside a user gesture. */
    function unlockAudio() {
      if (audioContext === null || audioContext.state === 'running') return
      audioContext.resume().then(
        () => setSoundBlocked(false),
        () => {},
      )
    }

    /** Document-relative tone URL; works behind any reverse proxy. */
    function toneUrl(toneId, settings) {
      if (PRESET_TONES.includes(toneId)) return `notifications/tones/${toneId}.wav`
      const entry = (settings.customTones ?? []).find((tone) => tone.id === toneId)
      return entry === undefined ? undefined : `notifications/tones/${entry.file}`
    }

    function decodeAudioData(arrayBuffer) {
      // The callback form is used instead of the promise form for the oldest
      // Firefox releases still in the wild; both are synchronous-decoding.
      return new Promise((resolve, reject) => {
        ensureContext().decodeAudioData(arrayBuffer, resolve, reject)
      })
    }

    async function decodeTone(toneId, settings) {
      if (decodedTones.has(toneId)) return decodedTones.get(toneId)
      const url = toneUrl(toneId, settings)
      if (url === undefined) {
        decodedTones.set(toneId, 'failed')
        return 'failed'
      }
      try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`status ${String(response.status)}`)
        const buffer = await decodeAudioData(await response.arrayBuffer())
        decodedTones.set(toneId, buffer)
        return buffer
      } catch {
        decodedTones.set(toneId, 'failed')
        return 'failed'
      }
    }

    async function playTone(toneId, settings, demo) {
      if (typeof toneId !== 'string' || toneId === TONE_NONE) return
      // `muteWhenFocused` silences tones while the tab has focus; demo
      // frames from the settings panel always play.
      if (!demo && settings.muteWhenFocused === true && document.hasFocus()) return
      applyVolume(settings.volume)
      const context = ensureContext()
      unlockAudio()
      // Decoding fills the gap the resume promise needs; if the context is
      // still suspended afterwards, no gesture happened yet.
      const buffer = await decodeTone(toneId, settings)
      if (buffer === 'failed') return
      if (context.state !== 'running') {
        setSoundBlocked(true)
        return
      }
      if (activeSource !== null) {
        // Single voice: a new tone interrupts whatever still plays.
        try {
          activeSource.stop()
        } catch {
          // Stopping an already-ended source is fine.
        }
      }
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(masterGain)
      source.onended = () => {
        if (activeSource === source) activeSource = null
      }
      source.start()
      activeSource = source
    }

    function fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
    }

    // ---- follow stream -------------------------------------------------------
    // $stream already reconnects when the WebSocket carrier drops. This pump
    // additionally reopens the stream when the host plugin fiber restarts
    // (config or bundle changes end the generator cleanly). While no stream
    // is live the pump records a retrying state the settings panel surfaces.

    let streamRetrying = false
    const streamListeners = new Set()

    function setStreamRetrying(retrying) {
      if (streamRetrying === retrying) return
      streamRetrying = retrying
      for (const listener of streamListeners) listener()
    }

    function subscribeStream(listener) {
      streamListeners.add(listener)
      return () => streamListeners.delete(listener)
    }

    function startFollowStream(ctx, handleFrame) {
      let disposed = false
      const timers = new Set()
      const wakeups = new Set()

      function delay(ms) {
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            timers.delete(timer)
            wakeups.delete(resolve)
            resolve()
          }, ms)
          timers.add(timer)
          wakeups.add(resolve)
        })
      }

      async function pump() {
        while (!disposed) {
          try {
            const stream = ctx.remote.$stream({
              name: 'dsh-web-notifications',
              open: (signal) => ctx.remote.notifications.follow(signal),
              // A clean end means the host half restarted; the loop reopens
              // the stream, so this error only ends the current generation.
              ended: () => new Error('notification stream ended'),
            })
            // The carrier has no open acknowledgement, so a stream that
            // survives five seconds without throwing counts as live.
            const stable = setTimeout(() => setStreamRetrying(false), 5000)
            timers.add(stable)
            for await (const frame of stream) {
              if (disposed) break
              frame.accept()
              setStreamRetrying(false)
              handleFrame(frame.value)
            }
            clearTimeout(stable)
            timers.delete(stable)
          } catch {
            // Carrier failures and host restarts both land here; the loop
            // retries after a short pause and the panel shows the state.
            setStreamRetrying(true)
          }
          if (disposed) return
          await delay(1000)
        }
      }

      void pump()

      return () => {
        disposed = true
        for (const timer of timers) clearTimeout(timer)
        for (const wake of wakeups) wake()
      }
    }

    // ---- permission state ------------------------------------------------------
    // `Notification.permission` read once at mount goes stale when the user
    // flips the site permission from browser UI. Where the Permissions API
    // exists, the PermissionStatus handle keeps the strip live; where it does
    // not (older Firefox), the one-shot read is the fallback and the Enable
    // button writes the resolved state directly.

    let permissionState = typeof window.Notification === 'function' ? window.Notification.permission : 'unsupported'
    const permissionListeners = new Set()

    function setPermissionState(state) {
      if (permissionState === state) return
      permissionState = state
      for (const listener of permissionListeners) listener()
    }

    function subscribePermission(listener) {
      permissionListeners.add(listener)
      return () => permissionListeners.delete(listener)
    }

    function getPermissionState() {
      return permissionState
    }

    function watchPermission() {
      if (typeof window.Notification !== 'function' || typeof navigator.permissions?.query !== 'function')
        return () => {}
      let disposed = false
      let status = null
      navigator.permissions
        .query({ name: 'notifications' })
        .then((result) => {
          if (disposed) return
          status = result
          setPermissionState(result.state)
          result.onchange = () => setPermissionState(result.state)
        })
        .catch(() => {
          // Some browsers reject the query for notifications; the one-shot
          // read already seeded the state, so nothing more to do.
        })
      return () => {
        disposed = true
        if (status !== null) status.onchange = null
      }
    }

    // ---- settings primitives ---------------------------------------------------
    // The frozen module table only offers `react`, so these replicate the
    // host's settings-field and switch visuals in plugin-owned CSS.

    function Switch({ checked, onChange, label }) {
      return h(
        'button',
        {
          type: 'button',
          role: 'switch',
          className: 'dshn-switch',
          'aria-checked': checked === true ? 'true' : 'false',
          'aria-label': label,
          onClick: () => onChange(!(checked === true)),
        },
        h('span', { className: 'dshn-switch-thumb' }),
      )
    }

    function fieldRow(label, control, hint, labelFor) {
      return h(
        'div',
        { className: 'dshn-field' },
        h(
          'div',
          { className: 'dshn-field-head' },
          labelFor === undefined
            ? h('span', { className: 'dshn-label' }, label)
            : h('label', { className: 'dshn-label', htmlFor: labelFor }, label),
          ...control,
        ),
        hint === undefined ? null : h('div', { className: 'dshn-hint' }, hint),
      )
    }

    const ICON_PATHS = {
      play: h('path', { d: 'M5.5 3.9 12 8l-6.5 4.1z', fill: 'currentColor', stroke: 'none' }),
      pencil: h('path', { d: 'M11.7 2.9a1.3 1.3 0 0 1 1.8 1.8L6.5 11.7 3.4 12.6l.9-3.1z' }),
      trash: h('path', { d: 'M3.4 4.6h9.2M6.6 4.6V3.1h2.8v1.5M4.8 4.6l.5 8.3h5.4l.5-8.3' }),
    }

    function icon(name) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 14,
          height: 14,
          'aria-hidden': 'true',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        },
        ICON_PATHS[name],
      )
    }

    function StatusStrip({ t, retrying }) {
      // Quiet by design: no status readout while everything works. The strip
      // only appears when something needs attention — a permission that is
      // not granted yet, a blocked or impossible card channel, or a stream
      // that is reconnecting.
      const permission = useSyncExternalStore(subscribePermission, getPermissionState)
      const secure = window.isSecureContext === true
      const supported = typeof window.Notification === 'function'
      const notes = []
      if (!secure) notes.push(t('permission.insecure'))
      else if (!supported) notes.push(t('permission.unsupported'))
      else if (permission === 'denied') notes.push(t('permission.deniedHint'))
      if (retrying) notes.push(t('status.stream.retrying'))
      const enableButton = secure && supported && permission === 'default'
      if (notes.length === 0 && !enableButton) return null
      return h(
        'div',
        { className: 'dshn-status', role: 'status', 'aria-live': 'polite' },
        ...notes.map((note, index) =>
          h(
            'div',
            { key: index, className: `dshn-hint${retrying && index === notes.length - 1 ? ' dshn-status-warn' : ''}` },
            note,
          ),
        ),
        enableButton
          ? // Browsers reject requestPermission() outside a user gesture, so
            // the prompt is only ever reachable through this button.
            h(
              'button',
              {
                className: 'dshn-btn dshn-btn-primary',
                onClick: () => void window.Notification.requestPermission().then(setPermissionState),
              },
              t('permission.enable'),
            )
          : null,
      )
    }

    function TypeRow({ typeId, t, value, write, sendTest }) {
      // A stored document predating a new type has no subtree for it; the
      // schema defaults it on the host, and this mirror keeps the row usable.
      const typeValue = value.types[typeId] ?? TYPE_DEFAULTS[typeId]
      const selectId = `dshn-tone-${typeId}`
      return h(
        'div',
        { className: 'dshn-field' },
        h(
          'div',
          { className: 'dshn-field-head' },
          h('span', { className: 'dshn-label' }, t(`type.${typeId}`)),
          h(Switch, {
            checked: typeValue.enabled,
            label: t('type.enabledAria', { type: t(`type.${typeId}`) }),
            onChange: (checked) => write(['types', typeId, 'enabled'], checked),
          }),
        ),
        h('div', { className: 'dshn-hint' }, t(`type.${typeId}.hint`)),
        h(
          'div',
          { className: 'dshn-control-row' },
          h('label', { className: 'dshn-sublabel', htmlFor: selectId }, t('type.tone')),
          h(
            'select',
            {
              id: selectId,
              className: 'dshn-select',
              value: typeValue.tone,
              onChange: (event) => write(['types', typeId, 'tone'], event.target.value),
            },
            h('option', { value: TONE_NONE }, t('tone.none')),
            ...PRESET_TONES.map((toneId) => h('option', { key: toneId, value: toneId }, t(`tone.${toneId}`))),
            ...(value.customTones ?? []).map((tone) => h('option', { key: tone.id, value: tone.id }, tone.name)),
          ),
          h(
            'button',
            {
              className: 'dshn-btn dshn-btn-icon',
              'aria-label': t('type.testTone'),
              title: t('type.testTone'),
              // Demo playback: always audible, ignores muteWhenFocused.
              onClick: () => void playTone(typeValue.tone, value, true),
            },
            icon('play'),
          ),
        ),
        h(
          'div',
          { className: 'dshn-action-row' },
          // Preview stays inside the panel (toast), so the card layout and
          // wording can be checked without raising an OS notification.
          h(
            'button',
            {
              className: 'dshn-btn dshn-btn-tool',
              onClick: () =>
                pushToast({ title: t('preview.title', { title: t(`type.${typeId}`) }), body: PREVIEW_BODIES[typeId] }),
            },
            t('type.preview'),
          ),
          h('button', { className: 'dshn-btn dshn-btn-tool', onClick: () => void sendTest(typeId) }, t('type.test')),
        ),
      )
    }

    function CustomTonesPanel({ t, value, write, uploadTone, deleteToneRemote }) {
      const [error, setError] = useState('')
      const [renaming, setRenaming] = useState(null)
      const [confirmDelete, setConfirmDelete] = useState(null)
      const [uploading, setUploading] = useState(false)
      const [dragging, setDragging] = useState(false)
      const fileRef = useRef(null)
      const tones = value.customTones ?? []

      // Which types pick each tone, so a delete can name what falls back and
      // a row can show where the tone is in use.
      const users = new Map()
      for (const typeId of TYPE_IDS) {
        const tone = value.types[typeId]?.tone
        if (typeof tone === 'string' && tone !== TONE_NONE && !PRESET_TONES.includes(tone)) {
          const list = users.get(tone) ?? []
          list.push(t(`type.${typeId}`))
          users.set(tone, list)
        }
      }

      const uploadFile = async (file) => {
        setError('')
        const extension = (file.name.slice(file.name.lastIndexOf('.') + 1) || '').toLowerCase()
        if (!UPLOAD_EXTENSIONS.includes(extension)) {
          setError(t('tones.badType'))
          return
        }
        if (file.size > (value.toneMaxBytes ?? 512000)) {
          setError(t('tones.tooBig'))
          return
        }
        // The upload must actually decode as audio, not just carry the
        // right extension; the browser is the best decoder to ask.
        let bytes
        try {
          bytes = await file.arrayBuffer()
          await decodeAudioData(bytes.slice(0))
        } catch {
          setError(t('tones.badDecode'))
          return
        }
        setUploading(true)
        try {
          const data = await fileToBase64(new Blob([bytes]))
          const result = await uploadTone({ name: file.name.replace(/\.[^.]+$/, ''), extension, data })
          if (result?.ok === true) write(['customTones'], [...tones, result.tone])
          else setError(t('tones.failed', { error: String(result?.error ?? 'unknown') }))
        } finally {
          setUploading(false)
        }
      }

      const onFile = (event) => {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (file) void uploadFile(file)
      }

      const onDelete = (id) => {
        void deleteToneRemote(id)
        write(
          ['customTones'],
          tones.filter((tone) => tone.id !== id),
        )
        // A type using the deleted tone falls back to its default tone.
        for (const typeId of TYPE_IDS) {
          if (value.types[typeId].tone === id) write(['types', typeId, 'tone'], TYPE_DEFAULT_TONES[typeId])
        }
        decodedTones.delete(id)
        setConfirmDelete(null)
      }

      const onRename = (id, name) => {
        write(
          ['customTones'],
          tones.map((tone) => (tone.id === id ? { ...tone, name } : tone)),
        )
        setRenaming(null)
      }

      const limitKb = Math.max(1, Math.round((value.toneMaxBytes ?? 512000) / 1024))
      return h(
        'div',
        {
          className: `dshn-card${dragging ? ' dshn-card-dropping' : ''}`,
          onDragOver: (event) => {
            event.preventDefault()
            setDragging(true)
          },
          onDragLeave: () => setDragging(false),
          onDrop: (event) => {
            event.preventDefault()
            setDragging(false)
            const file = event.dataTransfer?.files?.[0]
            if (file) void uploadFile(file)
          },
        },
        h('div', { className: 'dshn-card-title' }, t('tones.title')),
        h(
          'div',
          { className: 'dshn-card-hint' },
          `${t('tones.hint')} ${t('tones.count', { count: tones.length, max: value.toneMaxCount ?? 50, size: limitKb })}`,
        ),
        h(
          'div',
          { className: 'dshn-upload-row' },
          h(
            'button',
            { className: 'dshn-btn dshn-btn-primary', disabled: uploading, onClick: () => fileRef.current?.click() },
            uploading ? t('tones.uploading') : t('tones.upload'),
          ),
          h('span', { className: 'dshn-hint' }, t('tones.drop')),
          h('input', {
            ref: fileRef,
            className: 'dshn-file-hidden',
            type: 'file',
            accept: '.wav,.ogg,.mp3',
            tabIndex: -1,
            onChange: onFile,
          }),
        ),
        tones.length === 0 ? h('div', { className: 'dshn-hint' }, t('tones.empty')) : null,
        ...tones.map((tone) => {
          const usedBy = users.get(tone.id) ?? []
          const isRenaming = renaming?.id === tone.id
          return h(
            'div',
            { key: tone.id, className: 'dshn-tone-block' },
            h(
              'div',
              { className: 'dshn-tone-row' },
              h(
                'button',
                {
                  className: 'dshn-btn dshn-btn-icon',
                  'aria-label': t('tones.play'),
                  title: t('tones.play'),
                  onClick: () => void playTone(tone.id, value, true),
                },
                icon('play'),
              ),
              isRenaming
                ? h(
                    'span',
                    { className: 'dshn-rename' },
                    h('input', {
                      className: 'dshn-text',
                      value: renaming.name,
                      autoFocus: true,
                      onChange: (event) => setRenaming({ id: tone.id, name: event.target.value }),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter' && renaming.name.trim() !== '') onRename(tone.id, renaming.name)
                        else if (event.key === 'Escape') setRenaming(null)
                      },
                    }),
                    h(
                      'button',
                      {
                        className: 'dshn-btn dshn-btn-tool',
                        disabled: renaming.name.trim() === '',
                        onClick: () => onRename(tone.id, renaming.name),
                      },
                      t('tones.save'),
                    ),
                    h(
                      'button',
                      { className: 'dshn-btn dshn-btn-tool', onClick: () => setRenaming(null) },
                      t('tones.cancel'),
                    ),
                  )
                : h('span', { className: 'dshn-tone-name' }, tone.name),
              h('span', { className: 'dshn-chip' }, `${Math.max(1, Math.round((tone.bytes ?? 0) / 1024))} KB`),
              usedBy.length === 0
                ? null
                : h(
                    'span',
                    { className: 'dshn-chip dshn-chip-usage' },
                    t('tones.usedBy', { types: usedBy.join(', ') }),
                  ),
              h('span', { className: 'dshn-spacer' }),
              isRenaming
                ? null
                : h(
                    'button',
                    {
                      className: 'dshn-btn dshn-btn-icon',
                      'aria-label': t('tones.rename'),
                      title: t('tones.rename'),
                      onClick: () => setRenaming({ id: tone.id, name: tone.name }),
                    },
                    icon('pencil'),
                  ),
              isRenaming
                ? null
                : h(
                    'button',
                    {
                      className: `dshn-btn ${confirmDelete === tone.id ? 'dshn-btn-danger' : 'dshn-btn-icon'}`,
                      'aria-label': confirmDelete === tone.id ? t('tones.deleteConfirm') : t('tones.delete'),
                      title: confirmDelete === tone.id ? t('tones.deleteConfirm') : t('tones.delete'),
                      onClick: () => (confirmDelete === tone.id ? onDelete(tone.id) : setConfirmDelete(tone.id)),
                    },
                    confirmDelete === tone.id ? t('tones.deleteConfirm') : icon('trash'),
                  ),
            ),
            confirmDelete === tone.id && usedBy.length > 0
              ? h('div', { className: 'dshn-hint' }, t('tones.fallback', { types: usedBy.join(', ') }))
              : null,
          )
        }),
        error === '' ? null : h('div', { className: 'dshn-error', role: 'status', 'aria-live': 'polite' }, error),
      )
    }

    function NotificationsSection({ form, t, sendTest, uploadTone, deleteToneRemote }) {
      // ConfigForm exposes store methods as prototype methods; bind them so
      // useSyncExternalStore can call them without a receiver.
      const snapshot = useSyncExternalStore(
        (listener) => form.subscribe(listener),
        () => form.getSnapshot(),
      )
      const retrying = useSyncExternalStore(subscribeStream, () => streamRetrying)
      const [armedReset, setArmedReset] = useState(false)
      if (snapshot.status !== 'ready' || !snapshot.value) {
        return h('div', { className: 'dshn-hint' }, t('loading'))
      }
      const value = snapshot.value
      const write = (path, next) => {
        void form.mutate([{ op: 'set', path, value: next }])
      }
      const onReset = async () => {
        // Two-step confirm: the first click arms, the second performs.
        if (!armedReset) {
          setArmedReset(true)
          return
        }
        setArmedReset(false)
        const tones = value.customTones ?? []
        for (const tone of tones) {
          void deleteToneRemote(tone.id)
          decodedTones.delete(tone.id)
        }
        const ops = [
          ...Object.entries(CONFIG_DEFAULTS).map(([key, next]) => ({ op: 'set', path: [key], value: next })),
          { op: 'set', path: ['customTones'], value: [] },
          ...TYPE_IDS.flatMap((typeId) =>
            Object.entries(TYPE_DEFAULTS[typeId]).map(([key, next]) => ({
              op: 'set',
              path: ['types', typeId, key],
              value: next,
            })),
          ),
        ]
        await form.mutate(ops)
      }
      return h(
        'div',
        { className: 'dshn-section' },
        h(StatusStrip, { t, retrying }),
        h(
          'div',
          { className: 'dshn-master' },
          h('span', { className: 'dshn-label' }, t('master.enable')),
          h('span', { className: 'dshn-spacer' }),
          h(Switch, {
            checked: value.enabled,
            label: t('master.enable'),
            onChange: (checked) => write(['enabled'], checked),
          }),
        ),
        // The master switch off dims the type cards but keeps them operable,
        // so per-type setup stays editable while nothing fires.
        h(
          'div',
          { className: `dshn-card${value.enabled === true ? '' : ' dshn-card-dim'}` },
          h('div', { className: 'dshn-card-title' }, t('card.types')),
          ...TYPE_IDS.map((typeId) => h(TypeRow, { key: typeId, typeId, t, value, write, sendTest })),
        ),
        h(
          'div',
          { className: 'dshn-card' },
          h('div', { className: 'dshn-card-title' }, t('card.behavior')),
          fieldRow(
            t('field.volume'),
            [
              h('input', {
                key: 'range',
                id: 'dshn-volume',
                className: 'dshn-range',
                type: 'range',
                min: 0,
                max: 100,
                step: 1,
                value: value.volume,
                onChange: (event) => write(['volume'], Number(event.target.value)),
              }),
              h('span', { key: 'value', className: 'dshn-value' }, String(value.volume)),
              value.volume === 0 ? h('span', { key: 'muted', className: 'dshn-chip' }, t('field.volume.muted')) : null,
            ],
            undefined,
            'dshn-volume',
          ),
          fieldRow(t('field.onlyWhenHidden'), [
            h(Switch, {
              key: 'switch',
              checked: value.onlyWhenHidden,
              label: t('field.onlyWhenHidden'),
              onChange: (checked) => write(['onlyWhenHidden'], checked),
            }),
          ]),
          fieldRow(t('field.muteWhenFocused'), [
            h(Switch, {
              key: 'switch',
              checked: value.muteWhenFocused,
              label: t('field.muteWhenFocused'),
              onChange: (checked) => write(['muteWhenFocused'], checked),
            }),
          ]),
          fieldRow(t('field.subagentNotifications'), [
            h(Switch, {
              key: 'switch',
              checked: value.subagentNotifications,
              label: t('field.subagentNotifications'),
              onChange: (checked) => write(['subagentNotifications'], checked),
            }),
          ]),
          fieldRow(
            t('field.maxBodyChars'),
            [
              h('input', {
                key: 'number',
                id: 'dshn-maxBodyChars',
                className: 'dshn-number',
                type: 'number',
                min: 20,
                max: 250,
                step: 1,
                value: value.maxBodyChars,
                onChange: (event) => {
                  const next = Number(event.target.value)
                  if (Number.isFinite(next)) write(['maxBodyChars'], next)
                },
              }),
            ],
            undefined,
            'dshn-maxBodyChars',
          ),
        ),
        h(CustomTonesPanel, { t, value, write, uploadTone, deleteToneRemote }),
        h(
          'div',
          { className: 'dshn-footer' },
          h('span', { className: 'dshn-hint' }, t('action.applyHint')),
          h('span', { className: 'dshn-spacer' }),
          h(
            'button',
            {
              className: `dshn-btn ${armedReset ? 'dshn-btn-danger' : 'dshn-btn-tool'}`,
              onClick: () => void onReset(),
            },
            armedReset ? t('action.resetConfirm') : t('action.reset'),
          ),
        ),
      )
    }

    // ---- toast overlay ---------------------------------------------------------

    function SoundUnlockAffordance({ t }) {
      const blocked = useSyncExternalStore(subscribeSound, getSoundBlocked)
      if (!blocked) return null
      // After a reload the AudioContext starts suspended and browsers only
      // resume it from a user gesture, so the page offers exactly one click
      // target that performs that gesture.
      return h('button', { className: 'dshn-sound-unlock', onClick: unlockAudio }, t('sound.unlock'))
    }

    function ToastStack({ dismiss }) {
      const toasts = useSyncExternalStore(subscribeToasts, () => toastList)
      useEffect(() => {
        if (toasts.length === 0) return
        const timers = toasts.map((toast) => setTimeout(() => dismiss(toast.key), 10000))
        return () => {
          for (const timer of timers) clearTimeout(timer)
        }
      }, [toasts, dismiss])
      if (toasts.length === 0) return null
      return h(
        'div',
        { className: 'dshn-toasts', role: 'status' },
        toasts.map((toast) =>
          h(
            'div',
            { key: toast.key, className: 'dshn-toast' },
            h('div', { className: 'dshn-toast-title' }, toast.title),
            h('div', { className: 'dshn-toast-body' }, toast.body),
            h(
              'button',
              {
                className: 'dshn-toast-close',
                onClick: () => dismiss(toast.key),
                'aria-label': 'Dismiss',
              },
              '×',
            ),
          ),
        ),
      )
    }

    // ---- styles -----------------------------------------------------------------
    // Compiled dsh bundles inject <style data-plugin-css> tags; the same
    // pattern keeps this plugin's CSS reversible: the tag is removed on unload.

    const CSS = `
.dshn-section{display:flex;flex-direction:column;gap:14px;padding:16px 0;color:var(--dsw-alias-label-primary)}
.dshn-status{display:flex;flex-direction:column;gap:6px}
.dshn-status-warn{color:var(--dsw-alias-state-warn-primary)}
.dshn-master,.dshn-card{border:0.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-settings-card-fill)}
.dshn-master{display:flex;align-items:center;gap:10px;padding:12px 16px}
.dshn-card{display:flex;flex-direction:column;padding:2px 16px 8px}
.dshn-card-dim{opacity:.55}
.dshn-card-dropping{border-color:var(--dsw-alias-brand-primary)}
.dshn-card-title{font-size:13px;font-weight:600;padding:12px 0 4px}
.dshn-card-hint{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary);padding-bottom:8px}
.dshn-field{display:flex;flex-direction:column;gap:6px;padding:12px 0}
.dshn-field + .dshn-field{border-top:0.5px solid var(--dsw-alias-border-l2)}
.dshn-field-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dshn-label{flex:1;min-width:0;font-size:13px;font-weight:500;line-height:1.5}
.dshn-sublabel{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dshn-hint{font-size:12px;line-height:1.5;color:var(--dsw-alias-label-tertiary)}
.dshn-control-row,.dshn-action-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dshn-action-row{justify-content:flex-end}
.dshn-spacer{flex:1}
.dshn-switch{box-sizing:border-box;position:relative;flex:0 0 auto;width:36px;height:20px;padding:2px;border:0;border-radius:999px;background:var(--dsw-alias-border-l3);cursor:pointer}
.dshn-switch[aria-checked='true']{background:var(--dsw-alias-brand-primary)}
.dshn-switch:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline-offset:2px}
.dshn-switch-thumb{display:block;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-switch-thumb);transition:transform 120ms ease}
.dshn-switch[aria-checked='true'] .dshn-switch-thumb{background:var(--dsw-alias-label-primary-foreground);transform:translateX(16px)}
@media (prefers-reduced-motion: reduce){.dshn-switch-thumb{transition:none}}
.dshn-btn{appearance:none;border:1px solid transparent;border-radius:var(--dsw-radius-md);font:inherit;font-size:13px;line-height:1.5;padding:5px 12px;cursor:pointer}
.dshn-btn:disabled{opacity:.4;cursor:default}
.dshn-btn:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));outline-offset:1px}
.dshn-btn-primary{background:var(--dsw-alias-label-primary);color:var(--dsw-alias-bg-layer-3)}
.dshn-btn-tool{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.dshn-btn-tool:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dshn-btn-danger{border-color:var(--dsw-alias-state-error-primary);background:none;color:var(--dsw-alias-state-error-primary)}
.dshn-btn-danger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}
.dshn-btn-icon{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border-radius:var(--dsw-radius-sm);background:none;color:var(--dsw-alias-label-secondary)}
.dshn-btn-icon:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dshn-select,.dshn-number,.dshn-text{height:30px;padding:0 10px;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-3);font:inherit;font-size:13px;color:var(--dsw-alias-label-primary)}
.dshn-select:focus-visible,.dshn-number:focus-visible,.dshn-text:focus-visible{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.dshn-number{width:72px}
.dshn-range{accent-color:var(--dsw-alias-brand-primary);width:140px}
.dshn-value{font-size:12px;color:var(--dsw-alias-label-secondary);min-width:2.5em}
.dshn-chip{display:inline-flex;align-items:center;border:0.5px solid var(--dsw-alias-border-l2);border-radius:999px;padding:1px 8px;font-size:11px;color:var(--dsw-alias-label-secondary)}
.dshn-chip-usage{color:var(--dsw-alias-label-primary-bluish)}
.dshn-upload-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-bottom:8px}
.dshn-file-hidden{display:none}
.dshn-tone-block{border-top:0.5px solid var(--dsw-alias-border-l2);padding:6px 0}
.dshn-tone-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dshn-tone-name{font-size:13px;font-weight:500}
.dshn-rename{display:inline-flex;align-items:center;gap:6px}
.dshn-error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:1.5}
.dshn-footer{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.dshn-sound-unlock{position:fixed;left:16px;bottom:16px;z-index:2147483000;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-label-primary);padding:8px 14px;cursor:pointer;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.dshn-toasts{position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;flex-direction:column;gap:8px;max-width:360px}
.dshn-toast{position:relative;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);border-radius:8px;padding:10px 32px 10px 12px;box-shadow:0 6px 24px rgba(0,0,0,.35)}
.dshn-toast-title{font-weight:600;margin-bottom:4px}
.dshn-toast-body{color:var(--dsw-alias-label-secondary);font-size:13px;line-height:1.45;white-space:pre-line}
.dshn-toast-close{position:absolute;top:6px;right:8px;border:none;background:none;color:var(--dsw-alias-label-secondary);font-size:16px;cursor:pointer}
`

    function installStyles() {
      const tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-web-notifications'
      tag.textContent = CSS
      document.head.appendChild(tag)
      return () => tag.remove()
    }

    // ---- activation --------------------------------------------------------------

    async function apply(ctx) {
      // $mount registers its own teardown effect on this context, so the
      // contribution disappears when the plugin fiber unloads.
      await ctx.remote.$mount(REMOTE)

      // The namespace service only exists after the mount, so it is declared
      // as a dependency here (the same pattern the voice-input client uses
      // for `remote.speech`); the callback's context resolves it.
      ctx.inject(['remote.notifications'], (injected) => {
        const t = injected.locale.bind(NS)
        injected.effect(() => injected.locale.register(NS, 'en', DICTIONARY), 'notifications: dictionary')
        injected.effect(() => installStyles(), 'notifications: styles')
        injected.effect(() => watchPermission(), 'notifications: permission watch')

        const form = injected.configForms.get(NS)
        const handleFrame = makeFrameHandler(form)
        injected.effect(() => startFollowStream(injected, handleFrame), 'notifications: follow stream')
        injected.effect(() => openTabChannel(), 'notifications: tab channel')

        // Browsers keep a freshly created AudioContext suspended until the
        // page receives a user gesture; any click or keydown unlocks it.
        // The listeners stay attached (unlockAudio is a no-op once running)
        // so a context suspended by a later browser policy also recovers.
        injected.effect(() => {
          document.addEventListener('click', unlockAudio)
          document.addEventListener('keydown', unlockAudio)
          return () => {
            document.removeEventListener('click', unlockAudio)
            document.removeEventListener('keydown', unlockAudio)
          }
        }, 'notifications: audio unlock listeners')

        injected.effect(
          () =>
            injected.configForms.whileServed([NS], () =>
              injected.slots.inject('settings.section', () =>
                injected.slots.register(
                  {
                    name: 'settings.section',
                    id: NS,
                    order: 30,
                    label: () => t('section.title'),
                    locale: NS,
                    inject: () => ({
                      form,
                      t,
                      // The nonce identifies this tab's demo request, so the
                      // demo card renders only where the button was pressed.
                      sendTest: (type) => {
                        const nonce = `${TAB_ID}-d${++demoSeq}`
                        pendingDemos.add(nonce)
                        return injected.remote.notifications.testNotification({ type, nonce })
                      },
                      uploadTone: (input) => injected.remote.notifications.uploadTone(input),
                      deleteToneRemote: (id) => injected.remote.notifications.deleteTone({ id }),
                    }),
                  },
                  NotificationsSection,
                ),
              ),
            ),
          'notifications: settings section',
        )

        injected.effect(
          () =>
            injected.slots.inject('shell.overlay', () =>
              injected.slots.register(
                {
                  name: 'shell.overlay',
                  id: 'notifications-toast',
                  locale: NS,
                  inject: () => ({ dismiss: dismissToast }),
                },
                ToastStack,
              ),
            ),
          'notifications: toast overlay',
        )

        injected.effect(
          () =>
            injected.slots.inject('shell.overlay', () =>
              injected.slots.register(
                {
                  name: 'shell.overlay',
                  id: 'notifications-sound',
                  locale: NS,
                  inject: () => ({ t }),
                },
                SoundUnlockAffordance,
              ),
            ),
          'notifications: sound unlock overlay',
        )

        injected.effect(
          () => () => {
            // Unload leaves no audio behind: stop any playing tone, close the
            // context (its decoded cache goes with it), reset module state.
            if (activeSource !== null) {
              try {
                activeSource.stop()
              } catch {
                // Already ended.
              }
              activeSource = null
            }
            if (audioContext !== null) void audioContext.close()
            audioContext = null
            masterGain = null
            decodedTones.clear()
            setSoundBlocked(false)
          },
          'notifications: audio teardown',
        )

        injected.effect(() => () => clearToasts(), 'notifications: toast teardown')
      })
    }

    return { inject: ['remote', 'slots', 'locale', 'configForms'], apply }
  },
})
