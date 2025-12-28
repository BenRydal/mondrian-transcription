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

export class AdaptiveSampler {
  private lastSampleTime: number = 0
  private lastPosition: { x: number; y: number } | null = null

  constructor(
    private activeInterval: number = 0.004, // 4ms - fast sampling when moving
    private heartbeatInterval: number = 0.5, // 500ms - slow sampling when stationary
    private minMovement: number = 2 // pixels threshold to count as "moving"
  ) {}

  setActiveInterval(interval: number) {
    this.activeInterval = interval
  }

  setHeartbeatInterval(interval: number) {
    this.heartbeatInterval = interval
  }

  shouldSample(currentTime: number, currentPos: { x: number; y: number }): boolean {
    const timeDelta = currentTime - this.lastSampleTime

    // Calculate distance from last recorded position
    let distance = Infinity // First point always recorded
    if (this.lastPosition) {
      const dx = currentPos.x - this.lastPosition.x
      const dy = currentPos.y - this.lastPosition.y
      distance = Math.sqrt(dx * dx + dy * dy)
    }

    const isMoving = distance >= this.minMovement
    const requiredInterval = isMoving ? this.activeInterval : this.heartbeatInterval

    if (timeDelta >= requiredInterval) {
      this.lastSampleTime = currentTime
      this.lastPosition = { ...currentPos }
      return true
    }

    return false
  }

  reset() {
    this.lastSampleTime = 0
    this.lastPosition = null
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

