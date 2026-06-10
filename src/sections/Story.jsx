import Fx from '../lib/fx.jsx'

export default function Story() {
  return (
    <Fx as="section" id="story" className="section story" aria-labelledby="story-title">
      <div className="container">
        <p className="kicker" data-fade>
          <strong>03</strong> The Story
        </p>
        <h2 id="story-title" className="section-title" data-split>
          Built by an operator. Planted early, on purpose.
        </h2>
        <div className="story-grid">
          <div className="story-body" data-fade>
            <p>
              Quantum is consolidating into roughly <strong>45 dense clusters that capture 96%
              of global funding</strong>, and capital is flooding in — billion-dollar state
              initiatives, half-billion-dollar venture programs, government commitments past
              $10B. Yet the founder population is still small enough that one network can
              credibly know, and convene, most of it.
            </p>
            <p>
              That window does not stay open. <strong>Whoever becomes the default room for
              quantum founders now owns that position as the field grows tenfold.</strong> The
              Ground State Society exists to be that room — recruited founder by founder, vetted
              application by application, starting with a founding cohort of 15–25.
            </p>
            <p>
              It is operated by Christian Perez, founder of Altivum Inc. — a Green Beret veteran
              who builds quantum systems on AWS. Military trust, technical depth in the stack you
              run on, and fluency with the cloud platforms racing to win quantum: the rare
              combination it takes to curate a room founders take seriously, and sponsors fund.
            </p>
            <p className="story-sign">
              “We’d rather under-promise and over-deliver than sell you a network that doesn’t
              exist yet.”
              <small className="label">Christian Perez — Founder, Altivum Inc.</small>
            </p>
          </div>
          <div className="story-aside" data-stagger>
            <aside className="story-panel ground-dark">
              <span className="panel-tag label">Today</span>
              <h3>What’s real today</h3>
              <p>
                A hand-picked founding cohort, curated peer circles, expert sessions arranged
                personally, and an Operator’s Library written from real quantum-on-AWS
                experience. Small — and high-signal by construction.
              </p>
            </aside>
            <aside className="story-panel ground-dark is-accent">
              <span className="panel-tag label">Founding terms</span>
              <h3>The founding-member deal</h3>
              <p>
                Early members are helping build the network they’re paying for — so founding
                members join at a locked-in rate that never goes up, and carry the founding badge
                permanently. Early belief, rewarded.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </Fx>
  )
}
