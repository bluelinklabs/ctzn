# CTZN

A hybrid p2p/federated social network mad science experiment. WIP.

Twitter-style feed and posts. Users follow each other, post to their own p2p databases, and servers aggregate their community's data to provide large-scale indexes in their own p2p databases.

## Architecture

Uses [Hypercore Protocol](https://hypercore-protocol.org) to store userdata and sync between nodes.
The data layout is:

- Public Server Database (Hyperbee): user registry, indexes
- Private Server Database (Hyperbee): user account info (email addresses)
- User Databases (Hyperbee): profile info, posts, media, votes

Within the Hyperbees, "tables" are declared using the URLs of JSON schemas.
The table schemas are fetched by the servers and used to apply strict validation of data.
This causes the federated/p2p network to have a consensus on data schemas.

The Hyperbee key/value layout:

```
tables|_schemas|{schemaurl} = TableDef
tables|{tableid}|*

TableDef = {
  id: Number
}
```

For example:

```
tables|_schemas|https://ctzn.com/post.json = {id: 1}
tables|_schemas|https://ctzn.com/post-attachments.json = {id: 2}
tables|_schemas|https://ctzn.com/like.json = {id: 3}
tables|1|1 = {...}
tables|1|2 = {...}
tables|1|3 = {...}
tables|2|1 = {...}
```

In the internal API, the tables are loaded using an API that looks like:

```js
const posts = userDb.getTable('ctzn.com/post')
await posts.get(1) // => {...}
```