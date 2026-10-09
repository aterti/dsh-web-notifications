// Generates the seven preset notification tones as 16-bit PCM mono WAV
// files under tones/. Deterministic: no randomness beyond a fixed-seed
// generator, no dependencies. Run with: node tools/generate-tones.mjs
//
// Every tone is peak-normalised to the same level so switching tones never
// changes perceived loudness, kept under two seconds, and shaped to stay
// distinguishable at low volume.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLE_RATE = 44100
const PEAK = 0.8

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'tones')

/** Fixed-seed noise source so the generated files are byte-stable. */
function makeNoise(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return (state / 0xffffffff) * 2 - 1
  }
}

/** One-pole low-pass filter for the knock thumps. */
function lowpass(noise, coefficient) {
  let previous = 0
  return () => {
    previous = previous + coefficient * (noise() - previous)
    return previous
  }
}

/**
 * Render one tone.
 * @param seconds - tone length.
 * @param sample - function (time, noise) producing a sample in [-1, 1].
 * @returns normalized, click-free PCM samples.
 */
function render(seconds, sample) {
  const count = Math.round(seconds * SAMPLE_RATE)
  const noise = makeNoise(0x5eed)
  const raw = new Float64Array(count)
  let peak = 0
  for (let i = 0; i < count; i += 1) {
    const value = sample(i / SAMPLE_RATE, noise)
    raw[i] = value
    const magnitude = Math.abs(value)
    if (magnitude > peak) peak = magnitude
  }
  const scale = peak > 0 ? PEAK / peak : 0
  const fade = Math.round(0.01 * SAMPLE_RATE)
  const out = new Int16Array(count)
  for (let i = 0; i < count; i += 1) {
    // Short fades at both ends keep truncated decays from clicking.
    let envelope = scale
    if (i < fade) envelope *= i / fade
    const remaining = count - i
    if (remaining < fade) envelope *= remaining / fade
    out[i] = Math.max(-32768, Math.min(32767, Math.round(raw[i] * envelope * 32767)))
  }
  return out
}

/** Exponential decay envelope with a hard gate after `length` seconds. */
function decay(t, start, length, rate) {
  if (t < start || t > start + length) return 0
  return Math.exp(-(t - start) * rate)
}

const TONES = {
  // Two inharmonic bell strikes (E5 then A5): warm, "meeting over" feel.
  chime: {
    seconds: 1.7,
    sample: (t) => {
      const partials = (start, f0) =>
        [1, 2.76, 5.4].reduce(
          (sum, ratio, index) =>
            sum +
            (Math.sin(2 * Math.PI * f0 * ratio * (t - start)) * decay(t, start, 1.7, 3 + index * 1.5)) / (index + 1.5),
          0,
        )
      return partials(0, 659.25) + partials(0.4, 880)
    },
  },
  // Single bright ping: minimal "something happened" cue.
  ping: {
    seconds: 0.5,
    sample: (t) =>
      Math.sin(2 * Math.PI * 880 * t) * decay(t, 0, 0.5, 8) +
      0.35 * Math.sin(2 * Math.PI * 1760 * t) * decay(t, 0, 0.5, 12),
  },
  // Quick upward sweep with a pop: friendly "arrived" cue.
  bubble: {
    seconds: 0.4,
    sample: (t) => {
      if (t > 0.4) return 0
      // Frequency sweeps 350 Hz to 950 Hz over the tone body.
      const frequency = 350 * Math.pow(950 / 350, t / 0.3)
      return Math.sin(2 * Math.PI * frequency * t) * decay(t, 0, 0.4, 7)
    },
  },
  // Short wooden strike (C5 with a 4x partial): soft but percussive.
  marimba: {
    seconds: 0.9,
    sample: (t) =>
      Math.sin(2 * Math.PI * 523.25 * t) * decay(t, 0, 0.9, 5) +
      0.4 * Math.sin(2 * Math.PI * 2093 * t) * decay(t, 0, 0.9, 14),
  },
  // Two low thuds on a door: impossible to mistake for the others.
  knock: {
    seconds: 0.55,
    sample: (t) => {
      const thump = lowpass(makeNoise(0x1234), 0.05)
      const body = (start) => (Math.sin(2 * Math.PI * 160 * (t - start)) + 0.8 * thump()) * decay(t, start, 0.16, 26)
      return body(0) + body(0.2)
    },
  },
  // Two-pitch siren: urgent, for token-limit stalls.
  alarm: {
    seconds: 1.4,
    sample: (t) => {
      if (t > 1.4) return 0
      const segment = Math.floor(t / 0.2) % 2 === 0 ? 800 : 1070
      const gate = 1 - Math.min(1, Math.max(0, ((t % 0.2) - 0.16) / 0.04))
      return (Math.sin(2 * Math.PI * segment * t) + 0.3 * Math.sin(2 * Math.PI * segment * 3 * t)) * gate
    },
  },
  // Three crisp ticks: "check this" without alarm fatigue.
  'triple-tick': {
    seconds: 0.6,
    sample: (t) => {
      const tick = (start) =>
        Math.sin(2 * Math.PI * 2200 * (t - start)) * decay(t, start, 0.06, 70) +
        0.5 * makeNoise(0x2710 + Math.round(start * 1000))() * decay(t, start, 0.02, 120)
      return tick(0) + tick(0.16) + tick(0.32)
    },
  },
}

/** Encode samples as a minimal RIFF WAVE file. */
function wav(samples) {
  const header = Buffer.alloc(44)
  const bytes = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + bytes.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(bytes.length, 40)
  return Buffer.concat([header, bytes])
}

mkdirSync(outDir, { recursive: true })
for (const [id, definition] of Object.entries(TONES)) {
  const file = join(outDir, `${id}.wav`)
  writeFileSync(file, wav(render(definition.seconds, definition.sample)))
  console.log(`wrote tones/${id}.wav`)
}
