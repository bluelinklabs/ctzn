import communityDeleteBan from './dbmethods/community-delete-ban.js'
import communityDeleteRole from './dbmethods/community-delete-role.js'
import communityRemoveContent from './dbmethods/community-remove-content.js'
import communityRemoveMember from './dbmethods/community-remove-member.js'
import communitySetMemberRoles from './dbmethods/community-set-member-roles.js'
import communityPutBan from './dbmethods/community-put-ban.js'
import communityPutRole from './dbmethods/community-put-role.js'
import createItem from './dbmethods/create-item.js'
import deleteItemClass from './dbmethods/delete-item-class.js'
import destroyItem from './dbmethods/destroy-item.js'
import ping from './dbmethods/ping.js'
import putAvatar from './dbmethods/put-avatar.js'
import putItemClass from './dbmethods/put-item-class.js'
import putProfile from './dbmethods/put-profile.js'
import transferItem from './dbmethods/transfer-item.js'

const dbmethods = {
  'community-delete-ban': communityDeleteBan,
  'community-delete-role': communityDeleteRole,
  'community-remove-content': communityRemoveContent,
  'community-remove-member': communityRemoveMember,
  'community-set-member-roles': communitySetMemberRoles,
  'community-put-ban': communityPutBan,
  'community-put-role': communityPutRole,
  'create-item': createItem,
  'delete-item-class': deleteItemClass,
  'destroy-item': destroyItem,
  'ping': ping,
  'put-avatar': putAvatar,
  'put-item-class': putItemClass,
  'put-profile': putProfile,
  'transfer-item': transferItem
}
export default dbmethods