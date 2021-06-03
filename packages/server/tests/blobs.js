import test from 'ava'
import { createServer } from './_util.js'
import fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const TEST_IMAGE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-img.jpg')

let inst

test.before(async () => {
  inst = await createServer()

  await inst.api.post('debug/create-user', {
    type: 'user',
    username: 'bob',
    email: 'bob@roberts.com',
    password: 'password',
    profile: {
      displayName: 'Bob Roberts'
    }
  })
  await inst.api.method('ctzn.network/methods/login', {username: 'bob', password: 'password'})
})

test.after.always(async t => {
	await inst.close()
})

test('upload and delete blobs', async t => {
  const testImgBuf = fs.readFileSync(TEST_IMAGE_PATH)
  await inst.api.table.putBlob('bob', 'ctzn.network/profile', 'self', 'avatar', testImgBuf, 'image/jpeg')
  const uploadedBuf = await inst.api.table.getBlob('bob', 'ctzn.network/profile', 'self', 'avatar')
  t.is(testImgBuf.compare(uploadedBuf), 0)

  await inst.api.table.delBlob('bob', 'ctzn.network/profile', 'self', 'avatar')
  await t.throwsAsync(() => inst.api.table.getBlob('bob', 'ctzn.network/profile', 'self', 'avatar'))
})

test('size limit enforced', async t => {
  const bigBuf = Buffer.allocUnsafe(1e6)
  await t.throwsAsync(() => inst.api.table.putBlob('bob', 'ctzn.network/profile', 'self', 'avatar', bigBuf, 'image/jpeg'))
})

test('mime type enforced', async t => {
  const bigBuf = Buffer.allocUnsafe(1e3)
  await t.throwsAsync(() => inst.api.table.putBlob('bob', 'ctzn.network/profile', 'self', 'avatar', bigBuf, 'application/json'))
})
