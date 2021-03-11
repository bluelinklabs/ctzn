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
- `keyTemplate` An array defining how to generate keys in the table, used when `type` is `"json-table"`. See "Key Templates" below.
- `definition` An object defining the schema, used when `type` is `"json-table"` or `"json-view"`. In the case of `json-table`, defines the record schema. In the case of `json-view`, defines the schema of a view response. Is a [JSON Schema](https://json-schema.org/).
- `parameters` An object defining call parameters, used when `type` is `"json-view"` or `"blob-view"`. Is a [JSON Schema](https://json-schema.org/).

## Key templates

Key templates are used to automatically generate the keys in a table. They are an array of objects. If the array has multiple items, they represent segments which are concatenated together (useful for generating compound keys).

Here are some example key templates:

```js
[{"type": "auto"}] // an auto-generated key
[{"type": "json-pointer", "value": "/username"}] // a key generated from the record data
[{"type": "string", "value": "profile"}] // a fixed-string key

// a compound key generated from the record data:
[
  {"type": "json-pointer", "value": "/username"},
  {"type": "string", "value": ":"},
  {"type": "json-pointer", "value": "/pagename"}
]
```

The objects in a key template fit the following shape:

- `type` The type of template segment. Must be one of:
  - `"auto"` An auto-generated string which is guaranteed to monotonically increase.
  - `"json-pointer"` A json-pointer which references a value in the data. Must resolve to a literal (string, number, boolean) and not an object or array.
  - `"string"` A fixed string value.
- `value` The value of the segment, depending on the type.
  - When `type = json-pointer`, a json-pointer to the record attribute which will be used as the key.
  - When `type = string`, a string which will always be inserted in that segment.

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