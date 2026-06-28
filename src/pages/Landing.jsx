import Hero from '../sections/Hero.jsx'
import Problem from '../sections/Problem.jsx'
import WaveDivider from '../sections/WaveDivider.jsx'
import Proof from '../sections/Proof.jsx'
import Inside from '../sections/Inside.jsx'
import FinalCta from '../sections/FinalCta.jsx'
import usePageMeta from '../lib/usePageMeta.js'

export default function Landing() {
  usePageMeta()
  return (
    <>
      <Hero />
      <Problem />
      <WaveDivider />
      <Proof />
      <Inside />
      <FinalCta />
    </>
  )
}
