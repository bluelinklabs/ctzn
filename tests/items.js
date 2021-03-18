import test from 'ava'
import { createServer, TestFramework } from './_util.js'

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
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'cat',
    keyTemplate: [{type: 'auto'}],
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

test('unique items (property id)', async t => {
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
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
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

test('semi-fungible items', async t => {
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
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
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
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'paulbucks',
    keyTemplate: [
      {type: 'json-pointer', value: '/owner/userId'}
    ]
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
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'paulbucks',
    keyTemplate: [
      {type: 'json-pointer', value: '/owner/userId'}
    ]
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
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'paulbucks',
    keyTemplate: [
      {type: 'json-pointer', value: '/owner/userId'}
    ]
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
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'cat',
    keyTemplate: [{type: 'auto'}],
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
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'paulbucks',
    keyTemplate: [
      {type: 'json-pointer', value: '/owner/userId'}
    ]
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

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')

  const {alice, bob, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'paulbucks',
    keyTemplate: [
      {type: 'json-pointer', value: '/owner/userId'}
    ]
  })
  const itemClasses1 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses1.length, 1)
  t.is(itemClasses1[0].value.id, 'paulbucks')
  t.falsy(itemClasses1[0].value.definition)

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'paulbucks',
    keyTemplate: [
      {type: 'json-pointer', value: '/owner/userId'}
    ],
    definition: {
      "$schema": "http://json-schema.org/draft-07/schema#",
      type: 'object',
      properties: {
        hypelevel: {type: 'number'}
      }
    }
  })
  const itemClasses2 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses2.length, 1)
  t.is(itemClasses2[0].value.id, 'paulbucks')
  t.is(itemClasses2[0].value.definition.properties.hypelevel.type, 'number')

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/delete-item-class-method', {
    classId: 'paulbucks'
  })
  const itemClasses3 = (await api.table.list(folks.userId, 'ctzn.network/item-class'))?.entries
  t.is(itemClasses3.length, 0)

  await bob.login()
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'paulbucks',
    keyTemplate: [
      {type: 'json-pointer', value: '/owner/userId'}
    ]
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
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-item-class-method', {
    classId: 'paulbucks',
    keyTemplate: [
      {type: 'json-pointer', value: '/owner/userId'}
    ]
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
  const idx1 = (await api.table.list(folks.userId, 'ctzn.network/owned-items-idx')).entries
  t.is(idx1.length, 1)
  t.is(idx1[0].value.item.key, folksBucks.result.details.key)
  t.is(idx1[0].value.item.dbUrl, folksBucks.result.details.url)
  t.is(idx1[0].value.item.userId, folks.userId)
  const idx2 = (await api.table.list(bob.userId, 'ctzn.network/owned-items-idx')).entries
  t.is(idx2.length, 1)
  t.is(idx2[0].value.item.key, bobBucks.result.details.key)
  t.is(idx2[0].value.item.dbUrl, bobBucks.result.details.url)
  t.is(idx2[0].value.item.userId, folks.userId)
  const idx3 = (await api.table.list(carla.userId, 'ctzn.network/owned-items-idx')).entries
  t.is(idx3.length, 1)
  t.is(idx3[0].value.item.key, carlaBucks.result.details.key)
  t.is(idx3[0].value.item.dbUrl, carlaBucks.result.details.url)
  t.is(idx3[0].value.item.userId, folks.userId)
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
  const idx4 = (await api.table.list(folks.userId, 'ctzn.network/owned-items-idx')).entries
  t.is(idx4.length, 1)
  t.is(idx4[0].value.item.key, folksBucks.result.details.key)
  t.is(idx4[0].value.item.dbUrl, folksBucks.result.details.url)
  t.is(idx4[0].value.item.userId, folks.userId)
  const idx5 = (await api.table.list(bob.userId, 'ctzn.network/owned-items-idx')).entries
  t.is(idx5.length, 1)
  t.is(idx5[0].value.item.key, bobBucks.result.details.key)
  t.is(idx5[0].value.item.dbUrl, bobBucks.result.details.url)
  t.is(idx5[0].value.item.userId, folks.userId)
  const idx6 = (await api.table.list(carla.userId, 'ctzn.network/owned-items-idx')).entries
  t.is(idx6.length, 0)
  const idx7 = (await api.table.list(alice.userId, 'ctzn.network/owned-items-idx')).entries
  t.is(idx7.length, 1)
  t.is(idx7[0].value.item.key, aliceBucks.result.details.key)
  t.is(idx7[0].value.item.dbUrl, aliceBucks.result.details.url)
  t.is(idx7[0].value.item.userId, folks.userId)
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
