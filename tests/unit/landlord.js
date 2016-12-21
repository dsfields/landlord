'use strict';

const assert = require('chai').assert;
const Promise = require('bluebird');

const errors = require('../../lib/errors');
const Landlord = require('../../lib/landlord');
const Lease = require('../../lib/lease');

describe('Landlord', () => {

  describe('#errors', () => {
    it('should return the errors', (done) => {
      assert.strictEqual(Landlord.errors, errors);
      done();
    });
  })

  describe('#constructor', () => {
    it('should throw if options not object', () => {
      assert.throws(() => {
        new Landlord(42);
      }, TypeError);
    });

    it('should throw if options is undefined', () => {
      assert.throws(() => {
        new Landlord(undefined);
      }, TypeError);
    });

    it('should throw if options is null', () => {
      assert.throws(() => {
        new Landlord(null);
      }, TypeError);
    });

    it('should throw if options is Array', () => {
      assert.throws(() => {
        new Landlord([]);
      }, TypeError);
    });

    it('should throw if options is Date', () => {
      assert.throws(() => {
        new Landlord(new Date());
      }, TypeError);
    });

    it('should throw if options.store missing', () => {
      assert.throws(() => {
        new Landlord({});
      }, TypeError);
    });

    it('should throw if options.store is null', () => {
      assert.throws(() => {
        new Landlord({
          store: null
        });
      }, TypeError);
    });

    it('should throw if options.store is Array', () => {
      assert.throws(() => {
        new Landlord({
          store: []
        });
      }, TypeError);
    });

    it('should throw if options.store is Date', () => {
      assert.throws(() => {
        new Landlord({
          store: new Date()
        });
      }, TypeError);
    });

    it('should throw if options.store not an object', () => {
      assert.throws(() => {
        new Landlord({
          store: 42
        });
      }, TypeError);
    });

    it('should throw if options.store missing insert()', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            remove: () => {},
            touch: () => {}
          }
        });
      }, TypeError);
    });

    it('should throw if options.store missing remove()', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: () => {},
            touch: () => {}
          }
        });
      }, TypeError);
    });

    it('should throw if options.store missing touch()', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: () => {},
            remove: () => {}          }
        });
      }, TypeError);
    });

    it('should throw if options.store.insert is not func', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: 42,
            remove: () => {},
            touch: () => {}
          }
        });
      }, TypeError);
    });

    it('should throw if store.remove is not func', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: () => {},
            remove: 42,
            touch: () => {}
          }
        });
      }, TypeError);
    });

    it('should throw if store.touch is not func', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: () => {},
            remove: () => {},
            touch: 42
          }
        });
      }, TypeError);
    });

    it('should throw if store.insertAsync is not func if defined', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: () => {},
            remove: () => {},
            touch: () => {},
            insertAsync: 42
          }
        });
      }, TypeError);
    });

    it('should throw if store.removeAsync is not func if defined', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: () => {},
            remove: () => {},
            touch: () => {},
            removeAsync: 42
          }
        });
      }, TypeError);
    });

    it('should throw if store.touchAsync is not func if defined', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: () => {},
            remove: () => {},
            touch: () => {},
            touchAsync: 42
          }
        });
      }, TypeError);
    });

    it('should throw if options.ttl is not a Number', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: () => {},
            remove: () => {},
            touch: () => {}
          },
          ttl: 'foo'
        });
      }, TypeError);
    });

    it('should throw if options.ttl is negative', () => {
      assert.throws(() => {
        new Landlord({
          store: {
            insert: () => {},
            remove: () => {},
            touch: () => {}
          },
          ttl: -42
        });
      }, TypeError);
    });

    it('should add insertAsync() if not provided on store', (done) => {
      const store = {
        insert: () => {},
        remove: () => {},
        touch: () => {}
      };

      const landlord = new Landlord({ store: store });

      assert.isFunction(store.insertAsync);
      done();
    });

    it('should add removeAsync() if not provided on store', (done) => {
      const store = {
        insert: () => {},
        remove: () => {},
        touch: () => {}
      };

      const landlord = new Landlord({ store: store });

      assert.isFunction(store.removeAsync);
      done();
    });

    it('should add touchAsync() if not provided on store', (done) => {
      const store = {
        insert: () => {},
        remove: () => {},
        touch: () => {}
      };

      const landlord = new Landlord({ store: store });

      assert.isFunction(store.touchAsync);
      done();
    });
  });

  describe('#lease', () => {
    let landlord, store, docs, result;

    beforeEach((done) => {
      docs = {
        foo: { a: 42 },
        bar: { b: 24 }
      };

      result = new Map();
      result.set('foo', { success: true, etag: '123' });
      result.set('bar', { success: true, etag: '321' });

      store = {
        insert: (d, options, callback) => {
          process.nextTick(() => {
            callback(undefined, result);
          });
        },
        remove: (keys, callback) => {
          process.nextTick(() => {
            callback(undefined, true);
          });
        },
        touch: () => {}
      };

      landlord = new Landlord({ store: store });
      done();
    });

    it('should throw if docs not object or Map', () => {
      assert.throws(() => {
        landlord.lease(42);
      }, TypeError);
    });

    it('should throw if callback not func if provided', () => {
      assert.throws(() => {
        landlord.lease(docs, 42);
      }, TypeError);
    });

    it('should insert into store as Map', (done) => {
      store.insert = (d, options, callback) => {
        assert.instanceOf(d, Map);
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      landlord.lease(docs, () => {
        done();
      });
    });

    it('should insert all keys into store', (done) => {
      store.insert = (d, options, callback) => {
        assert.isTrue(d.has('foo'));
        assert.isTrue(d.has('bar'));
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      landlord.lease(docs, () => {
        done();
      });
    });

    it('should insert keys with contents into store', (done) => {
      store.insert = (d, options, callback) => {
        assert.strictEqual(d.get('foo'), docs.foo);
        assert.strictEqual(d.get('bar'), docs.bar);
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      landlord.lease(docs, () => {
        done();
      });
    });

    it('should insert keys with ttl', (done) => {
      store.insert = (d, options, callback) => {
        assert.property(options, 'ttl');
        assert.isNumber(options.ttl);
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      landlord.lease(docs, () => {
        done();
      });
    });

    it('should insert into store as Map with Promise', (done) => {
      store.insertAsync = (d, options) => {
        assert.instanceOf(d, Map);
        return Promise.resolve(result);
      };

      landlord.lease(docs)
        .then((res) => {
          done();
        });
    });

    it('should insert all keys into store with Promise', (done) => {
      store.insertAsync = (d, options) => {
        assert.isTrue(d.has('foo'));
        assert.isTrue(d.has('bar'));
        return Promise.resolve(result);
      };

      landlord.lease(docs)
        .then((res) => {
          done();
        });
    });

    it('should insert keys with contents into store with Promise', (done) => {
      store.insertAsync = (d, options) => {
        assert.strictEqual(d.get('foo'), docs.foo);
        assert.strictEqual(d.get('bar'), docs.bar);
        return Promise.resolve(result);
      };

      landlord.lease(docs)
        .then((res) => {
          done();
        });
    });

    it('should insert keys with ttl with Promise', (done) => {
      store.insertAsync = (d, options) => {
        assert.property(options, 'ttl');
        assert.isNumber(options.ttl);
        return Promise.resolve(result);
      };

      landlord.lease(docs)
        .then((res) => {
          done();
        });
    });

    it('should return undefinined when given callback', (done) => {
      const res = landlord.lease(docs, () => {});
      assert.isUndefined(res);
      done();
    });

    it('should return Promise when not given callback', (done) => {
      const res = landlord.lease(docs);
      assert.instanceOf(res, Promise);
      done();
    });

    it('should set callback result to instance of Lease', (done) => {
      landlord.lease(docs, (err, lease) => {
        assert.instanceOf(lease, Lease);
        done();
      });
    });

    it('should resolve Promise with instance of Lease', (done) => {
      landlord.lease(docs)
        .then((lease) => {
          assert.instanceOf(lease, Lease);
          done();
        });
    });

    it('should set callback err to CollisionError on key collision', (done) => {
      store.insert = (d, options, callback) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isCollision = true;
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      landlord.lease(docs, (err, lease) => {
        assert.instanceOf(err, errors.CollisionError);
        done();
      });
    });

    it('should set callback CollisionError keys to failures', (done) => {
      store.insert = (d, options, callback) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isCollision = true;
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      landlord.lease(docs, (err, lease) => {
        assert.include(err.keys, 'bar');
        assert.lengthOf(err.keys, 1);
        done();
      });
    });

    it('should set callback err to StoreError on failure', (done) => {
      store.insert = (d, options, callback) => {
        process.nextTick(() => {
          callback(new Error('Oh hai!'), undefined);
        });
      };

      landlord.lease(docs, (err, lease) => {
        assert.instanceOf(err, errors.StoreError);
        done();
      });
    });

    it('should set callback StoreError internal error', (done) => {
      const internal = new Error('Oh hai!');

      store.insert = (d, options, callback) => {
        process.nextTick(() => {
          callback(internal, undefined);
        });
      };

      landlord.lease(docs, (err, lease) => {
        assert.strictEqual(err.internal, internal);
        done();
      });
    });

    it('should throw CollisionError on key collision', (done) => {
      store.insertAsync = (d, options) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isCollision = true;
        return Promise.resolve(result);
      };

      landlord.lease(docs)
        .catch((err) => {
          assert.instanceOf(err, errors.CollisionError);
          done();
        });
    });

    it('should set thrown CollisionError keys to those that failed', (done) => {
      store.insertAsync = (d, options) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isCollision = true;
        return Promise.resolve(result);
      };

      landlord.lease(docs)
        .catch((err) => {
          assert.include(err.keys, 'bar');
          assert.lengthOf(err.keys, 1);
          done();
        });
    });

    it('should throw StoreError on catastrophic failure', (done) => {
      store.insertAsync = (d, options) => {
        return Promise.reject(new Error('Oh hai!'));
      };

      landlord.lease(docs)
        .catch((err) => {
          assert.instanceOf(err, errors.StoreError);
          done();
        });
    });

    it('should set thrown StoreError internal error', (done) => {
      const internal = new Error('Oh hai!');
      store.insertAsync = (d, options) => {
        return Promise.reject(internal);
      };

      landlord.lease(docs)
        .catch((err) => {
          assert.strictEqual(err.internal, internal);
          done();
        });
    });

    it('should remove successful keys if insert callback failure', (done) => {
      store.insert = (d, options, callback) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isCollision = true;
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      store.remove = (keys, callback) => {
        assert.include('foo', keys);
        assert.lengthOf(keys, 1);
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      landlord.lease(docs, (err, res) => {
        done();
      });
    });

    it('should remove successful keys if insert Promise failure', (done) => {
      store.insertAsync = (d, options, callback) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isCollision = true;
        return Promise.resolve(result);
      };

      store.removeAsync = (keys) => {
        assert.include('foo', keys);
        assert.lengthOf(keys, 1);
        return Promise.resolve(true);
      };

      landlord.lease(docs)
        .catch((err) => {
          done();
        });
    });

    it('should set err to StoreError if store return no result', (done) => {
      store.insert = (d, options, callback) => {
        process.nextTick(() => {
          callback(undefined, undefined);
        });
      };

      landlord.lease(docs, (err, res) => {
        assert.instanceOf(err, errors.StoreError);
        done();
      });
    });

    it('should throw StoreError if store return no result', (done) => {
      store.insertAsync = (d, options) => {
        return Promise.resolve(undefined);
      };

      landlord.lease(docs)
        .catch((err) => {
          assert.instanceOf(err, errors.StoreError);
          done();
        });
    });
  });

});
