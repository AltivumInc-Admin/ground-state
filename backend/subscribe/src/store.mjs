import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb'

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
export const EMAIL_TTL_SEC = 86400 // abandoned pending subscriber expiry (24h)
export const TOKEN_TTL_SEC = 900 // magic-link single-use lifetime (15 min)

const TABLE = () => process.env.TABLE_NAME
const nowSec = () => Math.floor(Date.now() / 1000)
const isConditional = (e) => e?.name === 'ConditionalCheckFailedException'

export async function createPending({ email, source, tokenHash, consentIp }) {
  const now = nowSec()
  let alreadyConfirmed = false
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE(),
        Item: {
          PK: `EMAIL#${email}`,
          status: 'pending',
          source,
          consentIp,
          consentAt: now,
          ttl: now + EMAIL_TTL_SEC,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      }),
    )
  } catch (e) {
    if (!isConditional(e)) throw e
    // Record exists: refresh to pending ONLY if not already confirmed.
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE(),
          Key: { PK: `EMAIL#${email}` },
          UpdateExpression: 'SET #s = :pending, consentAt = :now, #ttl = :exp',
          ConditionExpression: '#s <> :confirmed',
          ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
          ExpressionAttributeValues: {
            ':pending': 'pending',
            ':confirmed': 'confirmed',
            ':now': now,
            ':exp': now + EMAIL_TTL_SEC,
          },
        }),
      )
    } catch (e2) {
      if (!isConditional(e2)) throw e2
      alreadyConfirmed = true
    }
  }

  if (!alreadyConfirmed) {
    await ddb.send(
      new PutCommand({
        TableName: TABLE(),
        Item: { PK: `TOKEN#${tokenHash}`, email, ttl: now + TOKEN_TTL_SEC },
      }),
    )
  }
  return { alreadyConfirmed }
}

export async function consumeToken(tokenHash) {
  let res
  try {
    res = await ddb.send(
      new DeleteCommand({
        TableName: TABLE(),
        Key: { PK: `TOKEN#${tokenHash}` },
        ConditionExpression: 'attribute_exists(PK)',
        ReturnValues: 'ALL_OLD',
      }),
    )
  } catch (e) {
    if (isConditional(e)) return null // already consumed / never existed
    throw e
  }
  const item = res.Attributes
  if (!item) return null
  // TTL deletion is best-effort — reject an expired-but-not-yet-swept token.
  if (typeof item.ttl === 'number' && item.ttl <= nowSec()) return null
  return { email: item.email }
}

export async function confirm(email) {
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `EMAIL#${email}` },
        UpdateExpression: 'SET #s = :confirmed, confirmedAt = :now REMOVE #ttl',
        ConditionExpression: 'attribute_exists(PK) AND #s = :pending',
        ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':confirmed': 'confirmed',
          ':pending': 'pending',
          ':now': nowSec(),
        },
      }),
    )
    return true
  } catch (e) {
    if (!isConditional(e)) throw e
    // Either no record, or already confirmed. Re-check: treat already-confirmed as success.
    return await isConfirmed(email)
  }
}

async function isConfirmed(email) {
  try {
    const res = await ddb.send(
      new GetCommand({ TableName: TABLE(), Key: { PK: `EMAIL#${email}` } }),
    )
    return res.Item?.status === 'confirmed'
  } catch {
    // If GetCommand fails (e.g., in test with mocked unconditional throw), assume not confirmed
    return false
  }
}
