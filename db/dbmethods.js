import communityDeleteBan from './dbmethods/community-delete-ban.js'
import communityDeleteRole from './dbmethods/community-delete-role.js'
import communityInviteMember from './dbmethods/community-invite-member.js'
import communityPutBan from './dbmethods/community-put-ban.js'
import communityPutRole from './dbmethods/community-put-role.js'
import communityRemoveContent from './dbmethods/community-remove-content.js'
import communityRemoveMember from './dbmethods/community-remove-member.js'
import communitySetMemberRoles from './dbmethods/community-set-member-roles.js'
import communityUpdateConfig from './dbmethods/community-update-config.js'
import createItem from './dbmethods/create-item.js'
import createItemClass from './dbmethods/create-item-class.js'
import deleteItemClass from './dbmethods/delete-item-class.js'
import deletePage from './dbmethods/delete-page.js'
import destroyItem from './dbmethods/destroy-item.js'
import ping from './dbmethods/ping.js'
import putAvatar from './dbmethods/put-avatar.js'
import putBlob from './dbmethods/put-blob.js'
import putPage from './dbmethods/put-page.js'
import updateItemClass from './dbmethods/update-item-class.js'
import putProfile from './dbmethods/put-profile.js'
import transferItem from './dbmethods/transfer-item.js'

const dbmethods = {
  'community-delete-ban': communityDeleteBan,
  'community-delete-role': communityDeleteRole,
  'community-invite-member': communityInviteMember,
  'community-put-ban': communityPutBan,
  'community-put-role': communityPutRole,
  'community-remove-content': communityRemoveContent,
  'community-remove-member': communityRemoveMember,
  'community-set-member-roles': communitySetMemberRoles,
  'community-update-config': communityUpdateConfig,
  'create-item': createItem,
  'create-item-class': createItemClass,
  'delete-item-class': deleteItemClass,
  'delete-page': deletePage,
  'destroy-item': destroyItem,
  'ping': ping,
  'put-avatar': putAvatar,
  'put-blob': putBlob,
  'put-page': putPage,
  'put-profile': putProfile,
  'transfer-item': transferItem,
  'update-item-class': updateItemClass
}
export default dbmethods