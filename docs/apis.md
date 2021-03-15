## HTTP

HTTP endpoints on the server.

### `GET /.table/:databaseId/:tableSchemaNs/:tableSchemaName`

TODO

### `GET /.table/:databaseId/:tableSchemaNs/:tableSchemaName/:key`

TODO

### `GET /.view/:tableSchemaNs/:tableSchemaName/:params...`

TODO

## Websocket RPC

A JSON-RPC API hosted at the HTTP root of the server.

### table

Tables store JSON documents in a database.

#### `table.list(databaseId, tableSchemaId, [opts])`

TODO

#### `table.get(databaseId, tableSchemaId, key)`

TODO

#### `table.create(databaseId, tableSchemaId, value)`

TODO

#### `table.update(databaseId, tableSchemaId, key, value)`

TODO

#### `table.delete(databaseId, tableSchemaId, key)`

TODO

### view

Views are server-generated JSON documents.

#### `view.get(viewSchemaId, [...args])`

TODO

### blob

Blobs are binary buffers stored in a database.

#### `blob.get(databaseId, key)`

TODO

#### `blob.create(base64buf)`

TODO

#### `blob.update(key, base64buf)`

TODO

#### `blob.delete(key)`

TODO

### dbmethod

Methods are database functions which are invoked by publishing "method-call" records. Their results are written as "method-result" records.

Methods are used to execute calls over a distributed network, for instance to make changes to a community database which is hosted on a separate server from the acting user.

#### `dbmethod.call({database, method, args, wait, timeout})`

TODO

#### `dbmethod.getResult({call, wait, timeout})`

TODO