import { BaseHyperbeeDB } from './base.js'

export class PublicCommunityDB extends BaseHyperbeeDB {
  constructor (userId, key, extensions) {
    super(`public:${userId}`, key)
    this.userId = userId
    this.extensions = extensions
  }

  get dbType () {
    return 'ctzn.network/public-community-db'
  }

  get supportedMethods () {
    return [
      'community-delete-ban',
      'community-delete-role',
      'community-invite-member',
      'community-put-ban',
      'community-put-role',
      'community-remove-content',
      'community-remove-member',
      'community-set-member-roles',
      'community-update-config',
      'create-item',
      'create-item-class',
      'delete-item-class',
      'destroy-item',
      'ping',
      'put-avatar',
      'put-blob',
      'put-profile',
      'transfer-item',
      'update-item-class'
    ]
  }

  async setup () {
    await super.setup()
    await this.blobs.setup()
    this.profile = this.getTable('ctzn.network/profile')
    this.communityConfig = this.getTable('ctzn.network/community-config')
    this.members = this.getTable('ctzn.network/community-member')
    this.roles = this.getTable('ctzn.network/community-role')
    this.invites = this.getTable('ctzn.network/community-invite')
    this.bans = this.getTable('ctzn.network/community-ban')
    this.itemClasses = this.getTable('ctzn.network/item-class')
    this.items = this.getTable('ctzn.network/item')

    this.members.onPut(() => this.emit('subscriptions-changed'))
    this.members.onDel(() => this.emit('subscriptions-changed'))

    if (this.extensions) {
      const publicCommunityDbExtensions = Array.from(this.extensions).map((extension) => extension.default.publicCommunityDbExtensions).flat().filter(Boolean)
      for (let extension of publicCommunityDbExtensions) {
        extension.setup(this)
      }
    }
  }
}
