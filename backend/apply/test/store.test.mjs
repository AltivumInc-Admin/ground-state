import { test, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { PutCommand } from '@aws-sdk/lib-dynamodb'

process.env.TABLE_NAME = 'Applications-test'

const { ddb, putApplication } = await import('../src/store.mjs')

beforeEach(() => mock.restoreAll())

const APP = {
  name: 'Ada Quantum',
  email: 'ada@qubit.co',
  company: 'QubitCo',
  role: 'Co-founder & CEO',
  applicantType: 'Founder',
  stage: 'Seed',
  modality: 'Quantum software',
  want: 'Peers who get it.',
  consentIp: '1.2.3.4',
}

test('putApplication writes one durable APP# record (no ttl) and returns its id', async () => {
  let cmd
  mock.method(ddb, 'send', async (c) => { cmd = c; return {} })

  const res = await putApplication(APP)

  assert.ok(cmd instanceof PutCommand)
  assert.equal(cmd.input.TableName, 'Applications-test')
  const item = cmd.input.Item
  assert.match(item.PK, /^APP#/)
  assert.equal(item.PK, `APP#${item.id}`)
  assert.equal(res.id, item.id)
  assert.equal(item.status, 'new')
  assert.equal(item.email, 'ada@qubit.co')
  assert.equal(item.company, 'QubitCo')
  assert.equal(item.consentIp, '1.2.3.4')
  assert.equal(typeof item.createdAt, 'number')
  assert.match(item.receivedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(item.ttl, undefined) // durable: never swept
  assert.equal(item.website, undefined) // honeypot not persisted
  assert.equal(cmd.input.ConditionExpression, 'attribute_not_exists(PK)')
})

test('two applications get distinct ids', async () => {
  mock.method(ddb, 'send', async () => ({}))
  const a = await putApplication(APP)
  const b = await putApplication(APP)
  assert.notEqual(a.id, b.id)
})

test('putApplication propagates a DynamoDB failure (handler maps it to 502)', async () => {
  mock.method(ddb, 'send', async () => { throw new Error('ddb down') })
  await assert.rejects(() => putApplication(APP), /ddb down/)
})
