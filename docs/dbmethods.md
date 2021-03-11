# Database methods

Database methods are functions which are invoked using the databases. A method call is written to a `ctzn.network/method-call` record and then synced by the intended recipient, who handles the method call and writes the result as a `ctzn.network/method-result` record.

Methods are identified using schemas, as listed in this document.

## `ctzn.network/ping-method`

A method which responds with an argument. Used for testing.