import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
mkdirSync(OUT, { recursive: true })

const INK = [7, 18, 14]
const GOLD = [232, 180, 92]
const GOLD_DIM = [180, 137, 70]

const crcTable = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let o = 0
  for (let y = 0; y < size; y++) {
    raw[o++] = 0
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      raw[o++] = pixels[i]
      raw[o++] = pixels[i + 1]
      raw[o++] = pixels[i + 2]
      raw[o++] = pixels[i + 3]
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** Signed distance to a rounded rectangle, for cheap anti-aliasing. */
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r)
  const qy = Math.abs(py - cy) - (hh - r)
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
  )
}

function blend(dst, i, colour, a) {
  if (a <= 0) return
  const inv = 1 - a
  dst[i] = Math.round(dst[i] * inv + colour[0] * a)
  dst[i + 1] = Math.round(dst[i + 1] * inv + colour[1] * a)
  dst[i + 2] = Math.round(dst[i + 2] * inv + colour[2] * a)
  dst[i + 3] = 255
}

/**
 * A departure board: a gold plate with three ink rows on it, sitting on the
 * deep ink ground the app itself uses.
 */
function draw(size, { padding }) {
  const p = new Uint8Array(size * size * 4)
  const S = size

  // ground
  for (let i = 0; i < S * S; i++) {
    p[i * 4] = INK[0]
    p[i * 4 + 1] = INK[1]
    p[i * 4 + 2] = INK[2]
    p[i * 4 + 3] = 255
  }

  const inset = S * padding
  const plateHW = (S - inset * 2) / 2
  const plateHH = plateHW * 0.86
  const cx = S / 2
  const cy = S / 2
  const radius = plateHW * 0.26

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      const px = x + 0.5
      const py = y + 0.5

      // gold plate
      const d = sdRoundRect(px, py, cx, cy, plateHW, plateHH, radius)
      const aPlate = Math.min(1, Math.max(0, 0.5 - d))
      if (aPlate > 0) {
        // subtle vertical shade so it does not look flat
        const t = (py - (cy - plateHH)) / (plateHH * 2)
        const shade = GOLD.map((c, k) => Math.round(c * (1 - t * 0.18) + GOLD_DIM[k] * (t * 0.18)))
        blend(p, i, shade, aPlate)
      }

      // three board rows knocked out of the plate
      const rows = 3
      const rowH = plateHH * 0.2
      const gap = plateHH * 0.16
      const totalH = rows * rowH + (rows - 1) * gap
      const top = cy - totalH / 2
      // Left-aligned rows, like rows on a departure board.
      const widths = [0.74, 0.56, 0.4]
      const leftEdge = cx - plateHW * 0.74
      for (let r = 0; r < rows; r++) {
        const ry = top + r * (rowH + gap) + rowH / 2
        const rw = plateHW * widths[r]
        const rd = sdRoundRect(px, py, leftEdge + rw, ry, rw, rowH / 2, rowH / 2)
        const a = Math.min(1, Math.max(0, 0.5 - rd)) * aPlate
        if (a > 0) blend(p, i, INK, a)
      }
    }
  }
  return p
}

const files = [
  ['icon-192.png', 192, 0.1],
  ['icon-512.png', 512, 0.1],
  ['maskable-512.png', 512, 0.2],
]

for (const [name, size, padding] of files) {
  writeFileSync(join(OUT, name), png(size, draw(size, { padding })))
  console.log('wrote', name, size)
}

// Favicon reuses the 192 for simplicity.
writeFileSync(join(OUT, 'favicon.png'), png(192, draw(192, { padding: 0.08 })))
console.log('wrote favicon.png')
