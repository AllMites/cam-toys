// RGBA (from readPixels on the output FBO) → BGR24 for the virtual camera.
// Engine textures keep row 0 = image top, so readPixels is already top-down: no flip needed.
export function rgbaToBgr(src: Uint8Array, dst: Uint8Array): Uint8Array {
  const n = src.length >> 2
  if (dst.length < n * 3) throw new RangeError(`dst too small: ${dst.length} < ${n * 3}`)
  for (let i = 0, j = 0; i < n * 4; i += 4, j += 3) {
    dst[j] = src[i + 2]
    dst[j + 1] = src[i + 1]
    dst[j + 2] = src[i]
  }
  return dst
}
