// Generate app + tray icons (purple→pink rounded square, white lens ring) with no deps.
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
const clamp = (v) => Math.max(0, Math.min(1, v))

function png(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  const r = size * 0.22 // corner radius
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5
      // rounded-square coverage via signed distance
      const qx = Math.max(Math.abs(px - size / 2) - (size / 2 - r), 0)
      const qy = Math.max(Math.abs(py - size / 2) - (size / 2 - r), 0)
      const sq = clamp(r - Math.hypot(qx, qy) + 0.5)
      const t = (px + py) / (2 * size) // diagonal gradient
      let R = 0x8b + (0xec - 0x8b) * t, G = 0x5c + (0x48 - 0x5c) * t, B = 0xf6 + (0x99 - 0xf6) * t
      const d = Math.hypot(px - size / 2, py - size / 2)
      const ring = clamp(size * 0.035 - Math.abs(d - size * 0.28) + 0.5)
      const dot = clamp(size * 0.07 - d + 0.5)
      const w = Math.max(ring, dot)
      R += (255 - R) * w; G += (255 - G) * w; B += (255 - B) * w
      const i = y * (size * 4 + 1) + 1 + x * 4
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = sq * 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ])
}

writeFileSync('build/icon.png', png(512))
writeFileSync('resources/tray.png', png(32))
console.log('wrote build/icon.png, resources/tray.png')
