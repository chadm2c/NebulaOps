const decoder = new TextDecoder('utf-8')

const DEBUG = (() => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('terminal_debug') === '1'
  } catch {
    return false
  }
})()

const FRAME_WINDOW_MS = 1000
let frameCount = 0
let byteCount = 0
let firstFrameTs = 0
let lastFrameTs = 0

export function logFrame(kind, byteLen) {
  if (!DEBUG) return
  const now = performance.now()
  if (!firstFrameTs) firstFrameTs = now
  frameCount++
  byteCount += byteLen
  const elapsed = now - firstFrameTs
  const gap = lastFrameTs ? now - lastFrameTs : 0
  lastFrameTs = now
  if (elapsed >= FRAME_WINDOW_MS) {
    const kbps = (byteCount / 1024).toFixed(2)
    const meanGap = frameCount > 1 ? (elapsed / (frameCount - 1)).toFixed(2) : '0'
    console.debug(
      `[terminal] +${frameCount} frames, ${kbps} KB/s, mean gap ${meanGap}ms (${kind})`
    )
    frameCount = 0
    byteCount = 0
    firstFrameTs = now
  } else if (gap > 50) {
    console.debug(`[terminal] slow gap ${gap.toFixed(1)}ms before ${kind} frame (${byteLen}B)`)
  }
}

export function decodeBytes(bytes) {
  return decoder.decode(bytes)
}
