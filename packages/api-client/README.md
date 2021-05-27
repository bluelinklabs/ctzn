# CTZN API Client

In nodeJS:

```
npm i @bluelinklabs/ctzn-api-client
```

Then

```js
import { create } from '@bluelinklabs/ctzn-api-client'
const api = create()
```

In the browser with ESM, copy `ctzn-api-client.build.js` into your project and then:

```js
import { create } from '/vendor/ctzn-api-client.build.js'
const api = create()
```

## Table of contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [API Reference](#api-reference)
  - [Getters](#getters)
    - [`api.getProfile(dbId)`](#apigetprofiledbid)
    - [`api.listUserFeed(dbId[, opts])`](#apilistuserfeeddbid-opts)
    - [`api.getPost(dbId, postKey)`](#apigetpostdbid-postkey)
    - [`api.getComment(dbId, commentKey)`](#apigetcommentdbid-commentkey)
    - [`api.getThread(dbUrl)`](#apigetthreaddburl)
    - [`api.listFollowers(dbId)`](#apilistfollowersdbid)
  - [Views and methods](#views-and-methods)
    - [`api.method(path[, params])`](#apimethodpath-params)
    - [`api.view.get(path[, params])`](#apiviewgetpath-params)
  - [Tables](#tables)
    - [`api.db(dbId).table(schemaId).list([opts])`](#apidbdbidtableschemaidlistopts)
    - [`api.table.list(dbId, schemaId[, opts])`](#apitablelistdbid-schemaid-opts)
    - [`api.db(dbId).table(schemaId).get(key)`](#apidbdbidtableschemaidgetkey)
    - [`api.table.get(dbId, schemaId, key)`](#apitablegetdbid-schemaid-key)
    - [`api.db(dbId).table(schemaId).create(value)`](#apidbdbidtableschemaidcreatevalue)
    - [`api.table.create(dbId, schemaId, value)`](#apitablecreatedbid-schemaid-value)
    - [`api.db(dbId).table(schemaId).createWithBlobs(value, blobs)`](#apidbdbidtableschemaidcreatewithblobsvalue-blobs)
    - [`api.table.createWithBlobs(dbId, schemaId, value, blobs)`](#apitablecreatewithblobsdbid-schemaid-value-blobs)
    - [`api.db(dbId).table(schemaId).update(key, value)`](#apidbdbidtableschemaidupdatekey-value)
    - [`api.table.update(dbId, schemaId, key, value)`](#apitableupdatedbid-schemaid-key-value)
    - [`api.db(dbId).table(schemaId).delete(key)`](#apidbdbidtableschemaiddeletekey)
    - [`api.table.delete(dbId, schemaId, key)`](#apitabledeletedbid-schemaid-key)
    - [`api.db(dbId).table(schemaId).getBlob(key, blobName)`](#apidbdbidtableschemaidgetblobkey-blobname)
    - [`api.table.getBlob(dbId, schemaId, key, blobName)`](#apitablegetblobdbid-schemaid-key-blobname)
    - [`api.db(dbId).table(schemaId).putBlob(key, blobName, buf, mimeType)`](#apidbdbidtableschemaidputblobkey-blobname-buf-mimetype)
    - [`api.table.putBlob(dbId, schemaId, key, blobName, buf, mimeType)`](#apitableputblobdbid-schemaid-key-blobname-buf-mimetype)
    - [`api.db(dbId).table(schemaId).delBlob(key, blobName)`](#apidbdbidtableschemaiddelblobkey-blobname)
    - [`api.table.delBlob(dbId, schemaId, key, blobName)`](#apitabledelblobdbid-schemaid-key-blobname)
  - [Session](#session)
    - [`api.user`](#apiuser)
    - [`api.session.info`](#apisessioninfo)
    - [`api.session.isActive()`](#apisessionisactive)
    - [`api.session.onChange(cb)`](#apisessiononchangecb)
    - [`api.session.setup()`](#apisessionsetup)
    - [`api.session.login({username, password})`](#apisessionloginusername-password)
    - [`api.session.logout()`](#apisessionlogout)
    - [`api.session.signup({username, displayName, description, email, password})`](#apisessionsignupusername-displayname-description-email-password)
    - [`api.session.requestPasswordChangeCode({username})`](#apisessionrequestpasswordchangecodeusername)
    - [`api.session.changePassword({username, code, newPassword})`](#apisessionchangepasswordusername-code-newpassword)
  - [Utility](#utility)
    - [`api.get(path[, query])`](#apigetpath-query)
    - [`api.getBuf(path[, query])`](#apigetbufpath-query)
    - [`api.post(path, body)`](#apipostpath-body)
    - [`api.postMultipart(path, parts)`](#apipostmultipartpath-parts)
    - [`api.put(path, body)`](#apiputpath-body)
    - [`api.putBuf(path, body, mimeType)`](#apiputbufpath-body-mimetype)
    - [`api.delete(path)`](#apideletepath)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## API Reference

All methods are async unless specified otherwise.

### Getters

#### `api.getProfile(dbId)`

- `dbId` String.
- Returns object.

#### `api.listUserFeed(dbId[, opts])`

- `dbId` String.
- `opts` Optional object.
- Returns object.

#### `api.getPost(dbId, postKey)`

- `dbId` String.
- `postKey` String.
- Returns object.

#### `api.getComment(dbId, commentKey)`

- `dbId` String.
- `commentKey` String.
- Returns object.

#### `api.getThread(dbUrl)`

- `dbUrl` String.
- Returns object.

#### `api.listFollowers(dbId)`

- `dbId` String.
- Returns object.

### Views and methods

#### `api.method(path[, params])`

- `path` String.
- `params` Optional object.
- Returns an object.

#### `api.view.get(path[, params])`

- `path` String.
- `params` Optional object.
- Returns an object.

### Tables

#### `api.db(dbId).table(schemaId).list([opts])`
#### `api.table.list(dbId, schemaId[, opts])`

- `dbId` String.
- `schemaId` String.
- `opts` Optional object.
- Returns an object.

#### `api.db(dbId).table(schemaId).get(key)`
#### `api.table.get(dbId, schemaId, key)`

- `dbId` String.
- `schemaId` String.
- `key` String.
- Returns an object.

#### `api.db(dbId).table(schemaId).create(value)`
#### `api.table.create(dbId, schemaId, value)`

- `dbId` String.
- `schemaId` String.
- `value` Object.
- Returns an object.

#### `api.db(dbId).table(schemaId).createWithBlobs(value, blobs)`
#### `api.table.createWithBlobs(dbId, schemaId, value, blobs)`

- `dbId` String.
- `schemaId` String.
- `value` Object.
- `blobs` Object. A map of blobnames to objects with the following attributes:
  - `base64buf` Optional String. Must specify this or `blob`.
  - `blob` Optional Blob. Must specify this or `base64buf`.
  - `mimeType` String.
- Returns an object.

#### `api.db(dbId).table(schemaId).update(key, value)`
#### `api.table.update(dbId, schemaId, key, value)`

- `dbId` String.
- `schemaId` String.
- `key` String.
- `value` Object.
- Returns an object.

#### `api.db(dbId).table(schemaId).delete(key)`
#### `api.table.delete(dbId, schemaId, key)`

- `dbId` String.
- `schemaId` String.
- `key` String.
- Returns an object.

#### `api.db(dbId).table(schemaId).getBlob(key, blobName)`
#### `api.table.getBlob(dbId, schemaId, key, blobName)`

- `dbId` String.
- `schemaId` String.
- `key` String.
- `blobName` String.
- Returns an ArrayBuffer.

#### `api.db(dbId).table(schemaId).putBlob(key, blobName, buf, mimeType)`
#### `api.table.putBlob(dbId, schemaId, key, blobName, buf, mimeType)`

- `dbId` String.
- `schemaId` String.
- `key` String.
- `blobName` String.
- `buf` String or ArrayBuffer. If a string, must be base64-encoded.
- `mimeType` String.
- Returns an object.

#### `api.db(dbId).table(schemaId).delBlob(key, blobName)`
#### `api.table.delBlob(dbId, schemaId, key, blobName)`

- `dbId` String.
- `schemaId` String.
- `key` String.
- `blobName` String.
- Returns an object.

### Session

#### `api.user`

An alias to `api.db(api.session.info.dbKey)`

#### `api.session.info`

The current session's information. Contains:

- `hasSession` Boolean.
- `url` String.
- `dbKey` String.
- `username` String.

#### `api.session.isActive()`

- Returns boolean.

#### `api.session.onChange(cb)`

Calls `cb` any time the current session changes (login / logout).

- `cb` Function.

#### `api.session.setup()`

Sets up the current session. Must be called before accessing any of the `api.session` api.

#### `api.session.login({username, password})`

- `username` String.
- `password` String.
- Returns object.

#### `api.session.logout()`

- Returns object.

#### `api.session.signup({username, displayName, description, email, password})`

- `email` String.
- `username` String.
- `password` String.
- `displayName` String.
- `description` String.
- Returns object.

#### `api.session.requestPasswordChangeCode({username})`

- `username` String.
- Returns object.

#### `api.session.changePassword({username, code, newPassword})`

- `username` String.
- `code` String.
- `newPassword` String.
- Returns object.

### Utility

#### `api.get(path[, query])`

- `path` String.
- `query` Optional object.
- Returns an object.

#### `api.getBuf(path[, query])`

- `path` String.
- `query` Optional object.
- Returns an ArrayBuffer.

#### `api.post(path, body)`

- `path` String.
- `body` Object.
- Returns an object.

#### `api.postMultipart(path, parts)`

- `path` String.
- `parts`. Object. An object mapping keys to `Blob`s.
- Returns an object.

#### `api.put(path, body)`

- `path` String.
- `body` Object.
- Returns an object.

#### `api.putBuf(path, body, mimeType)`

- `path` String.
- `body` ArrayBuffer.
- `mimeType` String.
- Returns an object.

#### `api.delete(path)`

- `path` String.

