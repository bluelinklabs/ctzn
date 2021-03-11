# Schemas

A list of all schemas and how they're used.

Schemas may have the following types, specified as the `"type"`:

- `json-table` A table containing stored JSON entries.
- `json-view` A view of JSON data which is generated at runtime.
- `blob-view` A view of binary blobs which is generated at runtime.

Schemas contain the following standard attributes:

- `id` The ID of the schema (e.g. `"ctzn.network/post"`).
- `title` A human-readable title for the schema.
- `description` A human-readable description of the schema.
- `type` A string identifying what type of information the schema represents.
- `definition` An object defining the schema, used when `type` is `"json-table"` or `"json-view"`. In the case of `json-table`, defines the record schema. In the case of `json-view`, defines the schema of a view response. Is a [JSON Schema](https://json-schema.org/).
- `parameters` An object defining call parameters, used when `type` is `"json-view"` or `"blob-view"`. Is a [JSON Schema](https://json-schema.org/).

## Public server db schemas

- `ctzn.network/user` Record of a hosted user or community

## Private server db schemas

- `ctzn.network/account` Internal record of a hosted user
- `ctzn.network/account-session` Internal record of a login session
- `ctzn.network/index-state` Record of indexing states
- `ctzn.network/user-db-idx` Index that maps user db URLs to DNS-IDs

## Public user db schemas

- `ctzn.network/profile` Record of user info (name, description, etc)
- `ctzn.network/post` A single post
- `ctzn.network/comment` A comment on some item
- `ctzn.network/reaction` A reaction-string attached to some URL
- `ctzn.network/follow` Record of following another user
- `ctzn.network/community-membership` Record of membership in a community

## Private user db schemas

- `ctzn.network/index-state` Record of indexing states
- `ctzn.network/follow-idx` Index of follows by followed users & self
- `ctzn.network/thread-idx` Index of 'self' reply-posts by followed users & self
- `ctzn.network/reaction-idx` Index of reactions by followed users & self
- `ctzn.network/notification-idx` Index of notification activity by followed users & self

## Public community db schemas

- `ctzn.network/profile` Record of community info (name, description, etc)
- `ctzn.network/community-member` Record of member users
- `ctzn.network/community-role` Role definition in the community
- `ctzn.network/community-ban` Record of a ban from the community
- `ctzn.network/index-state` Record of indexing states
- `ctzn.network/feed-idx` Index of content in the community feed
- `ctzn.network/follow-idx` Index of follows by community members
- `ctzn.network/thread-idx` Index of community reply-posts by community members
- `ctzn.network/reaction-idx` Index of reactions by community members
- `ctzn.network/notification-idx` Index of notification activity by community members

## View schemas

- `ctzn.network/avatar-view` The avatar image of a given user.
- `ctzn.network/blob-view` A generic binary-blob getter.
- `ctzn.network/comment-view` Get a comment-record.
- `ctzn.network/community-user-permission-view` Get a user's permission in a community.
- `ctzn.network/community-user-permissions-view` Get multiple of a user's permissions in a community.
- `ctzn.network/feed-view` Get the content in a user's feed.
- `ctzn.network/followers-view` Get multiple known followers of a user.
- `ctzn.network/notifications-view` Get notification records of a user.
- `ctzn.network/notifications-cleared-at-view` Get the "notifications cleared at" timestap record of auser.
- `ctzn.network/notifications-count-view` Count the notification records of a user.
- `ctzn.network/post-view` Get a post-record.
- `ctzn.network/posts-view` Get multiple post-records for a user.
- `ctzn.network/profile-view` Get the profile-record of a user.
- `ctzn.network/reactions-to-view` Get the reaction-records for a given subject.
- `ctzn.network/thread-view` Get a post-record and any relevant comment records.