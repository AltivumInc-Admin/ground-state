import { test, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'

process.env.TABLE_NAME = 'Subscribers-test'

const { ddb, createPending, consumeToken, confirm, suppress, unsubscribe } = await import('../src/store.mjs')

class ConditionalCheckFailedException extends Error {
  constructor() { super('conditional'); this.name = 'ConditionalCheckFailedException' }
}

beforeEach(() => mock.restoreAll())

test('createPending writes EMAIL# (create) then TOKEN#', async () => {
  const sent = []
  mock.method(ddb, 'send', async (cmd) => { sent.push(cmd); return {} })
  const res = await createPending({ email: 'a@b.co', source: 'signal', tokenHash: 'h1', consentIp: '1.2.3.4' })
  assert.deepEqual(res, { alreadyConfirmed: false })
  assert.equal(sent.length, 2)
  assert.ok(sent[0] instanceof PutCommand)
  assert.equal(sent[0].input.Item.PK, 'EMAIL#a@b.co')
  assert.equal(sent[0].input.Item.status, 'pending')
  assert.equal(sent[0].input.Item.source, 'signal')
  assert.ok(sent[1] instanceof PutCommand)
  assert.equal(sent[1].input.Item.PK, 'TOKEN#h1')
  assert.equal(sent[1].input.Item.email, 'a@b.co')
})

test('createPending on an already-confirmed email skips the token', async () => {
  let call = 0
  mock.method(ddb, 'send', async () => {
    call += 1
    if (call === 1) throw new ConditionalCheckFailedException() // EMAIL# create blocked (exists)
    if (call === 2) throw new ConditionalCheckFailedException() // refresh blocked (already confirmed)
    return {}
  })
  const res = await createPending({ email: 'a@b.co', source: 'signal', tokenHash: 'h1', consentIp: '1.2.3.4' })
  assert.deepEqual(res, { alreadyConfirmed: true })
  assert.equal(call, 2) // never wrote a TOKEN# item
})

test('consumeToken deletes and returns the email', async () => {
  mock.method(ddb, 'send', async (cmd) => {
    assert.ok(cmd instanceof DeleteCommand)
    return { Attributes: { email: 'a@b.co', ttl: Math.floor(Date.now() / 1000) + 100 } }
  })
  assert.deepEqual(await consumeToken('h1'), { email: 'a@b.co' })
})

test('consumeToken returns null when the token is gone', async () => {
  mock.method(ddb, 'send', async () => { throw new ConditionalCheckFailedException() })
  assert.equal(await consumeToken('h1'), null)
})

test('consumeToken returns null when the token is expired', async () => {
  mock.method(ddb, 'send', async () => ({
    Attributes: { email: 'a@b.co', ttl: Math.floor(Date.now() / 1000) - 1 },
  }))
  assert.equal(await consumeToken('h1'), null)
})

test('confirm transitions pending and is true', async () => {
  mock.method(ddb, 'send', async (cmd) => {
    assert.ok(cmd instanceof UpdateCommand)
    return { Attributes: { status: 'confirmed' } }
  })
  assert.equal(await confirm('a@b.co'), true)
})

test('confirm returns false when no pending record exists', async () => {
  let call = 0
  mock.method(ddb, 'send', async (cmd) => {
    call += 1
    if (call === 1) throw new ConditionalCheckFailedException() // UpdateCommand fails
    if (call === 2) {
      assert.ok(cmd instanceof GetCommand)
      return {} // GetCommand on non-existent item returns empty
    }
  })
  assert.equal(await confirm('a@b.co'), false)
})

test('confirm returns true when the record is already confirmed', async () => {
  let call = 0
  mock.method(ddb, 'send', async (cmd) => {
    call += 1
    if (call === 1) throw new ConditionalCheckFailedException() // UpdateCommand fails
    if (call === 2) {
      assert.ok(cmd instanceof GetCommand)
      return { Item: { status: 'confirmed' } } // GetCommand returns confirmed item
    }
  })
  assert.equal(await confirm('a@b.co'), true)
})

test('suppress upserts a suppressed tombstone and clears the ttl', async () => {
  let cmd
  mock.method(ddb, 'send', async (c) => { cmd = c; return {} })
  await suppress({ email: 'a@b.co', reason: 'complaint', recordType: 'SpamComplaint' })
  assert.ok(cmd instanceof UpdateCommand)
  assert.equal(cmd.input.Key.PK, 'EMAIL#a@b.co')
  assert.match(cmd.input.UpdateExpression, /#s = :suppressed/)
  assert.match(cmd.input.UpdateExpression, /REMOVE #ttl/)
  assert.equal(cmd.input.ConditionExpression, undefined) // unconditional: wins over any status
  assert.equal(cmd.input.ExpressionAttributeValues[':suppressed'], 'suppressed')
  assert.equal(cmd.input.ExpressionAttributeValues[':r'], 'complaint')
  assert.equal(cmd.input.ExpressionAttributeValues[':rt'], 'SpamComplaint')
})

test('unsubscribe writes UpdateCommand with status=unsubscribed and guards against suppressed', async () => {
  let sent
  mock.method(ddb, 'send', async (cmd) => { sent = cmd; return {} })
  await unsubscribe({ email: 'a@b.com' })
  assert.ok(sent instanceof UpdateCommand)
  assert.equal(sent.input.Key.PK, 'EMAIL#a@b.com')
  assert.equal(sent.input.ExpressionAttributeValues[':u'], 'unsubscribed')
  assert.match(sent.input.ConditionExpression, /#s <> :suppressed/)
  assert.match(sent.input.UpdateExpression, /REMOVE #ttl/)
})

test('unsubscribe silently swallows ConditionalCheckFailedException (no record or already suppressed)', async () => {
  mock.method(ddb, 'send', async () => { throw new ConditionalCheckFailedException() })
  await assert.doesNotReject(() => unsubscribe({ email: 'a@b.com' }))
})

test('createPending never resurrects a suppressed address', async () => {
  let call = 0
  mock.method(ddb, 'send', async () => {
    call += 1
    if (call === 1) throw new ConditionalCheckFailedException() // EMAIL# create blocked (record exists)
    if (call === 2) throw new ConditionalCheckFailedException() // refresh blocked: status is 'suppressed'
    return {}
  })
  const res = await createPending({ email: 'a@b.co', source: 'signal', tokenHash: 'h1', consentIp: '1.2.3.4' })
  assert.deepEqual(res, { alreadyConfirmed: true }) // short-circuits: no token, no send
  assert.equal(call, 2)
})
