'use strict';

const elv = require('elv');
const Promise = require('bluebird');

const errors = require('./errors');

const getStateError = (state) => {
  if (state.isCancelled) return new errors.CancelledError();
  if (state.isConfirmed) return new errors.ConfirmedError();
  if (state.isExpired) return new errors.ExpiredError();
  return undefined;
};

const clearEtags = (documents) => {
  documents.forEach((value, key, map) => {
    value.etag = undefined;
  });
};

const confirmFailure = (state) => {
  clearEtags(state.documents);
  state.isConfirmed = false;
  state.isExpired = true;
};

const confirmSuccess = (state, res) => {
  state.isConfirmed = true;
  const docs = state.documents;
  res.forEach((value, key, map) => {
    docs.get(key).etag = value.etag;
  });
};

const me = new WeakMap();

class Lease {

  constructor(underwriter, docs) {
    me.set(this, {
      underwriter: underwriter,
      documents: docs,
      isCancelled: false,
      isConfirmed: false,
      isExpired: false
    });
  }

  get documents() { return me.get(this).documents; }

  get isCancelled() { return me.get(this).isCancelled; }

  get isConfirmed() { return me.get(this).isConfirmed; }

  get isExpired() { return me.get(this).isExpired; }

  cancel(callback) {
    const state = me.get(this);
    const underwriter = state.underwriter;
    const keys = Array.from(state.documents.keys());
    const self = this;
    const cb = callback;
    const e = getStateError(state);

    if (!e) {
      state.isCancelled = true;
      clearEtags(state.documents);
    }

    if (elv(cb)) {
      state.underwriter._assertCallback(cb);
      if (elv(e)) return process.nextTick(() => cb(e));
      return underwriter.remove(keys, (err) => cb(err, self));
    }

    if (elv(e)) return Promise.reject(e);
    return underwriter.removeAsync(keys).then(() => self);
  }

  confirm(callback) {
    const state = me.get(this);
    const underwriter = state.underwriter;
    const keys = Array.from(state.documents.keys());
    const self = this;
    const cb = callback;
    const e = getStateError(state);

    if (!e) state.isConfirmed = true;

    if (elv(cb)) {
      state.underwriter._assertCallback(cb);
      if (elv(e)) return process.nextTick(() => cb(e));
      return underwriter.touch(keys, (err, res) => {
        if (elv(err)) confirmFailure(state);
        else confirmSuccess(state, res);
        cb(err, self);
      });
    }

    if (elv(e)) return Promise.reject(e);
    return underwriter.touchAsync(keys)
      .then((res) => {
        confirmSuccess(state, res);
        return self;
      })
      .catch((err) => {
        confirmFailure(state);
        throw err;
      });
  }

}

module.exports = Lease;
