/* Lab-notebook caption for the numbered quantum figures. */
export default function FigCaption({ num, children, ket }) {
  return (
    <figcaption className="fig-caption">
      <span className="fig-tag">fig. {num}</span>
      <span className="fig-text">{children}</span>
      {ket && (
        <span className="fig-ket" aria-hidden="true">
          {ket}
        </span>
      )}
    </figcaption>
  )
}
