import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb'

export const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

export function buildScanParams(tableName, { lastKey }) {
  return {
    TableName: tableName,
    FilterExpression: 'begins_with(PK, :p) AND #s = :c',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':p': 'EMAIL#', ':c': 'confirmed' },
    ProjectionExpression: 'PK',
    ExclusiveStartKey: lastKey,
  }
}

export function collectEmails(items) {
  return (items ?? []).map((i) => i.PK.slice('EMAIL#'.length))
}

// Paginated Scan. The list is small at launch, so Scan is acceptable; if it ever
// grows large, add a GSI on `status` and Query instead.
export async function listConfirmedRecipients(tableName, client = ddb) {
  const emails = []
  let lastKey
  do {
    const res = await client.send(new ScanCommand(buildScanParams(tableName, { lastKey })))
    emails.push(...collectEmails(res.Items))
    lastKey = res.LastEvaluatedKey
  } while (lastKey)
  return emails
}
