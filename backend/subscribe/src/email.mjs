import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

export const ses = new SESv2Client({})

// Source-specific confirmation copy. Signal subscribers confirm on the ground-state site and get
// the free briefing; quantum-intro subscribers confirm on the module and get the learning content.
// The token lifetime (TOKEN_TTL_SEC in store.mjs) is 15 minutes for both.
const COPY = {
  signal: {
    subject: 'Confirm your subscription to The Signal',
    intro: 'Confirm your email to start receiving The Signal — the free briefing for quantum builders.',
    cta: 'Confirm subscription',
  },
  'quantum-intro': {
    subject: 'Confirm your free access to the Quantum Intro',
    intro: 'Confirm your email to open the free Introduction to Quantum Computing.',
    cta: 'Confirm and start learning',
  },
}

const EXPIRY = "This link expires in 15 minutes. If you didn't request it, ignore this email."

export function buildMagicLinkEmail({ link, source }) {
  // The handler only calls this with a validated source; fall back rather than throw if that ever changes.
  const copy = COPY[source] ?? COPY.signal
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1a1a1a">
    <p>${copy.intro}</p>
    <p><a href="${link}">${copy.cta}</a></p>
    <p style="color:#666;font-size:14px">${EXPIRY}</p>
  </body></html>`
  const text = `${copy.intro}\n\n${link}\n\n${EXPIRY}`
  return { subject: copy.subject, html, text }
}

export async function sendMagicLink({ to, link, source }) {
  const { subject, html, text } = buildMagicLinkEmail({ link, source })
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: process.env.FROM_ADDRESS,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: html, Charset: 'UTF-8' },
            Text: { Data: text, Charset: 'UTF-8' },
          },
        },
      },
      ...(process.env.CONFIG_SET && { ConfigurationSetName: process.env.CONFIG_SET }),
    }),
  )
}
