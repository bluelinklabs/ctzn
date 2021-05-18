import test from 'ava'
import fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createServer, TestFramework } from './_util.js'

const TEST_IMAGE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-img.jpg')
const TEST_IMAGE2_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-img2.svg')

let instances = []

test.after.always(async t => {
  for (let inst of instances) {
    await inst.close()
  }
  instances = []
})

test('unique items (autokey)', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, carla, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await carla.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'cat',
    grouping: 'unique',
    definition: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: 'object',
      properties: {
        name: {type: 'string'},
        color: {type: 'string'},
        fluffiness: {type: 'string', enum: ['not', 'fluffy', 'very-floof']}
      }
    }
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'cat')
  t.is(itemClasses1[0].value.definition.properties.color.type, 'string')

  const getItemOf = (items, userId) => items.find(item => item.value.owner.userId === userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'cat',
    qty: 1,
    owner: {userId: alice.userId, dbUrl: alice.dbUrl},
    properties: {
      name: 'Kit',
      color: 'tabby',
      fluffiness: 'not'
    }
  })
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'cat',
    qty: 1,
    owner: {userId: bob.userId, dbUrl: bob.dbUrl},
    properties: {
      name: 'Chiara',
      color: 'white',
      fluffiness: 'fluffy'
    }
  })
  const items1 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items1.length, 2)
  t.is(getItemOf(items1, alice.userId).value.classId, 'cat')
  t.is(getItemOf(items1, alice.userId).value.qty, 1)
  t.is(getItemOf(items1, alice.userId).value.properties.name, 'Kit')
  t.is(getItemOf(items1, alice.userId).value.properties.color, 'tabby')
  t.is(getItemOf(items1, alice.userId).value.properties.fluffiness, 'not')
  t.is(getItemOf(items1, alice.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items1, bob.userId).value.classId, 'cat')
  t.is(getItemOf(items1, bob.userId).value.qty, 1)
  t.is(getItemOf(items1, bob.userId).value.properties.name, 'Chiara')
  t.is(getItemOf(items1, bob.userId).value.properties.color, 'white')
  t.is(getItemOf(items1, bob.userId).value.properties.fluffiness, 'fluffy')
  t.is(getItemOf(items1, bob.userId).value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: getItemOf(items1, alice.userId).key,
    qty: 1,
    recp: {userId: carla.userId, dbUrl: carla.dbUrl}
  })
  const items2 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items2.length, 2)
  t.is(getItemOf(items2, carla.userId).value.classId, 'cat')
  t.is(getItemOf(items2, carla.userId).value.qty, 1)
  t.is(getItemOf(items2, carla.userId).value.properties.name, 'Kit')
  t.is(getItemOf(items2, carla.userId).value.properties.color, 'tabby')
  t.is(getItemOf(items2, carla.userId).value.properties.fluffiness, 'not')
  t.is(getItemOf(items2, carla.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items2, bob.userId).value.classId, 'cat')
  t.is(getItemOf(items2, bob.userId).value.qty, 1)
  t.is(getItemOf(items2, bob.userId).value.properties.name, 'Chiara')
  t.is(getItemOf(items2, bob.userId).value.properties.color, 'white')
  t.is(getItemOf(items2, bob.userId).value.properties.fluffiness, 'fluffy')
  t.is(getItemOf(items2, bob.userId).value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: getItemOf(items2, carla.userId).key,
    qty: 1,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl}
  })
  const items3 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items3.length, 2)
  items3.sort((a, b) => a.value.properties.name.localeCompare(b.value.properties.name))
  t.is(items3[1].value.classId, 'cat')
  t.is(items3[1].value.qty, 1)
  t.is(items3[1].value.properties.name, 'Kit')
  t.is(items3[1].value.properties.color, 'tabby')
  t.is(items3[1].value.properties.fluffiness, 'not')
  t.is(items3[1].value.createdBy.userId, alice.userId)
  t.is(items3[0].value.classId, 'cat')
  t.is(items3[0].value.qty, 1)
  t.is(items3[0].value.properties.name, 'Chiara')
  t.is(items3[0].value.properties.color, 'white')
  t.is(items3[0].value.properties.fluffiness, 'fluffy')
  t.is(items3[0].value.createdBy.userId, alice.userId)
})

test.skip('unique items (property id)', async t => {
  /**
   * TODO - requires parameterized groupings
   */

  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, carla, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await carla.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'cat',
    keyTemplate: [{type: 'json-pointer', value: '/properties/name'}],
    definition: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: 'object',
      properties: {
        name: {type: 'string'},
        color: {type: 'string'},
        fluffiness: {type: 'string', enum: ['not', 'fluffy', 'very-floof']}
      }
    }
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'cat')
  t.is(itemClasses1[0].value.definition.properties.color.type, 'string')

  const getItemOf = (items, userId) => items.find(item => item.value.owner.userId === userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'cat',
    qty: 1,
    owner: {userId: alice.userId, dbUrl: alice.dbUrl},
    properties: {
      name: 'Kit',
      color: 'tabby',
      fluffiness: 'not'
    }
  })
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'cat',
    qty: 1,
    owner: {userId: bob.userId, dbUrl: bob.dbUrl},
    properties: {
      name: 'Chiara',
      color: 'white',
      fluffiness: 'fluffy'
    }
  })
  const items1 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items1.length, 2)
  t.is(getItemOf(items1, alice.userId).value.classId, 'cat')
  t.is(getItemOf(items1, alice.userId).value.qty, 1)
  t.is(getItemOf(items1, alice.userId).value.properties.name, 'Kit')
  t.is(getItemOf(items1, alice.userId).value.properties.color, 'tabby')
  t.is(getItemOf(items1, alice.userId).value.properties.fluffiness, 'not')
  t.is(getItemOf(items1, alice.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items1, bob.userId).value.classId, 'cat')
  t.is(getItemOf(items1, bob.userId).value.qty, 1)
  t.is(getItemOf(items1, bob.userId).value.properties.name, 'Chiara')
  t.is(getItemOf(items1, bob.userId).value.properties.color, 'white')
  t.is(getItemOf(items1, bob.userId).value.properties.fluffiness, 'fluffy')
  t.is(getItemOf(items1, bob.userId).value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: getItemOf(items1, alice.userId).key,
    qty: 1,
    recp: {userId: carla.userId, dbUrl: carla.dbUrl}
  })
  const items2 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items2.length, 2)
  t.is(getItemOf(items2, carla.userId).value.classId, 'cat')
  t.is(getItemOf(items2, carla.userId).value.qty, 1)
  t.is(getItemOf(items2, carla.userId).value.properties.name, 'Kit')
  t.is(getItemOf(items2, carla.userId).value.properties.color, 'tabby')
  t.is(getItemOf(items2, carla.userId).value.properties.fluffiness, 'not')
  t.is(getItemOf(items2, carla.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items2, bob.userId).value.classId, 'cat')
  t.is(getItemOf(items2, bob.userId).value.qty, 1)
  t.is(getItemOf(items2, bob.userId).value.properties.name, 'Chiara')
  t.is(getItemOf(items2, bob.userId).value.properties.color, 'white')
  t.is(getItemOf(items2, bob.userId).value.properties.fluffiness, 'fluffy')
  t.is(getItemOf(items2, bob.userId).value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: getItemOf(items2, carla.userId).key,
    qty: 1,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl}
  })
  const items3 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items3.length, 2)
  items3.sort((a, b) => a.value.properties.name.localeCompare(b.value.properties.name))
  t.is(items3[1].value.classId, 'cat')
  t.is(items3[1].value.qty, 1)
  t.is(items3[1].value.properties.name, 'Kit')
  t.is(items3[1].value.properties.color, 'tabby')
  t.is(items3[1].value.properties.fluffiness, 'not')
  t.is(items3[1].value.createdBy.userId, alice.userId)
  t.is(items3[0].value.classId, 'cat')
  t.is(items3[0].value.qty, 1)
  t.is(items3[0].value.properties.name, 'Chiara')
  t.is(items3[0].value.properties.color, 'white')
  t.is(items3[0].value.properties.fluffiness, 'fluffy')
  t.is(items3[0].value.createdBy.userId, alice.userId)
})

test.skip('semi-fungible items', async t => {
  /**
   * TODO - requires parameterized groupings
   */
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, carla, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await carla.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'soda',
    keyTemplate: [
      {type: 'json-pointer', value: '/owner/userId'},
      {type: 'string', value: ':'},
      {type: 'json-pointer', value: '/properties/brand'},
      {type: 'string', value: ':'},
      {type: 'json-pointer', value: '/properties/flavor'}
    ],
    definition: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: 'object',
      required: ['brand', 'flavor'],
      properties: {
        brand: {type: 'string'},
        flavor: {type: 'string'}
      }
    }
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'soda')

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'soda',
    qty: 10,
    properties: {
      brand: 'coke',
      flavor: 'original'
    }
  })
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'soda',
    qty: 20,
    properties: {
      brand: 'coke',
      flavor: 'diet'
    }
  })
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'soda',
    qty: 30,
    properties: {
      brand: 'pepsi',
      flavor: 'original'
    }
  })
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'soda',
    qty: 40,
    properties: {
      brand: 'pepsi',
      flavor: 'diet'
    }
  })
  const items1 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  items1.sort((a, b) => a.key.localeCompare(b.key))
  t.is(items1.length, 4)
  t.is(items1[0].value.classId, 'soda')
  t.is(items1[0].value.qty, 20)
  t.is(items1[0].value.properties.brand, 'coke')
  t.is(items1[0].value.properties.flavor, 'diet')
  t.is(items1[0].value.owner.userId, folks.userId)
  t.is(items1[0].value.createdBy.userId, alice.userId)
  t.is(items1[1].value.classId, 'soda')
  t.is(items1[1].value.qty, 10)
  t.is(items1[1].value.properties.brand, 'coke')
  t.is(items1[1].value.properties.flavor, 'original')
  t.is(items1[1].value.owner.userId, folks.userId)
  t.is(items1[1].value.createdBy.userId, alice.userId)
  t.is(items1[2].value.classId, 'soda')
  t.is(items1[2].value.qty, 40)
  t.is(items1[2].value.properties.brand, 'pepsi')
  t.is(items1[2].value.properties.flavor, 'diet')
  t.is(items1[2].value.owner.userId, folks.userId)
  t.is(items1[2].value.createdBy.userId, alice.userId)
  t.is(items1[3].value.classId, 'soda')
  t.is(items1[3].value.qty, 30)
  t.is(items1[3].value.properties.brand, 'pepsi')
  t.is(items1[3].value.properties.flavor, 'original')
  t.is(items1[3].value.owner.userId, folks.userId)
  t.is(items1[3].value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: `soda:${folks.userId}:pepsi:diet`,
    qty: 15,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl}
  })
  const items2 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  items2.sort((a, b) => a.key.localeCompare(b.key))
  t.is(items2.length, 5)
  t.is(items2[0].value.classId, 'soda')
  t.is(items2[0].value.qty, 15)
  t.is(items2[0].value.properties.brand, 'pepsi')
  t.is(items2[0].value.properties.flavor, 'diet')
  t.is(items2[0].value.owner.userId, bob.userId)
  t.is(items2[0].value.createdBy.userId, alice.userId)
  t.is(items2[1].value.classId, 'soda')
  t.is(items2[1].value.qty, 20)
  t.is(items2[1].value.properties.brand, 'coke')
  t.is(items2[1].value.properties.flavor, 'diet')
  t.is(items2[1].value.owner.userId, folks.userId)
  t.is(items2[1].value.createdBy.userId, alice.userId)
  t.is(items2[2].value.classId, 'soda')
  t.is(items2[2].value.qty, 10)
  t.is(items2[2].value.properties.brand, 'coke')
  t.is(items2[2].value.properties.flavor, 'original')
  t.is(items2[2].value.owner.userId, folks.userId)
  t.is(items2[2].value.createdBy.userId, alice.userId)
  t.is(items2[3].value.classId, 'soda')
  t.is(items2[3].value.qty, 25)
  t.is(items2[3].value.properties.brand, 'pepsi')
  t.is(items2[3].value.properties.flavor, 'diet')
  t.is(items2[3].value.owner.userId, folks.userId)
  t.is(items2[3].value.createdBy.userId, alice.userId)
  t.is(items2[4].value.classId, 'soda')
  t.is(items2[4].value.qty, 30)
  t.is(items2[4].value.properties.brand, 'pepsi')
  t.is(items2[4].value.properties.flavor, 'original')
  t.is(items2[4].value.owner.userId, folks.userId)
  t.is(items2[4].value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: `soda:${folks.userId}:coke:diet`,
    qty: 5,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl}
  })
  const items3 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  items3.sort((a, b) => a.key.localeCompare(b.key))
  t.is(items3.length, 6)
  t.is(items3[0].value.classId, 'soda')
  t.is(items3[0].value.qty, 5)
  t.is(items3[0].value.properties.brand, 'coke')
  t.is(items3[0].value.properties.flavor, 'diet')
  t.is(items3[0].value.owner.userId, bob.userId)
  t.is(items3[0].value.createdBy.userId, alice.userId)
  t.is(items3[1].value.classId, 'soda')
  t.is(items3[1].value.qty, 15)
  t.is(items3[1].value.properties.brand, 'pepsi')
  t.is(items3[1].value.properties.flavor, 'diet')
  t.is(items3[1].value.owner.userId, bob.userId)
  t.is(items3[1].value.createdBy.userId, alice.userId)
  t.is(items3[2].value.classId, 'soda')
  t.is(items3[2].value.qty, 15)
  t.is(items3[2].value.properties.brand, 'coke')
  t.is(items3[2].value.properties.flavor, 'diet')
  t.is(items3[2].value.owner.userId, folks.userId)
  t.is(items3[2].value.createdBy.userId, alice.userId)
  t.is(items3[3].value.classId, 'soda')
  t.is(items3[3].value.qty, 10)
  t.is(items3[3].value.properties.brand, 'coke')
  t.is(items3[3].value.properties.flavor, 'original')
  t.is(items3[3].value.owner.userId, folks.userId)
  t.is(items3[3].value.createdBy.userId, alice.userId)
  t.is(items3[4].value.classId, 'soda')
  t.is(items3[4].value.qty, 25)
  t.is(items3[4].value.properties.brand, 'pepsi')
  t.is(items3[4].value.properties.flavor, 'diet')
  t.is(items3[4].value.owner.userId, folks.userId)
  t.is(items3[4].value.createdBy.userId, alice.userId)
  t.is(items3[5].value.classId, 'soda')
  t.is(items3[5].value.qty, 30)
  t.is(items3[5].value.properties.brand, 'pepsi')
  t.is(items3[5].value.properties.flavor, 'original')
  t.is(items3[5].value.owner.userId, folks.userId)
  t.is(items3[5].value.createdBy.userId, alice.userId)
})

test('fungible items', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, carla, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await carla.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'paulbucks',
    grouping: 'fungible'
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'paulbucks')

  const getItemOf = (items, userId) => items.find(item => item.value.owner.userId === userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'paulbucks',
    qty: 100
  })
  const items1 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items1.length, 1)
  t.is(items1[0].value.classId, 'paulbucks')
  t.is(items1[0].value.qty, 100)
  t.is(items1[0].value.owner.userId, folks.userId)
  t.is(items1[0].value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: getItemOf(items1, folks.userId).key,
    qty: 10,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl}
  })
  const items2 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items2.length, 2)
  t.is(getItemOf(items2, folks.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items2, folks.userId).value.qty, 90)
  t.is(getItemOf(items2, folks.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items2, bob.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items2, bob.userId).value.qty, 10)
  t.is(getItemOf(items2, bob.userId).value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: getItemOf(items2, bob.userId).key,
    qty: 2,
    recp: {userId: carla.userId, dbUrl: carla.dbUrl}
  })
  const items3 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items3.length, 3)
  t.is(getItemOf(items3, folks.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items3, folks.userId).value.qty, 90)
  t.is(getItemOf(items3, folks.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items3, bob.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items3, bob.userId).value.qty, 8)
  t.is(getItemOf(items3, bob.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items3, carla.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items3, carla.userId).value.qty, 2)
  t.is(getItemOf(items3, carla.userId).value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: getItemOf(items3, carla.userId).key,
    qty: 2,
    recp: {userId: alice.userId, dbUrl: alice.dbUrl}
  })
  const items4 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items4.length, 3)
  t.is(getItemOf(items4, folks.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items4, folks.userId).value.qty, 90)
  t.is(getItemOf(items4, folks.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items4, bob.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items4, bob.userId).value.qty, 8)
  t.is(getItemOf(items4, bob.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items4, alice.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items4, alice.userId).value.qty, 2)
  t.is(getItemOf(items4, alice.userId).value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: getItemOf(items4, bob.userId).key,
    qty: 2,
    recp: {userId: alice.userId, dbUrl: alice.dbUrl}
  })
  const items5 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items5.length, 3)
  t.is(getItemOf(items5, folks.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items5, folks.userId).value.qty, 90)
  t.is(getItemOf(items5, folks.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items5, bob.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items5, bob.userId).value.qty, 6)
  t.is(getItemOf(items5, bob.userId).value.createdBy.userId, alice.userId)
  t.is(getItemOf(items5, alice.userId).value.classId, 'paulbucks')
  t.is(getItemOf(items5, alice.userId).value.qty, 4)
  t.is(getItemOf(items5, alice.userId).value.createdBy.userId, alice.userId)
})

test('destroying items', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, folks} = sim.users

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'paulbucks',
    grouping: 'fungible'
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'paulbucks')

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'paulbucks',
    qty: 100
  })
  const items1 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items1.length, 1)
  t.is(items1[0].value.classId, 'paulbucks')
  t.is(items1[0].value.qty, 100)
  t.is(items1[0].value.owner.userId, folks.userId)
  t.is(items1[0].value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/destroy-item-method', {
    itemKey: items1[0].key,
    qty: 10
  })
  const items2 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items2.length, 1)
  t.is(items2[0].value.classId, 'paulbucks')
  t.is(items2[0].value.qty, 90)
  t.is(items2[0].value.owner.userId, folks.userId)
  t.is(items2[0].value.createdBy.userId, alice.userId)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/destroy-item-method', {
    itemKey: items2[0].key,
    qty: 90
  })
  const items3 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items3.length, 0)
})

test('creating items with an owner that already possesses some of the item', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, folks} = sim.users

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'paulbucks',
    grouping: 'fungible'
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'paulbucks')

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'paulbucks',
    qty: 100
  })
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'paulbucks',
    qty: 100
  })
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'paulbucks',
    qty: 100
  })
  
  const items1 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  t.is(items1.length, 1)
  t.is(items1[0].value.classId, 'paulbucks')
  t.is(items1[0].value.qty, 300)
  t.is(items1[0].value.owner.userId, folks.userId)
  t.is(items1[0].value.createdBy.userId, alice.userId)
})

test('ownership permissions', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'cat',
    grouping: 'unique',
    definition: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: 'object',
      properties: {
        name: {type: 'string'},
        color: {type: 'string'},
        fluffiness: {type: 'string', enum: ['not', 'fluffy', 'very-floof']}
      }
    }
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'cat')
  t.is(itemClasses1[0].value.definition.properties.color.type, 'string')

  const item = await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'cat',
    qty: 1,
    owner: {userId: alice.userId, dbUrl: alice.dbUrl},
    properties: {
      name: 'Kit',
      color: 'tabby',
      fluffiness: 'not'
    }
  })

  await bob.login()
  // bob try to steal kit, bad bob
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: item.key,
    qty: 1,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl}
  }))
})

test('overspending', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, folks} = sim.users

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'paulbucks',
    grouping: 'fungible'
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'paulbucks')

  const item = await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'paulbucks',
    qty: 100
  })
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: item.key,
    qty: 1000
  }))
})

test('managing item classes', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api
  const testImgBase64 = fs.readFileSync(TEST_IMAGE_PATH, 'base64')
  const testImg2Base64 = fs.readFileSync(TEST_IMAGE2_PATH, 'base64')

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)

  await alice.login()
  const blobsRes1 = await api.blob.create(testImgBase64)
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'paulbucks',
    grouping: 'fungible',
    iconSource: {userId: alice.userId, dbUrl: alice.dbUrl, blobName: blobsRes1.name}
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'paulbucks')
  t.falsy(itemClasses1[0].value.definition)
  await t.is((await api.blob.get(folks.userId, itemClasses1[0].value.iconBlobName)).buf, testImgBase64)

  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'paulbucks',
    grouping: 'fungible'
  }))

  const blobsRes2 = await api.blob.create(testImg2Base64)
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/update-item-class-method', {
    classId: 'paulbucks',
    definition: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: 'object',
      properties: {
        hypelevel: {type: 'number'}
      }
    },
    iconSource: {userId: alice.userId, dbUrl: alice.dbUrl, blobName: blobsRes2.name}
  })
  const itemClasses2 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses2.length, 1)
  t.is(itemClasses2[0].value.id, 'paulbucks')
  t.is(itemClasses2[0].value.definition.properties.hypelevel.type, 'number')
  await t.is((await api.blob.get(folks.userId, itemClasses2[0].value.iconBlobName)).buf, testImg2Base64)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/delete-item-class-method', {
    classId: 'paulbucks'
  })
  const itemClasses3 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses3.length, 0)

  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/update-item-class-method', {
    classId: 'paulbucks',
    description: 'cool cool'
  }))

  await bob.login()
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'paulbucks',
    grouping: 'fungible'
  }))
})

test('inventory view', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, carla, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await carla.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'paulbucks',
    grouping: 'fungible'
  })
  const folksBucks = await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'paulbucks',
    qty: 100
  })
  const bobBucks = await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: folksBucks.result.details.key,
    qty: 10,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl}
  })
  const carlaBucks = await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: bobBucks.result.details.key,
    qty: 2,
    recp: {userId: carla.userId, dbUrl: carla.dbUrl}
  })

  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()

  const view1 = (await api.view.get('ctzn.network/owned-items-view', folks.userId)).items
  t.is(view1.length, 1)
  t.is(view1[0].key, folksBucks.result.details.key)
  t.is(view1[0].url, folksBucks.result.details.url)
  t.is(view1[0].databaseId, folks.userId)
  t.is(view1[0].value.classId, 'paulbucks')
  t.is(view1[0].value.qty, 90)
  t.is(view1[0].value.owner.userId, folks.userId)
  const view2 = (await api.view.get('ctzn.network/owned-items-view', bob.userId)).items
  t.is(view2.length, 1)
  t.is(view2[0].key, bobBucks.result.details.key)
  t.is(view2[0].url, bobBucks.result.details.url)
  t.is(view2[0].databaseId, folks.userId)
  t.is(view2[0].value.classId, 'paulbucks')
  t.is(view2[0].value.qty, 8)
  t.is(view2[0].value.owner.userId, bob.userId)
  const view3 = (await api.view.get('ctzn.network/owned-items-view', carla.userId)).items
  t.is(view3.length, 1)
  t.is(view3[0].key, carlaBucks.result.details.key)
  t.is(view3[0].url, carlaBucks.result.details.url)
  t.is(view3[0].databaseId, folks.userId)
  t.is(view3[0].value.classId, 'paulbucks')
  t.is(view3[0].value.qty, 2)
  t.is(view3[0].value.owner.userId, carla.userId)

  const aliceBucks = await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: carlaBucks.result.details.key,
    qty: 2,
    recp: {userId: alice.userId, dbUrl: alice.dbUrl}
  })
  await new Promise(r => setTimeout(r, 5e3))
  await api.debug.whenAllSynced()
  const view4 = (await api.view.get('ctzn.network/owned-items-view', folks.userId)).items
  t.is(view4.length, 1)
  t.is(view4[0].key, folksBucks.result.details.key)
  t.is(view4[0].url, folksBucks.result.details.url)
  t.is(view4[0].databaseId, folks.userId)
  t.is(view4[0].value.classId, 'paulbucks')
  t.is(view4[0].value.qty, 90)
  t.is(view4[0].value.owner.userId, folks.userId)
  const view5 = (await api.view.get('ctzn.network/owned-items-view', bob.userId)).items
  t.is(view5.length, 1)
  t.is(view5[0].key, bobBucks.result.details.key)
  t.is(view5[0].url, bobBucks.result.details.url)
  t.is(view5[0].databaseId, folks.userId)
  t.is(view5[0].value.classId, 'paulbucks')
  t.is(view5[0].value.qty, 8)
  t.is(view5[0].value.owner.userId, bob.userId)
  const view6 = (await api.view.get('ctzn.network/owned-items-view', carla.userId)).items
  t.is(view6.length, 0)
  const view7 = (await api.view.get('ctzn.network/owned-items-view', alice.userId)).items
  t.is(view7.length, 1)
  t.is(view7[0].key, aliceBucks.result.details.key)
  t.is(view7[0].url, aliceBucks.result.details.url)
  t.is(view7[0].databaseId, folks.userId)
  t.is(view7[0].value.classId, 'paulbucks')
  t.is(view7[0].value.qty, 2)
  t.is(view7[0].value.owner.userId, alice.userId)
})

test('transfer relations to posts/comments', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)
  let api = inst.api

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, carla, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await carla.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-class-method', {
    classId: 'paulbucks',
    grouping: 'fungible'
  })
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'paulbucks',
    qty: 100,
    owner: {userId: alice.userId, dbUrl: alice.dbUrl},
  })
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/create-item-method', {
    classId: 'paulbucks',
    qty: 100,
    owner: {userId: carla.userId, dbUrl: carla.dbUrl},
  })
  const items1 = (await api.table.list(folks.userId, 'ctzn.network/item'))?.entries
  
  await bob.login()
  const bobPost = await bob.createPost({text: 'post', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  const bobComment = await bob.createComment({text: 'comment', reply: {root: bobPost}, community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})

  await alice.login()
  const tfx1 = await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: items1[0].key,
    qty: 10,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl},
    relatedTo: {dbUrl: bobPost.url}
  })
  await carla.login()
  const tfx2 = await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: items1[1].key,
    qty: 10,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl},
    relatedTo: {dbUrl: bobPost.url}
  })
  const tfx3 = await sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: items1[1].key,
    qty: 10,
    recp: {userId: bob.userId, dbUrl: bob.dbUrl},
    relatedTo: {dbUrl: bobComment.url}
  })

  const idxEntries1 = (await api.table.list(inst.serverUserId, 'ctzn.network/item-tfx-relation-idx')).entries
  t.is(idxEntries1.length, 2)
  t.is(idxEntries1[0].value.subject.authorId, bob.userId)
  t.is(idxEntries1[0].value.subject.dbUrl, bobComment.url)
  t.is(idxEntries1[0].value.transfers[0].dbmethodCall.authorId, carla.userId)
  t.is(idxEntries1[0].value.transfers[0].dbmethodCall.dbUrl, tfx3.url)
  t.is(idxEntries1[0].value.transfers[0].itemClassId, 'paulbucks')
  t.is(idxEntries1[0].value.transfers[0].qty, 10)
  t.is(idxEntries1[1].key, bobPost.url)
  t.is(idxEntries1[1].value.subject.authorId, bob.userId)
  t.is(idxEntries1[1].value.subject.dbUrl, bobPost.url)
  t.is(idxEntries1[1].value.transfers[0].dbmethodCall.authorId, alice.userId)
  t.is(idxEntries1[1].value.transfers[0].dbmethodCall.dbUrl, tfx1.url)
  t.is(idxEntries1[1].value.transfers[0].itemClassId, 'paulbucks')
  t.is(idxEntries1[1].value.transfers[0].qty, 10)
  t.is(idxEntries1[1].value.transfers[1].dbmethodCall.authorId, carla.userId)
  t.is(idxEntries1[1].value.transfers[1].dbmethodCall.dbUrl, tfx2.url)
  t.is(idxEntries1[1].value.transfers[1].itemClassId, 'paulbucks')
  t.is(idxEntries1[1].value.transfers[1].qty, 10)

  await alice.login()
  // throws because the related item must be authored by the recipient
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/transfer-item-method', {
    itemKey: items1[0].key,
    qty: 10,
    recp: {userId: carla.userId, dbUrl: carla.dbUrl},
    relatedTo: {dbUrl: bobPost.url}
  }))

  await bob.login()
  const postEntries = (await api.view.get('ctzn.network/posts-view', bob.userId)).posts
  t.is(postEntries[0].relatedItemTransfers.length, 2)
  const postEntry = (await api.view.get('ctzn.network/post-view', bob.userId, bobPost.key))
  t.is(postEntry.relatedItemTransfers.length, 2)
  const feedEntries = (await api.view.get('ctzn.network/feed-view')).feed
  t.is(feedEntries[0].relatedItemTransfers.length, 2)
  const threadEntries = (await api.view.get('ctzn.network/thread-view', bobPost.url)).comments
  t.is(threadEntries[0].relatedItemTransfers.length, 1)
  const commentEntry = (await api.view.get('ctzn.network/comment-view', bob.userId, bobComment.key))
  t.is(commentEntry.relatedItemTransfers.length, 1)
})