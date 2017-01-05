# Landlord

A common problem with document databases that rely on key-value data stores is how to handle the situation where a document is the composite of multiple entries.  Ensuring all keys get added without collision, and rolling back when a failure occurs, can add a significant amount of complexity.  Landlord manages this complexity for you.

__Contents__

  * [Usage](#usage)
  * [API](#api)
    + [Class: `Landlord`](#class-landlord)
    + [Class: `Lease`](#class-lease)
    + [Errors](#errors)
  * [Stores](#stores)
    + [Promisified Methods](#promisified-methods)
    + [Implementations](#implementations)
  * [Limitations](#limitations)
    + [Atomicity](#atomicity)
    + [Inserts](#inserts)

## Usage

Add `landlord` as a dependency in `package.json`:

```sh
$ npm install landlord -S
```

Then create instances of `Landlord` to issue `Lease` instances on the entries you wish to insert.

```js
const Landlord = require('landlord');
const Store = require('landlord-my-impl');

const landlord = new Landlord({
  store: new Store()
});

const createUser = function(user, credentials, callback) {
  const docs = new Map();

  docs.set(user.id, user);
  docs.set(user.email, credentials);

  landlord.lease(docs, (err, lease) => {
    if (err) {
      /*
        This is likely the result of a key collision, in which case err will be
        an instance of Landlord.errors.CollisionError.
      */
      callback(err);
      return;
    }

    lease.confirm((e, result) => {
      callback(null, { message: 'User created!' });
    });
  });
};
```

## API

### Class: `Landlord`

The primary interface to the `landlord` module.  The `Landlord` class is responsible for issuing leases on keys that need to be inserted into the document store.

  * `new Landlord(options)` the constructor for the `Landlord` class.

    _Parameters_

      + `options`: _(required)_ an object used to control `Landlord`'s behavior, and can have the following keys:

        - `store`: _(required)_ the backing store that documents are inserted into.  See ["Stores"](#stores) for more information.

        - `ttl`: _(optional)_ the time-to-live value in milliseconds to assign to documents when they are initially inserted.  This is to ensure documents are not left as cruft in the data store in the event of a failure.  The default value is `5000`.

  * __Properties__

    + `Landlord.errors`: an object containing references to the custom errors thrown by `Landlord`.  See [Errors](#errors) for more information.

  * __Methods__

    + `Landlord.prototype.lease(docs [, callback])`: creates a lease for given documents.  A lease reserves the keys for each provided document in the data store.

      If no `callback` is provided, this method returns a `Promise` that resolves with the instance of `Lease`; otherwise, `undefined` is returned.

      _Parameters_

        - `docs`: _(required)_ an object or `Map` where each key is a key you need to add to the lease, and the value is the contents of the document.

        - `callback`: _(optional)_ a standard Node.js callback where the resolved value is an instance of `Lease`.

### Class: `Lease`

Represents a set of documents who's keys have been reserved in a key-value data store.  A lease must be confirmed to make the reserved keys permanent.

  * __Properties__

    +  `Lease.prototype.documents`: gets a `Map` of documents reserved by the `Lease`, where each key is a key reserved in the data store, and the value is an object with the following keys:

      - `etag`: a string value of any version information returned from the store.  This value is not guaranteed to be set until after the lease has been confirmed.

      - `value`: the document contents.

    + `Lease.prototype.isCancelled`: gets a `Boolean` indicating whether or not the `Lease` has been cancelled.

    + `Lease.prototype.isConfirmed`: gets a `Boolean` indicating whether or not the `Lease` has been confirmed.

    + `Lease.prototype.isExpired`: gets a `Boolean` indicating whether or not the `Lease` has expired.  The `Lease` class relies on the underlying data store to determine if the lease is expired, and this value will only be set to `true` after a failed confirmation attempt.

  * __Methods__

    + `Lease.prototype.cancel([callback])`: cancels the lease, and immediately removes all reserved entries.  Once a lease has been cancelled it cannot later be confirmed.  If the lease has expired a cancellation has no effect, and no error is thrown.

      If no `callback` is provided, this method returns a `Promise` that resolves with the instance of `Lease`; otherwise, `undefined` is returned.

      _Parameters_

        - `callback`: _(optional)_ a standard Node.js callback where the resolved value is the `Lease` instance.

    + `Lease.prototype.confirm([callback])`: removes all expirations on reserved entries, and ensures they are permanent.  If the removal of any expiration fails, all entries that are a part of the lease are immediately removed, and the lease goes into an expired state.  If the lease has already been cancelled, the `confirm()` method fails.

      If no `callback` is provided, this method returns a `Promise` that resolves with the instance of `Lease`; otherwise, `undefined` is returned.

      _Parameters_

        - `callback`: _(optional)_ a standard Node.js callback where the resolved value is the `Lease` instance.

### Errors

The `landlord` module uses a number of custom errors.  All errors extend from the native `Error` object.

#### Class: `CollisionError`

Thrown when a key for a document provided to the `lease()` method collides with a key that already exists in the data store.

  * __Properties__

    + `keys`: an array of keys that failed to insert.

#### Class: `ExpiredError`

Thrown when a lease is confirmed after the reservation has expired.

#### Class: `CancelledError`

Thrown when a cancellation or confirmation is attempted on a lease that has already been cancelled.

#### Class: `ConfirmedError`

Thrown when a cancellation or confirmation is attempted on a lease that has already been confirmed.

#### Class: `StoreError`

Thrown when `Landlord`'s internal data store throws a catastrophic error.  This is intended to provide a generalized error type to catch.  Custom properties include:

  * __Properties__

    + `internal`: the error thrown by the underlying data store.

## Stores

A store is where documents added to a lease are persisted.  An instance of a store must have the following members:

  * `insert(docs, options, callback)`: performs an insert operation that will fail for any document who's key already exist in the store.  Parameters:

    + `docs`: _(required)_ a `Map` where each key is a key you wish to add to the lease, and the value is the contents of the document.

    + `options`: _(required)_ an object with the following keys:

      - `ttl`: _(required)_ an integer that specifies the time-to-live (in milliseconds) for each inserted entry.

    + `callback`: _(required)_ a standard Node.js callback function with the following parameters:

      - `err`: _(required)_ an internal, catastrophic error that has occurred, otherwise `null` or `undefined`.  A single failed insert should not result in this parameter having a value.

      - `result`: _(optional)_ a `Map` containing all of the keys originally provided by `docs`.  This argument is required if `err` is empty.  Each value is an object that summarizes the result of the insert operation, and contains the following keys:

        - `etag`: _(optional)_ a string that contains the version value for the inserted document.

        - `success`: _(required)_ a `Boolean` indicating whether or not the insert operation was successful.

        - `isCollision`: _(required)_ a `Boolean` indicating whether or not the insert failed as a result of a key collision.

        - `err`: _(optional)_ an error that occurred as a result of a failed insert.  This is only needed if the failure was not the result of a key collision.

  * `remove(keys, callback)`: performs a remove operation, which should succeed regardless if the key exists in the store or not.  Parameters:

    + `keys`: _(required)_ an array or `Set` of keys to remove.

    + `callback`: _(required)_ a standard Node.js callback function with the following parameters:

      - `err`: _(required)_ an internal, catastrophic error that has occurred, otherwise `null` or `undefined`.  A single failed remove operation should not result in this parameter having a value.

      - `result`: _(optional)_ an object that summarizes the remove operation.  The object should have the following keys:

        - `succeeded`: _(required)_ an array of keys that were successfully removed.  If a key did not exist when the remove was attempted, it should be counted as succeeded.

        - `failed`: _(required)_ an array of keys that were not removed, and remain in the store.

  * `touch(keys, options, callback)`: extends the time-to-live for the provided keys.  Parameters:

    + `keys`: _(required)_ an array or `Set` of keys to remove.

    + `options`: _(required)_ an object used to control the behavior the touch operation.  The object can have the following keys:

      - `ttl`: _(required)_ an integer value indicating the time-to-live (in milliseconds) for each entry specified by the `keys` argument.  If this value is `0`, the TTL is removed, and the entry will live indefinitely.

    + `callback`: _(required)_ a standard Node.js callback function with the following parameters:

      - `err`: _(required)_ an internal, catastrophic error that has occurred, otherwise `null` or `undefined`.  A single failed touch operation should not result in this parameter having a value.

      - `result`: _(optional)_ a `Map` containing all of the keys originally provided by `keys`.  This argument is required if `err` is empty.  Each value is an object that summarizes the result of the touch operation, and contains the following keys:

        - `etag`: _(optional)_ a string that contains the version value for the inserted document.

        - `success`: _(required)_ a `Boolean` indicating whether or not the insert operation was successful.

        - `isMissing`: _(required)_ a `Boolean` indicating whether or not a failure was the result of a missing key.  If this value is `true`, then the associated lease will enter into an expired state.

        - `err`: _(optional)_ an error that occurred as a result of a failed insert.  This is only needed if the failure was not the result of a missing key.

### Promisified Methods

Store implementations can also provide `*Async()` versions of each method listed above; which, return a `Promise` instead of accepting a `callback` function as an argument.  If a store implementation does not contain an `*Async()` function for each method above, missing functions will automatically be added, through promisification, to the store by `Landord`.

### Implementations

The following are known `landlord` store implementations. _If you've created one not listed here, please add it to the README.md file via pull request in the [GitHub project](https://github.com/dsfields/landlord)._

  * [`landlord-couchbase`](https://www.npmjs.com/package/landlord-couchbase)

## Limitations

There are a couple of limitations that implementers should keep in mind while using `landlord`.

### Atomicity

The `landlord` module cannot provide true transactional atomicity of multiple entries, as, this is a feature that typically must be supported by a database engine.  While `landlord` utilizes a number of safeguards to prevent errant data from being persisted, it is not a guarantee.

For example, in the event of a catastrophic failure of a `landlord`-powered application in the middle of a confirmation operation, it's possible only a subset of documents on a lease will be permanently persisted.

For this reason, we recommend storing documents that contain references to all sibling documents, or a single primary.  This way orphaned documents can be cleaned up by application logic or a secondary process.

### Inserts

The primary use case for `landlord` is creating keys to represent unique constraints for sub keys of documents, and, so, at this time `landlord` only supports insert operations.  This will likely change in a future release.

However, the confirmation of keys added to a `landlord` lease can still be dictated by the success of one additional operation (any operation) by calling the `confirm()` or `cancel()` methods on `Lease` accordingly.
