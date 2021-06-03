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

test('basic CRUD', async t => {
  await inst.api.table.create(
    `bob`,
    'ctzn.network/profile',
    {
      displayName: 'Bobo Roberts',
      description: 'Some user',
      homepageUrl: 'http://example.com'
    }
  )

  let profile1 = await inst.api.view.get('ctzn.network/views/profile', {dbId: `bob`})
  t.truthy(/^hyper:\/\/([0-9a-f]{64})\/$/.test(profile1.dbUrl))
  t.is(profile1.value.displayName, 'Bobo Roberts')
  t.is(profile1.value.description, 'Some user')
  t.is(profile1.value.homepageUrl, 'http://example.com')
})

test('avatar', async t => {
  const testImgBuf = fs.readFileSync(TEST_IMAGE_PATH)
  await inst.api.table.putBlob('bob', 'ctzn.network/profile', 'self', 'avatar', testImgBuf, 'image/jpeg')
  const uploadedBuf = await inst.api.table.getBlob('bob', 'ctzn.network/profile', 'self', 'avatar')
  t.is(testImgBuf.compare(uploadedBuf), 0)
})

test('communities', async t => {
  await inst.api.table.create(
    `bob`,
    'ctzn.network/profile',
    {
      displayName: 'Bobo Roberts',
      description: 'Some user',
      homepageUrl: 'http://example.com',
      communities: ['WebDev', 'US News']
    }
  )

  await inst.api.get('debug/when-all-synced')

  {
    let {communities} = await inst.api.view.get('ctzn.network/views/popular-communities')
    t.is(communities.find(c => c.name === 'WebDev').memberCount, 1)
    t.is(communities.find(c => c.name === 'US News').memberCount, 1)
  }

  await inst.api.post('debug/create-user', {
    type: 'user',
    username: 'alice',
    email: 'alice@roberts.com',
    password: 'password',
    profile: {
      displayName: 'Alice Roberts',
      communities: ['US News']
    }
  })

  await inst.api.get('debug/when-all-synced')

  {
    let {communities} = await inst.api.view.get('ctzn.network/views/popular-communities')
    t.is(communities.find(c => c.name === 'WebDev').memberCount, 1)
    t.is(communities.find(c => c.name === 'US News').memberCount, 2)
  }

  await inst.api.method('ctzn.network/methods/login', {username: 'bob', password: 'password'})
  await inst.api.table.create(
    `bob`,
    'ctzn.network/profile',
    {
      displayName: 'Bobo Roberts',
      description: 'Some user',
      homepageUrl: 'http://example.com',
      communities: []
    }
  )

  await inst.api.get('debug/when-all-synced')

  {
    let {communities} = await inst.api.view.get('ctzn.network/views/popular-communities')
    t.falsy(communities.find(c => c.name === 'WebDev'))
    t.is(communities.find(c => c.name === 'US News').memberCount, 1)
  }
})