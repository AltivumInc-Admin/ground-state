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
