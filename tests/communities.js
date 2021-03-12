import test from 'ava'
import fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { createServer, TestFramework } from './_util.js'

const TEST_IMAGE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'test-img.jpg')

let instances = []

test.after.always(async t => {
  for (let inst of instances) {
    await inst.close()
  }
})

test('membership', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  instances.push(inst)

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  await sim.createCommunity(inst, 'ppl')
  const {alice, bob, carla, folks, ppl} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await api.communities.join(ppl.userId)
  await carla.login()
  await api.communities.join(folks.userId)

  let members1 = (await api.table.list(folks.userId, 'ctzn.network/community-member')).entries
  t.is(members1.length, 3)
  t.deepEqual(members1.find(m => m.value.user.userId === alice.userId).value.user.dbUrl, alice.profile.dbUrl)
  t.deepEqual(members1.find(m => m.value.user.userId === bob.userId).value.user.dbUrl, bob.profile.dbUrl)
  t.deepEqual(members1.find(m => m.value.user.userId === carla.userId).value.user.dbUrl, carla.profile.dbUrl)
  
  let members2 = (await api.table.list(ppl.userId, 'ctzn.network/community-member')).entries
  t.is(members2.length, 2)
  t.deepEqual(members2.find(m => m.value.user.userId === alice.userId).value.user.dbUrl, alice.profile.dbUrl)
  t.deepEqual(members2.find(m => m.value.user.userId === bob.userId).value.user.dbUrl, bob.profile.dbUrl)

  let members3 = (await api.table.list(folks.userId, 'ctzn.network/community-member', {limit: 1})).entries
  t.is(members3.length, 1)

  let memberships1 = (await api.table.list(alice.userId, 'ctzn.network/community-membership')).entries
  t.is(memberships1.length, 2)
  t.deepEqual(memberships1.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)
  t.deepEqual(memberships1.find(m => m.value.community.userId === ppl.userId).value.community.dbUrl, ppl.profile.dbUrl)

  let memberships2 = (await api.table.list(bob.userId, 'ctzn.network/community-membership')).entries
  t.is(memberships2.length, 2)
  t.deepEqual(memberships2.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)
  t.deepEqual(memberships2.find(m => m.value.community.userId === ppl.userId).value.community.dbUrl, ppl.profile.dbUrl)

  let memberships3 = (await api.table.list(carla.userId, 'ctzn.network/community-membership')).entries
  t.is(memberships3.length, 1)
  t.deepEqual(memberships3.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)

  let memberships4 = (await api.table.list(alice.userId, 'ctzn.network/community-membership', {limit: 1})).entries
  t.is(memberships4.length, 1)

  await alice.login()
  await api.communities.leave(ppl.userId)
  await bob.login()
  await api.communities.leave(folks.userId)
  await api.communities.leave(ppl.userId)

  let members4 = (await api.table.list(folks.userId, 'ctzn.network/community-member')).entries
  t.is(members4.length, 2)
  t.deepEqual(members4.find(m => m.value.user.userId === alice.userId).value.user.dbUrl, alice.profile.dbUrl)
  t.deepEqual(members4.find(m => m.value.user.userId === carla.userId).value.user.dbUrl, carla.profile.dbUrl)
  
  let members5 = (await api.table.list(ppl.userId, 'ctzn.network/community-member')).entries
  t.is(members5.length, 0)

  let memberships5 = (await api.table.list(alice.userId, 'ctzn.network/community-membership')).entries
  t.is(memberships5.length, 1)
  t.deepEqual(memberships5.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)

  let memberships6 = (await api.table.list(bob.userId, 'ctzn.network/community-membership')).entries
  t.is(memberships6.length, 0)

  let memberships7 = (await api.table.list(carla.userId, 'ctzn.network/community-membership')).entries
  t.is(memberships7.length, 1)
  t.deepEqual(memberships7.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)
})

test('remote joining & leaving', async t => {
  let sim = new TestFramework()
  let inst1 = await createServer()
  let inst2 = await createServer()
  instances.push(inst1)
  instances.push(inst2)
  
  await sim.createCitizen(inst1, 'bob')
  await sim.users.bob.login()
  await sim.createCommunity(inst1, 'folks')
  await sim.createCitizen(inst2, 'alice')
  const {alice, folks} = sim.users

  await alice.login()
  await inst2.api.communities.join(folks.userId)

  let members1 = (await inst1.api.table.list(folks.userId, 'ctzn.network/community-member')).entries
  t.is(members1.length, 2)
  t.deepEqual(members1.find(m => m.value.user.userId === alice.userId).value.user.dbUrl, alice.profile.dbUrl)

  let memberships1 = (await inst2.api.table.list(alice.userId, 'ctzn.network/community-membership')).entries
  t.is(memberships1.length, 1)
  t.deepEqual(memberships1.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)

  await alice.login()
  await inst2.api.communities.leave(folks.userId)

  let members2 = (await inst1.api.table.list(folks.userId, 'ctzn.network/community-member')).entries
  t.is(members2.length, 1)

  let memberships2 = (await inst2.api.table.list(alice.userId, 'ctzn.network/community-membership')).entries
  t.is(memberships2.length, 0)
})

test('roles', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  instances.push(inst)

  await sim.createCitizen(inst, 'alice')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  const {alice, folks} = sim.users

  let roles1 = (await api.table.list(folks.userId, 'ctzn.network/community-role')).entries
  t.is(roles1.length, 1)
  t.is(roles1[0].value.roleId, 'moderator')
  t.is(roles1[0].value.permissions.length, 3)
  t.truthy(roles1[0].value.permissions.find(p => p.permId === 'ctzn.network/perm-community-ban'))
  t.truthy(roles1[0].value.permissions.find(p => p.permId === 'ctzn.network/perm-community-remove-post'))
  t.truthy(roles1[0].value.permissions.find(p => p.permId === 'ctzn.network/perm-community-remove-comment'))

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-put-role-method', {
    roleId: 'super-moderator',
    permissions: [
      {permId: 'ctzn.network/perm-community-ban'},
      {permId: 'ctzn.network/perm-community-remove-post'},
      {permId: 'ctzn.network/perm-community-edit-profile'}
    ]
  })
  let roles2 = (await api.table.list(folks.userId, 'ctzn.network/community-role')).entries
  t.is(roles2.length, 2)
  let role1 = await api.table.get(folks.userId, 'ctzn.network/community-role', 'super-moderator')
  t.is(role1.value.roleId, 'super-moderator')
  t.is(role1.value.permissions.length, 3)
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-ban'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-remove-post'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-edit-profile'))

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-set-member-roles-method', {
    member: {userId: alice.userId, dbUrl: alice.dbUrl},
    roles: ['admin', 'super-moderator']
  })
  let member1 = await api.table.get(folks.userId, 'ctzn.network/community-member', alice.userId)
  t.deepEqual(member1.value.roles, ['admin', 'super-moderator'])

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-put-role-method', {
    roleId: 'super-moderator',
    permissions: [
      {permId: 'ctzn.network/perm-community-edit-profile'}
    ]
  })
  let role2 = await api.table.get(folks.userId, 'ctzn.network/community-role', 'super-moderator')
  t.is(role2.value.roleId, 'super-moderator')
  t.is(role2.value.permissions.length, 1)
  t.truthy(role2.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-edit-profile'))

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-delete-role-method', {roleId: 'super-moderator'})
  let roles3 = (await api.table.list(folks.userId, 'ctzn.network/community-role')).entries
  t.is(roles3.length, 1)
  t.is(roles3[0].value.roleId, 'moderator')
  let member2 = await api.table.get(folks.userId, 'ctzn.network/community-member', alice.userId)
  t.deepEqual(member2.value.roles, ['admin'])
})

test('permissions', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  instances.push(inst)

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.createCitizen(inst, 'carla')
  await sim.createCitizen(inst, 'doug')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  const {alice, bob, carla, doug, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)
  await carla.login()
  await api.communities.join(folks.userId)
  await doug.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-put-role-method', {
    roleId: 'super-moderator',
    permissions: [
      {permId: 'ctzn.network/perm-community-ban'},
      {permId: 'ctzn.network/perm-community-remove-post'},
      {permId: 'ctzn.network/perm-community-edit-profile'},
      {permId: 'ctzn.network/perm-community-manage-roles'},
      {permId: 'ctzn.network/perm-community-assign-roles'}
    ]
  })
  let roles2 = (await api.table.list(folks.userId, 'ctzn.network/community-role')).entries
  t.is(roles2.length, 2)
  let role1 = await api.table.get(folks.userId, 'ctzn.network/community-role', 'super-moderator')
  t.is(role1.value.roleId, 'super-moderator')
  t.is(role1.value.permissions.length, 5)
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-ban'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-remove-post'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-edit-profile'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-manage-roles'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-assign-roles'))

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-set-member-roles-method', {
    member: {userId: bob.userId, dbUrl: bob.dbUrl},
    roles: ['super-moderator']
  })
  let member1 = await api.table.get(folks.userId, 'ctzn.network/community-member', bob.userId)
  t.deepEqual(member1.value.roles, ['super-moderator'])

  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-set-member-roles-method', {
    member: {userId: carla.userId, dbUrl: carla.dbUrl},
    roles: ['moderator']
  })
  let member2 = await api.table.get(folks.userId, 'ctzn.network/community-member', carla.userId)
  t.deepEqual(member2.value.roles, ['moderator'])

  let perms1 = (await api.view.get('ctzn.network/community-user-permissions-view', folks.userId, alice.userId)).permissions
  t.is(perms1.length, 1)
  t.truthy(perms1.find(p => p.permId === 'ctzn.network/perm-admin'))

  let perms2 = (await api.view.get('ctzn.network/community-user-permissions-view', folks.userId, bob.userId)).permissions
  t.is(perms2.length, 5)
  t.truthy(perms2.find(p => p.permId === 'ctzn.network/perm-community-ban'))
  t.truthy(perms2.find(p => p.permId === 'ctzn.network/perm-community-remove-post'))
  t.truthy(perms2.find(p => p.permId === 'ctzn.network/perm-community-edit-profile'))
  t.truthy(perms2.find(p => p.permId === 'ctzn.network/perm-community-manage-roles'))
  t.truthy(perms2.find(p => p.permId === 'ctzn.network/perm-community-assign-roles'))

  let perms3 = (await api.view.get('ctzn.network/community-user-permissions-view', folks.userId, carla.userId)).permissions
  t.is(perms3.length, 3)
  t.truthy(perms3.find(p => p.permId === 'ctzn.network/perm-community-ban'))
  t.truthy(perms3.find(p => p.permId === 'ctzn.network/perm-community-remove-post'))
  t.truthy(perms3.find(p => p.permId === 'ctzn.network/perm-community-remove-comment'))

  let perm1 = await api.view.get('ctzn.network/community-user-permission-view', folks.userId, alice.userId, 'ctzn.network/perm-community-ban')
  t.truthy(perm1.permId, 'ctzn.network/perm-admin')

  let perm2 = await api.view.get('ctzn.network/community-user-permission-view', folks.userId, carla.userId, 'ctzn.network/perm-community-ban')
  t.truthy(perm2.permId, 'ctzn.network/perm-community-ban')

  let perm3 = await api.view.get('ctzn.network/community-user-permission-view', folks.userId, carla.userId, 'ctzn.network/perm-manage-roles')
  t.falsy(perm3)

  /// ctzn.network/perm-community-edit-profile
  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-profile-method', {displayName: 'Folks 1'})
  t.is((await api.view.get('ctzn.network/profile-view', folks.userId)).value.displayName, 'Folks 1')
  const testImgBase64 = fs.readFileSync(TEST_IMAGE_PATH, 'base64')
  const blobsRes1 = await api.blobs.create(testImgBase64)
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-avatar-method', {
    blobSource: {userId: alice.userId, dbUrl: alice.dbUrl},
    blobName: blobsRes1.name
  })
  await t.is(await api.blobs.get(folks.userId, 'avatar'), testImgBase64)
  await bob.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-profile-method', {displayName: 'Folks 2'})
  t.is((await api.view.get('ctzn.network/profile-view', folks.userId)).value.displayName, 'Folks 2')
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/put-avatar-method', {
    blobSource: {userId: alice.userId, dbUrl: alice.dbUrl},
    blobName: blobsRes1.name
  })
  await carla.login()
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/put-profile-method', {displayName: 'Folks 3'}))
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/put-avatar-method', {
    blobSource: {userId: alice.userId, dbUrl: alice.dbUrl},
    blobName: blobsRes1.name
  }))
  await doug.login()
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/put-profile-method', {displayName: 'Folks 3'}))
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/put-avatar-method', {
    blobSource: {userId: alice.userId, dbUrl: alice.dbUrl},
    blobName: blobsRes1.name
  }))

  /// ctzn.network/perm-community-assign-roles
  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-put-role-method', {roleId: 'debug'})
  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-set-member-roles-method', {
    member: {userId: doug.userId, dbUrl: doug.dbUrl},
    roles: ['debug']
  })
  await bob.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-set-member-roles-method', {
    member: {userId: doug.userId, dbUrl: doug.dbUrl},
    roles: ['debug']
  })
  await carla.login()
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/community-set-member-roles-method', {
    member: {userId: doug.userId, dbUrl: doug.dbUrl},
    roles: ['debug']
  }))
  await doug.login()
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/community-set-member-roles-method', {
    member: {userId: doug.userId, dbUrl: doug.dbUrl},
    roles: ['debug']
  }))

  /// ctzn.network/perm-community-manage-roles
  await alice.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-put-role-method', {roleId: 'role1'})
  await bob.login()
  await sim.dbmethod(inst, folks.userId, 'ctzn.network/community-put-role-method', {roleId: 'role2'})
  await carla.login()
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/community-put-role-method', {roleId: 'role3'}))
  await doug.login()
  await t.throwsAsync(() => sim.dbmethod(inst, folks.userId, 'ctzn.network/community-put-role-method', {roleId: 'role4'}))

  /// ctzn.network/perm-community-ban
  await alice.login()
  await api.communities.removeMember(folks.userId, doug.userId, {ban: true}) // so long, new doug
  await api.communities.putBan(folks.userId, doug.userId, {reason: 'Jerk!'})
  await api.communities.deleteBan(folks.userId, doug.userId)
  await doug.login()
  await api.communities.join(folks.userId)
  await bob.login()
  await api.communities.removeMember(folks.userId, doug.userId, {ban: true})
  await api.communities.putBan(folks.userId, doug.userId, {reason: 'Jerk!'})
  await api.communities.deleteBan(folks.userId, doug.userId)
  await doug.login()
  await api.communities.join(folks.userId)
  await carla.login()
  await api.communities.removeMember(folks.userId, doug.userId, {ban: true})
  await api.communities.putBan(folks.userId, doug.userId, {reason: 'Jerk!'})
  await api.communities.deleteBan(folks.userId, doug.userId)
  await doug.login()
  await t.throwsAsync(() => api.communities.removeMember(folks.userId, doug.userId, {ban: true}))
})

test('bans', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  instances.push(inst)

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  const {alice, bob, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await api.communities.removeMember(folks.userId, bob.userId, {ban: true, banReason: 'Jerk!'})
  t.is((await api.table.get(folks.userId, 'ctzn.network/community-ban', bob.userId)).value.reason, 'Jerk!')
  t.falsy(await api.table.get(folks.userId, 'ctzn.network/community-member', bob.userId))

  await api.communities.putBan(folks.userId, bob.userId, {reason: 'Jerk!!'})
  t.is((await api.table.get(folks.userId, 'ctzn.network/community-ban', bob.userId)).value.reason, 'Jerk!!')

  await bob.login()
  await t.throwsAsync(() => api.communities.join(folks.userId))

  await alice.login()
  await api.communities.deleteBan(folks.userId, bob.userId)
  t.falsy(await api.table.get(folks.userId, 'ctzn.network/community-ban', bob.userId))
  await bob.login()
  await api.communities.join(folks.userId)
})

test('post and comment removal', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  instances.push(inst)

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  const {alice, bob, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)

  await bob.login()
  await bob.createPost({text: 'Post 1', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await bob.createPost({text: 'Post 2', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})
  await bob.createPost({text: 'Post 3', community: {userId: folks.userId, dbUrl: folks.profile.dbUrl}})

  await bob.createComment({
    reply: {root: bob.posts[0]},
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    text: 'Test 1'
  })
  await bob.createComment({
    reply: {root: bob.posts[0], parent: bob.comments[0]},
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    text: 'Test 2'
  })
  await bob.createComment({
    reply: {root: bob.posts[0]},
    community: {userId: folks.userId, dbUrl: folks.profile.dbUrl},
    text: 'Test 3'
  })

  await alice.login()

  let posts1 = (await api.view.get('ctzn.network/posts-view', folks.userId)).posts
  sim.testFeed(t, posts1, [
    [bob, 'Post 1'],
    [bob, 'Post 2'],
    [bob, 'Post 3']
  ])
  let thread1 = (await api.view.get('ctzn.network/thread-view', bob.posts[0].url)).comments
  sim.testThread(t, thread1, [
    [bob, 'Test 1', [
      [bob, 'Test 2']
    ]],
    [bob, 'Test 3']
  ])

  await api.communities.removePost(folks.userId, bob.posts[1].url)
  let posts2 = (await api.view.get('ctzn.network/posts-view', folks.userId)).posts
  sim.testFeed(t, posts2, [
    [bob, 'Post 1'],
    [bob, 'Post 3']
  ])

  await api.communities.removeComment(folks.userId, bob.posts[0].url, bob.comments[1].url)
  sim.testThread(t, thread1, [
    [bob, 'Test 1'],
    [bob, 'Test 3']
  ])
})

test('valid usernames', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  instances.push(inst)

  await sim.createCitizen(inst, 'alice')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  await sim.createCommunity(inst, 'good-folks')
  await sim.createCommunity(inst, 'folks2')
  await t.throwsAsync(() => sim.createCommunity(inst, '1folks'))
  await t.throwsAsync(() => sim.createCommunity(inst, 'good-folks-'))
  await t.throwsAsync(() => sim.createCommunity(inst, '-good-folks'))
})