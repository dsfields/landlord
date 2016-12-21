'use strict';

const elv = require('elv');

const errors = require('./errors');
const Underwriter = require('./underwriter');

const me = new WeakMap();

class Landlord {

  constructor(options) {
    me.set(this, {
      underwriter: new Underwriter(options)
    });
  }

  static get errors() { return errors; }

  lease(docs, callback) {
    const underwriter = me.get(this).underwriter;
    if (elv(callback)) return underwriter.insert(docs, callback);
    return underwriter.insertAsync(docs);
  }

}

module.exports = Landlord;
