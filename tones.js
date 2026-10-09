// Custom tone storage, upload validation, and the static tone route.
//
// Preset WAVs ship inside the plugin directory; user uploads live under the
// configured dataRoot in a `custom` subdirectory. The route serves both from
// one prefix with document-relative URLs, so it works behind any reverse
// proxy without knowing the public origin.

import { createReadStream } from 'node:fs'
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { usableTones } from './config.js'

/** Route prefix serving every tone file. */
export const TONE_ROUTE_PREFIX = '/notifications/tones'

/** Upload formats accepted by extension and by content sniffing. */
const FORMATS = {
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
}

/**
 * Tone file names are restricted to this alphabet: no path separators, no
 * `..`. Exported so the delete path can re-check a stored manifest entry
 * before unlinking anything.
 */
export const SAFE_FILE = /^[a-z0-9][a-z0-9._-]*$/

/** True only for the plugin's own format keys, never for prototype names. */
function isFormat(extension) {
  return Object.hasOwn(FORMATS, extension)
}

/**
 * Detect the container format from magic bytes. The extension alone is not
 * trusted: a file must actually carry the container it claims.
 * @param buffer - uploaded bytes.
 * @returns the detected format id or undefined.
 */
export function detectFormat(buffer) {
  if (buffer.length >= 12 && buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WAVE')
    return 'wav'
  if (buffer.length >= 4 && buffer.toString('latin1', 0, 4) === 'OggS') return 'ogg'
  if (buffer.length >= 3 && buffer.toString('latin1', 0, 3) === 'ID3') return 'mp3'
  // MPEG frame sync: 11 set bits at the start of a frame header.
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'mp3'
  return undefined
}

/**
 * Sanitize a user-supplied display name: lowercase, only `[a-z0-9._-]` and
 * spaces, collapsed separators, bounded length.
 * @param name - raw display name.
 * @returns the sanitized name, or undefined when nothing usable remains.
 */
export function sanitizeName(name) {
  if (typeof name !== 'string') return undefined
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._\- ]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.\s]+|[-\s]+$/g, '')
    .slice(0, 40)
  if (cleaned === '' || cleaned === '..') return undefined
  return cleaned
}

/**
 * Validate an upload: size cap, container sniffing, and agreement between
 * the declared extension and the detected content.
 * @param buffer - uploaded bytes.
 * @param extension - declared extension without the dot (wav/ogg/mp3).
 * @param maxBytes - configured size cap.
 * @returns `{ format }` or `{ error }`.
 */
export function validateUpload(buffer, extension, maxBytes) {
  if (!isFormat(extension)) return { error: 'only .wav, .ogg, and .mp3 files are accepted' }
  if (buffer.length === 0) return { error: 'uploaded file is empty' }
  if (buffer.length > maxBytes) return { error: `file exceeds the ${maxBytes} byte limit` }
  const format = detectFormat(buffer)
  if (format === undefined) return { error: 'file content is not a recognized wav, ogg, or mp3' }
  if (format !== extension) return { error: `file content is ${format}, not the declared ${extension}` }
  return { format }
}

/**
 * Write one custom tone into the data directory atomically: bytes land in a
 * `.part` file first, then a rename makes it visible, so a crash mid-write
 * never exposes a truncated tone.
 * @param dataRoot - plugin data directory.
 * @param file - safe file name (id + extension).
 * @param buffer - tone bytes.
 * @returns resolves once the file is in place.
 */
export async function saveCustomTone(dataRoot, file, buffer) {
  const dir = join(dataRoot, 'custom')
  await mkdir(dir, { recursive: true })
  const target = join(dir, file)
  const part = `${target}.part`
  await writeFile(part, buffer)
  await rename(part, target)
}

/**
 * Remove one custom tone file; a missing file is not an error.
 * @param dataRoot - plugin data directory.
 * @param file - safe file name.
 * @returns resolves when the file is gone.
 */
export async function removeCustomTone(dataRoot, file) {
  try {
    await unlink(join(dataRoot, 'custom', file))
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

/**
 * Build the tone route handler.
 * @param options - `{ presetDir, presetFiles, config }`: the plugin's shipped
 *   tones, the file names they are served under, and the live config (for the
 *   custom manifest).
 * @returns a webServer request handler.
 */
export function createToneHandler({ presetDir, presetFiles, config }) {
  const presets = new Set(presetFiles)
  return async (request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { allow: 'GET, HEAD' })
      response.end()
      return
    }
    const url = new URL(request.url ?? '/', 'http://localhost')
    const name = decodeURIComponent(url.pathname.slice(TONE_ROUTE_PREFIX.length + 1))
    if (!SAFE_FILE.test(name) || name.includes('..')) {
      response.writeHead(404)
      response.end()
      return
    }
    const extension = name.slice(name.lastIndexOf('.') + 1)
    const mime = isFormat(extension) ? FORMATS[extension] : undefined
    if (mime === undefined) {
      response.writeHead(404)
      response.end()
      return
    }
    // Presets come from the plugin directory; custom files must be listed in
    // the config manifest, so stray or half-written uploads are never served.
    // The manifest is read through `usableTones`: the loader accepts malformed
    // rows, and touching `tone.file` on one would throw inside the route.
    // Custom names embed a fresh id per upload and are never rewritten in
    // place, so long caching is sound for both kinds.
    const isPreset = presets.has(name)
    let path = join(presetDir, name)
    if (!isPreset) {
      const listed = usableTones(config.customTones.get()).some((tone) => tone.file === name)
      if (!listed) {
        response.writeHead(404)
        response.end()
        return
      }
      path = join(config.dataRoot, 'custom', name)
    }
    let size
    try {
      size = (await stat(path)).size
    } catch {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, {
      'content-type': mime,
      'content-length': String(size),
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
    })
    if (request.method === 'HEAD') {
      response.end()
      return
    }
    createReadStream(path).pipe(response)
  }
}
