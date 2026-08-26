export function settleMinDuration(startedAt: number, minMs: number): Promise<void> {
  const wait = Math.max(0, minMs - (Date.now() - startedAt))
  if (wait <= 0) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    setTimeout(resolve, wait)
  })
}
