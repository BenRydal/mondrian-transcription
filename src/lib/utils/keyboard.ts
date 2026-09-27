type KeyTarget = { tagName?: string; isContentEditable?: boolean } | null

const EDITABLE_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function isEditableTarget(target: EventTarget | KeyTarget): boolean {
  const el = target as KeyTarget
  if (!el) return false
  return el.isContentEditable === true || EDITABLE_TAGS.has(el.tagName?.toUpperCase() ?? '')
}

/** True for a bare key press meant as an app shortcut, not typing or a browser chord. */
export function isShortcutEvent(e: {
  target: EventTarget | null
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
}): boolean {
  return !e.ctrlKey && !e.metaKey && !e.altKey && !isEditableTarget(e.target)
}

/** Ctrl/Cmd+S saves a checkpoint from anywhere, inputs included, instead of the browser's Save. */
export function isCheckpointShortcut(e: {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
}): boolean {
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's'
}
