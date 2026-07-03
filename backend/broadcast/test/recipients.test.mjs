import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildScanParams, collectEmails } from '../src/recipients.mjs'

test('buildScanParams filters EMAIL# items with confirmed status', () => {
  const p = buildScanParams('t', { lastKey: undefined })
  assert.equal(p.TableName, 't')
  assert.match(p.FilterExpression, /begins_with\(PK, :p\)/)
  assert.match(p.FilterExpression, /AND #s = :c/)
  assert.equal(p.ExpressionAttributeValues[':p'], 'EMAIL#')
  assert.equal(p.ExpressionAttributeValues[':c'], 'confirmed')
})

test('collectEmails strips the EMAIL# prefix', () => {
  const items = [{ PK: 'EMAIL#a@b.com' }, { PK: 'EMAIL#c@d.com' }]
  assert.deepEqual(collectEmails(items), ['a@b.com', 'c@d.com'])
})

test('listConfirmedRecipients follows LastEvaluatedKey across pages (no silent truncation)', async () => {
  const { listConfirmedRecipients } = await import('../src/recipients.mjs')
  const startKeys = []
  let call = 0
  const client = {
    async send(cmd) {
      call += 1
      startKeys.push(cmd.input.ExclusiveStartKey)
      if (call === 1) {
        return { Items: [{ PK: 'EMAIL#a@b.com' }], LastEvaluatedKey: { PK: 'EMAIL#a@b.com' } }
      }
      return { Items: [{ PK: 'EMAIL#c@d.com' }] } // final page: no LastEvaluatedKey
    },
  }
  const emails = await listConfirmedRecipients('t', client)
  assert.deepEqual(emails, ['a@b.com', 'c@d.com'])
  assert.equal(call, 2)
  assert.equal(startKeys[0], undefined)
  assert.deepEqual(startKeys[1], { PK: 'EMAIL#a@b.com' }) // key threaded into page 2
})
