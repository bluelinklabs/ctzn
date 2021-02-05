# Schemas

A list of all schemas and how they're used.

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
- `ctzn.network/vote` A vote up or down on some URL
- `ctzn.network/follow` Record of following another user
- `ctzn.network/community-membership` Record of membership in a community

## Private user db schemas

- `ctzn.network/index-state` Record of indexing states
- `ctzn.network/follow-idx` Index of follows by followed users & self
- `ctzn.network/thread-idx` Index of 'self' reply-posts by followed users & self
- `ctzn.network/vote-idx` Index of votes by followed users & self
- `ctzn.network/notification-idx` Index of notification activity by followed users & self

## Public community db schemas

- `ctzn.network/profile` Record of community info (name, description, etc)
- `ctzn.network/community-member` Record of member users
- `ctzn.network/index-state` Record of indexing states
- `ctzn.network/feed-idx` Index of content in the community feed
- `ctzn.network/follow-idx` Index of follows by community members
- `ctzn.network/thread-idx` Index of community reply-posts by community members
- `ctzn.network/vote-idx` Index of votes by community members
- `ctzn.network/notification-idx` Index of notification activity by community members
