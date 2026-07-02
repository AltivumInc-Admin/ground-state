/* The shared physics-diagram arrowhead. Inline-SVG url(#id) references
   resolve per document, so each figure keeps its own def instance with a
   distinct id and stays self-contained — this component only removes the
   copy-pasted geometry. */
export default function ArrowMarker({ id }) {
  return (
    <marker
      id={id}
      viewBox="0 0 8 8"
      refX="4"
      refY="4"
      markerWidth="7"
      markerHeight="7"
      orient="auto-start-reverse"
    >
      <path d="M 0 0 L 8 4 L 0 8 z" fill="var(--accent-display)" />
    </marker>
  )
}
