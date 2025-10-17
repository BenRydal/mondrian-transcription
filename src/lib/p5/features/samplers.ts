export class TimeBasedSampler {
  private lastSampleTime: number = 0

  constructor(private sampleInterval: number) {}

  setInterval(interval: number) {
    this.sampleInterval = interval
  }

  shouldSample(currentTime: number): boolean {
    if (currentTime - this.lastSampleTime >= this.sampleInterval) {
      this.lastSampleTime = currentTime
      return true
    }
    return false
  }

  reset() {
    this.lastSampleTime = 0
  }
}

export class IndexBasedSampler {
  private eventCounter = 0 // counts every sampling opportunity
  private acceptedCount = 0 // counts only accepted samples

  constructor(private step: number) {}

  setStep(step: number) {
    this.step = step
  }

  shouldSample(): boolean {
    const should = this.eventCounter % this.step === 0
    if (should) this.acceptedCount++
    this.eventCounter++
    return should
  }

  getPseudoTime(): number {
    return this.acceptedCount * this.step
  }

  reset(startIndex: number = 0) {
    this.eventCounter = startIndex
    this.acceptedCount = startIndex > 0 ? Math.floor(startIndex / this.step) : 0
  }
}
