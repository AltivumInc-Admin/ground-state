import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2'

export const ses = new SESv2Client({})

export async function sendMagicLink({ to, link }) {
  const subject = 'Confirm your free access to the Quantum Intro'
  const html = `<!doctype html><html><body style="font-family:system-ui,sans-serif;color:#1a1a1a">
    <p>Confirm your email to open the free Introduction to Quantum Computing.</p>
    <p><a href="${link}">Confirm and start learning</a></p>
    <p style="color:#666;font-size:14px">This link expires in 15 minutes. If you didn't request it, ignore this email.</p>
  </body></html>`
  const text = `Confirm your email to open the free Introduction to Quantum Computing.\n\n${link}\n\nThis link expires in 15 minutes. If you didn't request it, ignore this email.`

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
