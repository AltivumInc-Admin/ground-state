/* Brand mark — an entangled pair: two interlocking rings. Theme-aware via tokens. */
export default function Mark({ size = 26, onDark = false }) {
  const ink = onDark ? 'var(--parchment)' : 'var(--obsidian)'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12.5" cy="16" r="9.5" stroke={ink} strokeWidth="1.6" />
      <circle
        cx="19.5"
        cy="16"
        r="9.5"
        stroke={onDark ? 'var(--chestnut)' : 'var(--accent-display)'}
        strokeWidth="1.6"
      />
      <circle cx="16" cy="16" r="1.8" fill={ink} />
    </svg>
  )
}
