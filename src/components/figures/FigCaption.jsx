/* Lab-notebook caption for the numbered quantum figures (02-04). fig. 01
   deliberately diverges: its caption is an absolutely-positioned overlay on
   the live hero canvas (scene-caption/scene-ket in Hero.jsx), not a flow
   caption under a figure block. */
export default function FigCaption({ num, children }) {
  return (
    <figcaption className="fig-caption">
      <span className="fig-tag">fig. {num}</span>
      <span className="fig-text">{children}</span>
    </figcaption>
  )
}
