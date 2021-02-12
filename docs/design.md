# Design

## Technical architecture

### Data mesh

CTZN requires a "data mesh" to provide globally-accessible databases. It currently uses the [Hypercore Protocol](https://hypercore-protocol.org) but other data networks such as [IPFS](https://ipfs.io) could satisfy this requirement. The [Hyperbee](https://npm.im/hyperbee) Key-Value Database is the most frequently-used structure at present.

The mesh uses public-key cryptography to address databases. The pubkeys represent agency in the mesh, much like server origins represent agency in the Web.

All users have first-class identities in the mesh because any device can generate pubkeys and their databases -- not just publicly-reachable servers.

The mesh is extremely cache-friendly. All information is signed and can be redistributed trustlessly by peers. This ensures the network can scale while maintaining agency; users sign their data, retain key ownership, and then sync the dataset to caching peers which can handle heavier traffic.

The mesh uses "pull-based" transmission. Software identifies which databases to sync and then will watch the databases for updates to their records. As a result, aggregated indexes act as the basis of communication.

To give a trivial example, 3 user databases which post shortform blogs could be aggregated into a "feed database" which represents their 3-person community's posts; the 3 users would reference the feed db to see their community activity. The production of shared indexes therefore determines participation in a shared space.

### Identity and re-homing

All databases possess a public-key ID and may optionally declare a DNS-based ID. DNS-IDs take the form of "username@domain" and can be resolved by contacting the server at "domain."

All records are identified by public-key URLs. This means that links are not changed by DNS-ID changes.

Databases can "rehome" (change their DNS-ID) by declaring a new ID in their dataset and updating the server records which map the DNS-ID to their database. Pubkey-rotation is solved by a similar process; a new database (and new pubkey) are minted and the DNS-ID records are mapped to the new database. The new database declares itself as a "resumption" of the old database, thereby maintaining old records at their previous URLs while producing new records under the new pubkey URL.

Rehoming is easily detected by followers of a database and can be validated by ensuring the database and DNS records agree. Once they are found to agree, followers can update their local records to the new identifiers.

### Data schemas

CTZN relies on machine-readable database schemas which are addressed by URLs. These schemas are automatically enforced by the software in order to maintain compatibility across the network.

Within Hyperbees, the schema URLs act as the identifiers for datasets. Therefore a given user's comment (id=1) might be addressed by the following pseudo-code:

```js
userDb.getTable('ctzn.network/comment').get(1)
```

Which maps to the following hyper-url:

```
hyper://1234..af/ctzn.network/comment/1
```

Schemas can be seen as major determinants of applications; support of a specific schema determines the nature of an application. The strict schema model ensures clarity in the dataset while also providing extensibility by creating new schemas with new URLs.

### Applications model

Applications interact with the data-mesh to provide new UIs and new PXs.

CTZN's use of the data mesh means that access to the network can be provided by Web, desktop, or mobile applications. The only requirement is that the application can access the data mesh (Hypercore Protocol).

Database signing keys may be held by user devices or by "hosting servers." Since servers can be accessed remotely via the Web, they provide a convenient solution to key-hosting. The user can migrate to a new key-host by using the key-rotation process.

CTZN uses JSON-RPC over WebSockets for RPC.

Whenever possible, applications are encouraged to access datasets using Hypercore rather than via RPC requests to other nodes. This ensures the network will take advantage of the scaling properties of the Hypercore Protocol. An exception to this rule is the API for write-access, which is required when the user's keys are held in a hosting server.

## Core schema

CTZN's core schema is still under development but will include table-definitions and flows for:

- User accounts
- Social following
- Short-form posts and comments
- Content voting
- Notifications
- Community aggregation

## Political architecture

Our goal is to establish trust in authority when it must be given. Our tools for gaining that trust is distributed & contingent authority ("Authority model") and constrained powers of authority ("Constitutional networks").

### Authority model

CTZN's authority model has two primitives:

 1. **DNS ownership** - provides the ability to map domains and DNS-IDs to pubkeys.
 2. **Pubkey ownership** - provides the ability to modify a given database.

These primitives are used to create PX spaces. Consider the following example:

|Element|Impact|
|-|-|
|`example.com` maps to the `example` database's pubkey|Establishes the example.com community's database.|
|`example` declares the usage of `ctzn.network` schemas|Establishes the example.com community's core application.|
|`example` declares 3 user records -- `alice@example.com`, `bob@example.com`, and `carla@example.com` -- and their database pubkeys.|Establishes the example.com community's membership.|
|`alice`, `bob`, and `carla` databases declare profile and post records.|Establishes the content of the example.com network.|
|`example` database declares a secondary index of the latest posts.|Establishes the timeline of the example.com community activity.|

We can infer a few things from this example:

- There is a hierarchy of identity, from DNS -> server database -> user databases
- User databases maintain their own profile/post records and can be accessed independently of the `example.com` community.
- The `example.com` database maintains community information only, including secondary indexes which represent a current "view" of the activity.
- As records are linked by their pubkey-URL, there is no hard binding to the example server.

Because of this separation of authority, the members of `example.com` maintain the freedom to migrate their content away from the example community without any disruption to the network. This migration would be similar to "forking" a codebase -- the content would remain but the community authority would be modified.

This interplay between community authority and individual authority is a repeatable PX pattern. By maintaining individual rights to migrate away from a community, the community maintainers' authority is contingent on the members' satisfaction with their leadership.

### Constitutional networks

A future goal for the Hypercore Protocol is a toolset for "smart contracts" - code which has externally-auditable execution. Once CTZN's data-mesh supports smart contracts, it will integrate the contracts in the PX patterns to create community "constitutions."

Using constitutions, communities can define a strict ruleset by which community-members can exercise authority. These constitutions will establish rules for:

- Identity registries
- Content and user moderation
- Discovery and content-ranking

And so on.

Smart-contract constitutions create both transparency and constraints. Moderators will not be able to modify the community datasets without following the contract rules, and every action will be placed in an auditable log.

Constitutions will provide members of large-scale communities an assurance over how their community will be governed. Rather than trusting the moderators to follow a declared process, the community can legislate the constitution to establish how moderators will govern.