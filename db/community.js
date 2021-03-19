import { BaseHyperbeeDB } from './base.js'

export class PublicCommunityDB extends BaseHyperbeeDB {
  constructor (userId, key) {
    super(`public:${userId}`, key)
    this.userId = userId
  }

  get dbType () {
    return 'ctzn.network/public-community-db'
  }

  get supportedMethods () {
    return [
      'community-delete-ban',
      'community-delete-role',
      'community-remove-content',
      'community-remove-member',
      'community-set-member-roles',
      'community-put-ban',
      'community-put-role',
      'create-item',
      'delete-item-class',
      'destroy-item',
      'ping',
      'put-avatar',
      'put-item-class',
      'put-profile',
      'transfer-item'
    ]
  }

  async setup () {
    await super.setup()
    await this.blobs.setup()
    this.profile = this.getTable('ctzn.network/profile')
    this.members = this.getTable('ctzn.network/community-member')
    this.roles = this.getTable('ctzn.network/community-role')
    this.bans = this.getTable('ctzn.network/community-ban')
    this.itemClasses = this.getTable('ctzn.network/item-class')
    this.items = this.getTable('ctzn.network/item')

    this.members.onPut(() => this.emit('subscriptions-changed'))
    this.members.onDel(() => this.emit('subscriptions-changed'))
  }
}