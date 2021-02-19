# Community roles

Community roles are a part of CTZN's permissions systems. Roles can be created in a community and assigned a set of [permissions](./permissions.md). Community members can then be assigned those roles to receive those permissions.

Role IDs can be any arbitrary string, chosen by the community managers.

## Special role: "admin"

The `"admin"` role is a hard-coded and has full permissions over the community. It is assigned by default to the creator of the community.

## Default roles

New communities have the `"moderator"` role created automatically. It is assigned the following permissions by default:

 - `ctzn.network/perm-community-ban`
 - `ctzn.network/perm-community-remove-post`