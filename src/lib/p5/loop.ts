import type p5 from 'p5'

export function createRedrawRequester(getInstance: () => p5 | null) {
  let queued = false
  return function requestRedraw() {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      const p = getInstance()
      if (p && !p.isLooping()) p.redraw()
    })
  }
}

export function setLooping(p: p5, animate: boolean, beforeStart?: () => void) {
  if (animate && !p.isLooping()) {
    beforeStart?.()
    p.loop()
  } else if (!animate && p.isLooping()) {
    p.noLoop()
  }
}
