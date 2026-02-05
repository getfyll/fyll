/**
 * FYLL Brand Style Guide
 * ─────────────────────────────────────────────
 * Reference this file when building new features
 * to ensure UI consistency across the app.
 *
 * BUTTONS
 * ─────────────────────────────────────────────
 * All buttons should be pill-shaped (rounded-full).
 * Never use rounded-xl or rounded-lg for buttons.
 *
 * Primary Action:
 *   bg: #111111, text: #FFFFFF
 *   className="rounded-full active:opacity-80"
 *   style={{ backgroundColor: '#111111', height: 50 }}
 *
 * Secondary / Ghost:
 *   bg: colors.bg.secondary, text: colors.text.primary
 *   className="rounded-full active:opacity-70"
 *   style={{ backgroundColor: colors.bg.secondary, borderWidth: 1, borderColor: colors.border.light }}
 *
 * Danger:
 *   bg: rgba(239, 68, 68, 0.15), text: #EF4444
 *   className="rounded-full active:opacity-80"
 *
 * Small Pill (inline section buttons):
 *   bg: #111111, text: #FFFFFF
 *   className="px-4 py-1.5 rounded-full active:opacity-70"
 *
 * INPUTS
 * ─────────────────────────────────────────────
 * All text inputs: rounded-full, height 52
 * Search bars: rounded-full with Search icon
 * Multi-line inputs: rounded-2xl (exception)
 *
 * CARDS
 * ─────────────────────────────────────────────
 * List items: rounded-2xl, borderWidth 1, borderColor colors.border.light
 * Detail cards: rounded-2xl with colors.getCardStyle()
 * Modals: rounded-2xl or rounded-t-3xl (bottom sheet)
 *
 * TYPOGRAPHY
 * ─────────────────────────────────────────────
 * Page titles: text-2xl font-bold
 * Section headers: text-xs uppercase tracking-wider font-medium (muted color)
 * Card titles: text-lg font-bold
 * Body: text-sm
 * Captions: text-xs
 *
 * COLORS
 * ─────────────────────────────────────────────
 * Primary action: #111111 (near-black)
 * Danger: #EF4444
 * Success: #10B981
 * Warning: #F59E0B
 * Accent: Use colors.accent.primary from theme
 *
 * ICONS
 * ─────────────────────────────────────────────
 * Default strokeWidth: 2
 * Nav icons: size 24
 * Inline icons: size 14-18
 * Empty state icons: size 40-48, strokeWidth 1
 *
 * SPACING
 * ─────────────────────────────────────────────
 * Page horizontal padding: px-5 (20px)
 * Card internal padding: p-4 or p-5
 * List item spacing: mb-2 or mb-3
 * Section spacing: mt-4
 */

// Button height constants
export const BUTTON_HEIGHT = {
  large: 56,
  medium: 50,
  small: 42,
  inline: 32,
} as const;

// Button style presets (use with style prop)
export const buttonStyles = {
  primary: {
    backgroundColor: '#111111',
  },
  primaryText: {
    color: '#FFFFFF',
  },
  danger: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  dangerText: {
    color: '#EF4444',
  },
} as const;
