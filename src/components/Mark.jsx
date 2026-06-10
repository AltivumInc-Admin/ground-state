/* Brand mark — the ground state: a potential well, the zero-point
   energy level E₀, and the particle settled at the minimum.
   Colors resolve through the ground tokens, so the mark works on
   both light and dark panels unchanged. */
export default function Mark({ size = 26 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="30" height="30" stroke="var(--ink)" strokeWidth="1.6" />
      <path d="M 5.5 8 Q 16 30.5 26.5 8" stroke="var(--ink)" strokeWidth="1.6" />
      <line
        x1="9.5"
        y1="15.5"
        x2="22.5"
        y2="15.5"
        stroke="var(--accent-display)"
        strokeWidth="1.2"
        strokeDasharray="2.5 3"
      />
      <circle cx="16" cy="18.6" r="2.4" fill="var(--accent-display)" />
    </svg>
  )
}
