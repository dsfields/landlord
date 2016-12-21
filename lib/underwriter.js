'use strict';

const elv = require('elv');
const Promise = require('bluebird');

const errors = require('./errors');
const Lease = require('./lease');

const msg = {
  optionsPojo: 'Arg "options" must be a non-Array, non-Date object',
  noStore: 'No store defined',
  storeAsyncFunc: 'Store method must be a function: ',
  storeInsertFunc: 'Stores must have a method called "insert()"',
  storeRemoveFunc: 'Stores must have a method called "remove()"',
  storeTouchFunc: 'Stores must have a method called "touch()"',
  docsNotPojoMap: 'Arg "docs" must be a non-Array, non-Date object or a Map',
  ttlNum: 'Arg "options.ttl" must be a number',
  ttlNegative: 'Arg "optoins.ttl" cannot be negative',
  callbackFunc: 'Arg "callback" must be undefined or a function',
  keysArraySet: 'Arg "keys" must be an array or Set',
};

class Underwriter {

  constructor(options) {
    options = this._assertOptions(options);
    this.store = options.store;
    this.ttl = options.ttl;
  }

  _isPojo(val) {
    return (typeof val === 'object'
            && !Array.isArray(val)
            && !(val instanceof Date));
  }

  _toMap(obj) {
    const m = new Map();
    const keys = Object.keys(obj);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      m.set(key, obj[key]);
    }

    return m;
  }

  _promisify(store, func) {
    const afunc = `${func}Async`;

    if (!elv(store[afunc])) {
      store[afunc] = Promise.promisify(store[func]);
      return;
    }

    if (typeof store[afunc] !== 'function')
      throw new TypeError(msg.storeAsyncFunc + afunc);
  };

  _assertOptions(options) {
    if (!this._isPojo(options))
      throw new TypeError(msg.optionsPojo);

    const store = options.store;

    if (!elv(store))
      throw new TypeError(msg.noStore);

    if (typeof store.insert !== 'function')
      throw new TypeError(msg.storeInsertFunc);

    if (typeof store.remove !== 'function')
      throw new TypeError(msg.storeRemoveFunc);

    if (typeof store.touch !== 'function')
      throw new TypeError(msg.storeTouchFunc);

    if (elv(options.ttl)) {
      if (typeof options.ttl !== 'number')
        throw new TypeError(msg.ttlNum);

      if (options.ttl < 0)
        throw new TypeError(msg.ttlNegative);
    }

    this._promisify(store, 'insert');
    this._promisify(store, 'remove');
    this._promisify(store, 'touch');

    return {
      store: store,
      ttl: elv.coalesce(options.ttl, 5000)
    };
  }

  _assertDocuments(docs) {
    if (this._isPojo(docs))
      return this._toMap(docs);

    if (!(docs instanceof Map))
      throw new TypeError(msg.docsNotPojoMap);

    return docs;
  }

  _assertCallback(callback) {
    if (typeof callback !== 'function')
      throw new TypeError(msg.callbackFunc);
  }

  _assertKeys(keys) {
    if (!Array.isArray(keys) && !(keys instanceof Set))
      throw new TypeError(msg.keysArraySet);
  }

  _noResultError() {
    return new errors.StoreError({
      message: 'The store did not respond with a result'
    });
  }

  _createLease(res, docs) {
    const leaseDocs = new Map();
    const successful = [];
    const collided = [];
    let success = true;
    let internal = undefined;

    for (let key of res.keys()) {
      const value = res.get(key);
      if (!value.success) {
        success = false;
        if (value.isCollision) collided.push(key);
        else internal = value.error;
        continue;
      }
      successful.push(key);
      leaseDocs.set(key, {
        etag: value.etag,
        value: docs.get(key)
      });
    }

    let lease = undefined;
    let error = undefined;

    if (success) {
      lease = new Lease(this, leaseDocs);
    } else {
      error = (elv(internal))
        ? new errors.StoreError(internal)
        : new errors.CollisionError(collided);
    }

    return {
      value: lease,
      success: success,
      collided: collided,
      successful: successful,
      error: error
    };
  }

  _createSummary(res) {
    const successful = [];
    let success = true;
    let internal = false;

    for (let key of res.keys()) {
      const value = res.get(key);
      if (!value.success) {
        success = false;
        if (!value.isMissing) internal = value.error;
        continue;
      }
      successful.push(key);
    }

    let err;
    if (!success) {
      err = (internal)
        ? new errors.StoreError(internal)
        : new errors.ExpiredError();
    }

    return {
      success: success,
      error: err,
      successful: successful
    };
  }

  _cleanup(keys, error, callback) {
    const e = error;
    const cb = callback;

    this.store.remove(Array.from(keys), (err, res) => {
      cb(e);
    });
  }

  _cleanupAsync(keys, error) {
    const e = error;

    return this.store.removeAsync(Array.from(keys))
      .then(() => {
        throw e;
      });
  }

  insert(docs, callback) {
    const docsm = this._assertDocuments(docs);
    this._assertCallback(callback);

    const self = this;
    const cb = callback;

    this.store.insert(docsm, { ttl: this.ttl }, (err, res) => {
      if (elv(err) || !elv(res)) {
        const e = (elv(err))
          ? new errors.StoreError(err)
          : self._noResultError();

        return self._cleanup(docsm.keys(), e, cb);
      }

      const lease = self._createLease(res, docsm);

      if (!lease.success)
        return self._cleanup(lease.successful, lease.error, cb);

      cb(undefined, lease.value);
    });
  }

  insertAsync(docs) {
    const docsm = this._assertDocuments(docs);
    const self = this;

    return this.store.insertAsync(docsm, { ttl: this.ttl })
      .then((res) => {
        if (!elv(res))
          throw self._noResultError();

        const lease = self._createLease(res, docsm);

        if (!lease.success)
          return self._cleanupAsync(lease.successful, lease.error);

        return lease.value;
      })
      .catch((err) => {
        if (errors.isKnown(err)) throw err;
        throw new errors.StoreError(err);
      });
  }

  remove(keys, callback) {
    this._assertKeys(keys);
    this._assertCallback(callback);

    const cb = callback;

    this.store.remove(keys, (err, res) => {
      if (elv(err)) return cb(new errors.StoreError(err));
      cb(undefined, true);
    })
  }

  removeAsync(keys) {
    this._assertKeys(keys);
    return this.store.removeAsync(keys)
      .catch((err) => {
        if (errors.isKnown(err)) throw err;
        throw new errors.StoreError(err);
      });
  }

  touch(keys, callback) {
    this._assertKeys(keys);
    this._assertCallback(callback);

    const self = this;
    const cb = callback;
    const k = keys;

    this.store.touch(keys, { ttl: 0 }, (err, res) => {
      if (elv(err) || !elv(res)) {
        const e = (elv(err))
          ? new errors.StoreError(err)
          : self._noResultError();

        return self._cleanup(k, e, cb);
      }

      const summary = self._createSummary(res);

      if (!summary.success)
        return self._cleanup(summary.successful, summary.error, cb);

      cb(undefined, res);
    });
  }

  touchAsync(keys) {
    this._assertKeys(keys);

    const self = this;
    const k = keys;

    return this.store.touchAsync(keys, { ttl: 0 })
      .then((res) => {
        if (!elv(res))
          throw self._noResultError();

        const summary = self._createSummary(res);

        if (!summary.success)
          return self._cleanupAsync(summary.successful, summary.error);

        return res;
      })
      .catch((err) => {
        if (errors.isKnown(err)) throw err;
        throw new errors.StoreError(err);
      });
  }

}

module.exports = Underwriter;
