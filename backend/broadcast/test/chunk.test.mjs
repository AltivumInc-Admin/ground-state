import { test } from 'node:test'
import assert from 'node:assert/strict'
import { chunk } from '../src/chunk.mjs'

test('chunk splits into size-capped groups', () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]])
})
test('chunk of empty is empty', () => {
  assert.deepEqual(chunk([], 500), [])
})
