'use strict';

const elv = require('elv');

const Lease = require('lease');

const msg = {
  noStore: 'No store defined.'
};

const asserStore = (store) => {
  if (!elv(store))
    throw new TypeError(msg.noStore);

  if ()
};

const me = new WeakMap();

class Landlord {

  constructor(store) {
    me.set(this, {
      store: store
    });
  }

  createLease(keys) {

  }

}

module.exports = Landlord;
