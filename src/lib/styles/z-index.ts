/**
 * Z-Index Hierarchy System for Visualization Suite
 *
 * Centralized z-index layering to prevent overlap issues.
 *
 * Hierarchy:
 * - Base Layers (0-9): Canvas and background
 * - UI Chrome (10-49): Navigation, panels
 * - Interactive Elements (50-99): Dropdowns, tooltips
 * - Overlays (100-199): Modals
 * - Top-Level (200-999): Command palette, toasts
 * - Development (9999): Debug overlays
 */
export const Z_INDEX = {
  CANVAS: 0,
  FLOOR_PLAN: 1,
  NAVBAR: 10,
  BOTTOM_NAV: 10,
  TIMELINE: 15,
  SIDE_PANEL: 20,
  DROPDOWN: 50,
  POPOVER: 50,
  TOOLTIP: 60,
  FAB: 70,
  MODAL_BACKDROP: 100,
  MODAL: 110,
  MODAL_DROPDOWN: 115,
  MODAL_TOOLTIP: 116,
  MODAL_NESTED: 120,
  DRAWER: 105,
  COMMAND_PALETTE: 200,
  TOAST: 300,
  LOADING_OVERLAY: 250,
  DEBUG_OVERLAY: 9999,
} as const

export type ZIndexLayer = keyof typeof Z_INDEX
export type ZIndexValue = (typeof Z_INDEX)[ZIndexLayer]
