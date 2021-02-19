import test from 'ava'
import { createServer, TestFramework } from './_util.js'

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
  instances = [inst]

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

  let members1 = await api.communities.listMembers(folks.userId)
  t.is(members1.length, 3)
  t.deepEqual(members1.find(m => m.value.user.userId === alice.userId).value.user.dbUrl, alice.profile.dbUrl)
  t.deepEqual(members1.find(m => m.value.user.userId === bob.userId).value.user.dbUrl, bob.profile.dbUrl)
  t.deepEqual(members1.find(m => m.value.user.userId === carla.userId).value.user.dbUrl, carla.profile.dbUrl)
  
  let members2 = await api.communities.listMembers(ppl.userId)
  t.is(members2.length, 2)
  t.deepEqual(members2.find(m => m.value.user.userId === alice.userId).value.user.dbUrl, alice.profile.dbUrl)
  t.deepEqual(members2.find(m => m.value.user.userId === bob.userId).value.user.dbUrl, bob.profile.dbUrl)

  let members3 = await api.communities.listMembers(folks.userId, {limit: 1})
  t.is(members3.length, 1)

  let memberships1 = await api.communities.listMemberships(alice.userId)
  t.is(memberships1.length, 2)
  t.deepEqual(memberships1.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)
  t.deepEqual(memberships1.find(m => m.value.community.userId === ppl.userId).value.community.dbUrl, ppl.profile.dbUrl)

  let memberships2 = await api.communities.listMemberships(bob.userId)
  t.is(memberships2.length, 2)
  t.deepEqual(memberships2.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)
  t.deepEqual(memberships2.find(m => m.value.community.userId === ppl.userId).value.community.dbUrl, ppl.profile.dbUrl)

  let memberships3 = await api.communities.listMemberships(carla.userId)
  t.is(memberships3.length, 1)
  t.deepEqual(memberships3.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)

  let memberships4 = await api.communities.listMemberships(alice.userId, {limit: 1})
  t.is(memberships4.length, 1)

  await alice.login()
  await api.communities.leave(ppl.userId)
  await bob.login()
  await api.communities.leave(folks.userId)
  await api.communities.leave(ppl.userId)

  let members4 = await api.communities.listMembers(folks.userId)
  t.is(members4.length, 2)
  t.deepEqual(members4.find(m => m.value.user.userId === alice.userId).value.user.dbUrl, alice.profile.dbUrl)
  t.deepEqual(members4.find(m => m.value.user.userId === carla.userId).value.user.dbUrl, carla.profile.dbUrl)
  
  let members5 = await api.communities.listMembers(ppl.userId)
  t.is(members5.length, 0)

  let memberships5 = await api.communities.listMemberships(alice.userId)
  t.is(memberships5.length, 1)
  t.deepEqual(memberships5.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)

  let memberships6 = await api.communities.listMemberships(bob.userId)
  t.is(memberships6.length, 0)

  let memberships7 = await api.communities.listMemberships(carla.userId)
  t.is(memberships7.length, 1)
  t.deepEqual(memberships7.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)
})

test('remote joining & leaving', async t => {
  let sim = new TestFramework()
  instances = [
    await createServer(),
    await createServer()
  ]
  
  const [inst1, inst2] = instances
  await sim.createCitizen(inst1, 'bob')
  await sim.users.bob.login()
  await sim.createCommunity(inst1, 'folks')
  await sim.createCitizen(inst2, 'alice')
  const {alice, folks} = sim.users

  await alice.login()
  await inst2.api.communities.join(folks.userId)

  let members1 = await inst1.api.communities.listMembers(folks.userId)
  t.is(members1.length, 2)
  t.deepEqual(members1.find(m => m.value.user.userId === alice.userId).value.user.dbUrl, alice.profile.dbUrl)

  let memberships1 = await inst2.api.communities.listMemberships(alice.userId)
  t.is(memberships1.length, 1)
  t.deepEqual(memberships1.find(m => m.value.community.userId === folks.userId).value.community.dbUrl, folks.profile.dbUrl)

  await alice.login()
  await inst2.api.communities.leave(folks.userId)

  let members2 = await inst1.api.communities.listMembers(folks.userId)
  t.is(members2.length, 1)

  let memberships2 = await inst2.api.communities.listMemberships(alice.userId)
  t.is(memberships2.length, 0)
})

test('roles', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  instances = [inst]

  await sim.createCitizen(inst, 'alice')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  const {alice, folks} = sim.users

  let roles1 = await api.communities.listRoles(folks.userId)
  t.is(roles1.length, 1)
  t.is(roles1[0].value.roleId, 'moderator')
  t.is(roles1[0].value.permissions.length, 2)
  t.truthy(roles1[0].value.permissions.find(p => p.permId === 'ctzn.network/perm-community-ban'))
  t.truthy(roles1[0].value.permissions.find(p => p.permId === 'ctzn.network/perm-community-remove-post'))

  await alice.login()
  await api.communities.createRole(folks.userId, {
    roleId: 'super-moderator',
    permissions: [
      {permId: 'ctzn.network/perm-community-ban'},
      {permId: 'ctzn.network/perm-community-remove-post'},
      {permId: 'ctzn.network/perm-community-edit-profile'}
    ]
  })
  let roles2 = await api.communities.listRoles(folks.userId)
  t.is(roles2.length, 2)
  let role1 = await api.communities.getRole(folks.userId, 'super-moderator')
  t.is(role1.value.roleId, 'super-moderator')
  t.is(role1.value.permissions.length, 3)
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-ban'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-remove-post'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-edit-profile'))

  await api.communities.assignRoles(folks.userId, alice.userId, ['admin', 'super-moderator'])
  let member1 = await api.communities.getMember(folks.userId, alice.userId)
  t.deepEqual(member1.value.roles, ['admin', 'super-moderator'])

  await api.communities.editRole(folks.userId, 'super-moderator', {
    permissions: [
      {permId: 'ctzn.network/perm-community-edit-profile'}
    ]
  })
  let role2 = await api.communities.getRole(folks.userId, 'super-moderator')
  t.is(role2.value.roleId, 'super-moderator')
  t.is(role2.value.permissions.length, 1)
  t.truthy(role2.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-edit-profile'))

  await api.communities.deleteRole(folks.userId, 'super-moderator')
  let roles3 = await api.communities.listRoles(folks.userId)
  t.is(roles3.length, 1)
  t.is(roles3[0].value.roleId, 'moderator')
  let member2 = await api.communities.getMember(folks.userId, alice.userId)
  t.deepEqual(member2.value.roles, ['admin'])
})

test('permissions', async t => {
  let sim = new TestFramework()
  let inst = await createServer()
  let api = inst.api
  instances = [inst]

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
  await api.communities.createRole(folks.userId, {
    roleId: 'super-moderator',
    permissions: [
      {permId: 'ctzn.network/perm-community-ban'},
      {permId: 'ctzn.network/perm-community-remove-post'},
      {permId: 'ctzn.network/perm-community-edit-profile'},
      {permId: 'ctzn.network/perm-community-manage-roles'},
      {permId: 'ctzn.network/perm-community-assign-roles'}
    ]
  })
  let roles2 = await api.communities.listRoles(folks.userId)
  t.is(roles2.length, 2)
  let role1 = await api.communities.getRole(folks.userId, 'super-moderator')
  t.is(role1.value.roleId, 'super-moderator')
  t.is(role1.value.permissions.length, 5)
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-ban'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-remove-post'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-edit-profile'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-manage-roles'))
  t.truthy(role1.value.permissions.find(p => p.permId === 'ctzn.network/perm-community-assign-roles'))

  await api.communities.assignRoles(folks.userId, bob.userId, ['super-moderator'])
  let member1 = await api.communities.getMember(folks.userId, bob.userId)
  t.deepEqual(member1.value.roles, ['super-moderator'])

  await api.communities.assignRoles(folks.userId, carla.userId, ['moderator'])
  let member2 = await api.communities.getMember(folks.userId, carla.userId)
  t.deepEqual(member2.value.roles, ['moderator'])

  /// ctzn.network/perm-community-edit-profile
  await alice.login()
  await api.communities.editProfile(folks.userId, {displayName: 'Folks 1'})
  t.is((await api.profiles.get(folks.userId)).value.displayName, 'Folks 1')
  await bob.login()
  await api.communities.editProfile(folks.userId, {displayName: 'Folks 2'})
  t.is((await api.profiles.get(folks.userId)).value.displayName, 'Folks 2')
  await carla.login()
  await t.throwsAsync(() => api.communities.editProfile(folks.userId, {displayName: 'Folks 3'}))
  await doug.login()
  await t.throwsAsync(() => api.communities.editProfile(folks.userId, {displayName: 'Folks 3'}))

  /// ctzn.network/perm-community-assign-roles
  await alice.login()
  await api.communities.assignRoles(folks.userId, doug.userId, [])
  await bob.login()
  await api.communities.assignRoles(folks.userId, doug.userId, [])
  await carla.login()
  await t.throwsAsync(() => api.communities.assignRoles(folks.userId, doug.userId, []))
  await doug.login()
  await t.throwsAsync(() => api.communities.assignRoles(folks.userId, doug.userId, []))

  /// ctzn.network/perm-community-manage-roles
  await alice.login()
  await api.communities.createRole(folks.userId, {roleId: 'role1'})
  await bob.login()
  await api.communities.createRole(folks.userId, {roleId: 'role2'})
  await carla.login()
  await t.throwsAsync(() => api.communities.createRole(folks.userId, {roleId: 'role3'}))
  await doug.login()
  await t.throwsAsync(() => api.communities.createRole(folks.userId, {roleId: 'role4'}))

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
  instances = [inst]

  await sim.createCitizen(inst, 'alice')
  await sim.createCitizen(inst, 'bob')
  await sim.users.alice.login()
  await sim.createCommunity(inst, 'folks')
  const {alice, bob, folks} = sim.users
  await bob.login()
  await api.communities.join(folks.userId)

  await alice.login()
  await api.communities.removeMember(folks.userId, bob.userId, {ban: true, banReason: 'Jerk!'})
  t.is((await api.communities.getBan(folks.userId, bob.userId)).value.reason, 'Jerk!')
  t.falsy(await api.communities.getMember(folks.userId, bob.userId))

  await api.communities.putBan(folks.userId, bob.userId, {reason: 'Jerk!!'})
  t.is((await api.communities.getBan(folks.userId, bob.userId)).value.reason, 'Jerk!!')

  await bob.login()
  await t.throwsAsync(() => api.communities.join(folks.userId))

  await alice.login()
  await api.communities.deleteBan(folks.userId, bob.userId)
  t.falsy(await api.communities.getBan(folks.userId, bob.userId))
  await bob.login()
  await api.communities.join(folks.userId)
})