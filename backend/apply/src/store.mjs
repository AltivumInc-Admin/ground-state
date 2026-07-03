import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'
import { APPLICATION_FIELDS } from './fields.mjs'

// One durable record per application — unlike the subscribe table's pending
// records there is NO ttl: the application IS the cold-start funnel, it must
// never be swept. The vetting funnel is low-volume, so a single PK (read via
// console/scan) is sufficient; a createdAt attribute supports later sorting.
export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE = () => process.env.TABLE_NAME
const nowSec = () => Math.floor(Date.now() / 1000)

// Persist a vetted-funnel application. `app` is the already-validated field set
// from the handler. Returns the generated id so the handler/notifier can
// reference it. The honeypot `website` is intentionally NOT stored.
export async function putApplication(app) {
  const id = randomUUID()
  const createdAt = nowSec()
  await ddb.send(
    new PutCommand({
      TableName: TABLE(),
      Item: {
        PK: `APP#${id}`,
        id,
        status: 'new',
        createdAt,
        receivedAt: new Date(createdAt * 1000).toISOString(),
        // Every field in the shared table is persisted — one source of truth
        // (fields.mjs); the drift test pins this.
        ...Object.fromEntries(APPLICATION_FIELDS.map((f) => [f.key, app[f.key]])),
        consentIp: app.consentIp,
      },
      // New id every call, so this never clobbers — guard anyway.
      ConditionExpression: 'attribute_not_exists(PK)',
    }),
  )
  return { id }
}
