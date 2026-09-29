import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { blobUrlSlot } from './blobUrl'

const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }
let created = 0

beforeEach(() => {
  created = 0
  URL.createObjectURL = vi.fn(() => `blob:${++created}`)
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  URL.createObjectURL = original.create
  URL.revokeObjectURL = original.revoke
})

const blob = () => new Blob(['x'])

describe('blobUrlSlot', () => {
  it('revokes the previous url when a new one replaces it', () => {
    const slot = blobUrlSlot()
    expect(slot.set(blob())).toBe('blob:1')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    expect(slot.set(blob())).toBe('blob:2')
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:1')
  })

  it('revokes on clear and holds nothing afterwards', () => {
    const slot = blobUrlSlot()
    slot.set(blob())
    slot.clear()
    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:1')

    slot.clear()
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('never holds more than one url, however many times it is set', () => {
    const slot = blobUrlSlot()
    for (let i = 0; i < 5; i++) slot.set(blob())
    slot.clear()
    expect(URL.createObjectURL).toHaveBeenCalledTimes(5)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(5)
  })
})
