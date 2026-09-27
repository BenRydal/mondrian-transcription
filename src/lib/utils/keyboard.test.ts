import { describe, expect, it } from 'vitest'
import { isEditableTarget, isShortcutEvent } from './keyboard'

const key = (
  target: unknown,
  mods: Partial<Record<'ctrlKey' | 'metaKey' | 'altKey', boolean>> = {}
) => ({
  target: target as EventTarget | null,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
})

describe('isEditableTarget', () => {
  it('treats text fields and contenteditable as editable', () => {
    expect(isEditableTarget({ tagName: 'INPUT' })).toBe(true)
    expect(isEditableTarget({ tagName: 'textarea' })).toBe(true)
    expect(isEditableTarget({ tagName: 'SELECT' })).toBe(true)
    expect(isEditableTarget({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('treats other elements and no target as not editable', () => {
    expect(isEditableTarget({ tagName: 'BUTTON' })).toBe(false)
    expect(isEditableTarget({ tagName: 'CANVAS', isContentEditable: false })).toBe(false)
    expect(isEditableTarget(null)).toBe(false)
  })
})

describe('isShortcutEvent', () => {
  it('accepts a bare key on a non-editable target', () => {
    expect(isShortcutEvent(key({ tagName: 'BODY' }))).toBe(true)
  })

  it('ignores keys typed into inputs, e.g. the path rename box', () => {
    expect(isShortcutEvent(key({ tagName: 'INPUT' }))).toBe(false)
  })

  it('ignores browser chords such as Ctrl+R', () => {
    expect(isShortcutEvent(key({ tagName: 'BODY' }, { ctrlKey: true }))).toBe(false)
    expect(isShortcutEvent(key({ tagName: 'BODY' }, { metaKey: true }))).toBe(false)
    expect(isShortcutEvent(key({ tagName: 'BODY' }, { altKey: true }))).toBe(false)
  })
})
