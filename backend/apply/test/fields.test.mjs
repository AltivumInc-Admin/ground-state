import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { PutCommand } from '@aws-sdk/lib-dynamodb'
import { APPLICATION_FIELDS } from '../src/fields.mjs'

process.env.TABLE_NAME = 'Applications-test'
process.env.FROM_ADDRESS = 'no-reply@groundstatesociety.com'
process.env.OPERATOR_EMAIL = 'operator@groundstatesociety.com'
process.env.POSTMARK_TOKEN = 'pm-test-token'

const { buildApplicationEmail } = await import('../src/email.mjs')
const { ddb, putApplication } = await import('../src/store.mjs')

/* The drift guard the field-table refactor exists for: a field added to
   APPLICATION_FIELDS must provably reach BOTH sinks — the stored DynamoDB
   record and the operator-notification email. If either sink stops deriving
   from the table, this fails. */

const application = Object.fromEntries(
  APPLICATION_FIELDS.map((f) => [f.key, `value-${f.key}`]),
)

test('every table field reaches the stored item', async () => {
  let cmd
  mock.method(ddb, 'send', async (c) => { cmd = c; return {} })
  await putApplication({ ...application, consentIp: '1.2.3.4' })
  assert.ok(cmd instanceof PutCommand)
  for (const f of APPLICATION_FIELDS) {
    assert.equal(cmd.input.Item[f.key], `value-${f.key}`, `stored item missing ${f.key}`)
  }
  mock.restoreAll()
})

test('every table field and its label reach the notification email (html + text)', () => {
  const { html, text } = buildApplicationEmail({ application })
  for (const f of APPLICATION_FIELDS) {
    assert.ok(html.includes(`value-${f.key}`), `email html missing ${f.key}`)
    assert.ok(html.includes(f.label), `email html missing label "${f.label}"`)
    assert.ok(text.includes(`value-${f.key}`), `email text missing ${f.key}`)
    assert.ok(text.includes(f.label), `email text missing label "${f.label}"`)
  }
})

test('the table itself stays well-formed (unique keys, exactly one email field, positive caps)', () => {
  const keys = APPLICATION_FIELDS.map((f) => f.key)
  assert.equal(new Set(keys).size, keys.length)
  assert.equal(APPLICATION_FIELDS.filter((f) => f.email).length, 1)
  for (const f of APPLICATION_FIELDS) {
    assert.ok(Number.isInteger(f.cap) && f.cap > 0, `${f.key} cap`)
    assert.ok(typeof f.label === 'string' && f.label.length > 0, `${f.key} label`)
  }
})
