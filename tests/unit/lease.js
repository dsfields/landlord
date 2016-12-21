'use strict';

const assert = require('chai').assert;
const Promise = require('bluebird');

const errors = require('../../lib/errors');
const Lease = require('../../lib/lease');
const Underwriter = require('../../lib/underwriter');

describe('Lease', () => {
  let underwriter, store, docs, result, lease;

  beforeEach((done) => {
    docs = new Map();

    docs.set('foo', {
      etag: '123',
      value: { a: 42 }
    });

    docs.set('bar', {
      etag: '123',
      value: { b: 24 }
    });

    result = new Map();
    result.set('foo', { success: true, etag: '456' });
    result.set('bar', { success: true, etag: '654' });

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
      touch: (d, options, callback) => {
        process.nextTick(() => {
          callback(undefined, result);
        });
      }
    };

    underwriter = new Underwriter({ store: store });
    lease = new Lease(underwriter, docs);

    done();
  });

  describe('#constructor', () => {
    it('should set isCancelled to false', (done) => {
      assert.isFalse(lease.isCancelled);
      done();
    });

    it('should set isConfirmed to false', (done) => {
      assert.isFalse(lease.isConfirmed);
      done();
    });

    it('should set isExpired to false', (done) => {
      assert.isFalse(lease.isExpired);
      done();
    });

    it('should set documents to instance of Map', (done) => {
      assert.instanceOf(lease.documents, Map);
      done();
    });

    it('should set documents to provided docs', (done) => {
      assert.strictEqual(lease.documents, docs);
      done();
    });
  });

  describe('#cancel', () => {
    it('should throw if callback not a func if provided', () => {
      assert.throws(() => {
        lease.cancel(42);
      }, TypeError);
    });

    it('should return Promise if callback not provided', (done) => {
      const res = lease.cancel();
      assert.instanceOf(res, Promise);
      done();
    });

    it('should set isCancelled to true', (done) => {
      const res = lease.cancel((err, res) => {
        assert.isTrue(res.isCancelled);
        done();
      });
    });

    it('should set callback err if already cancelled', (done) => {
      const res = lease.cancel((err, res) => {
        res.cancel((e, r) => {
          assert.instanceOf(e, errors.CancelledError);
          done();
        });
      });
    });

    it('should set callback err if already confirmed', (done) => {
      const res = lease.confirm((err, res) => {
        res.cancel((e, r) => {
          assert.instanceOf(e, errors.ConfirmedError);
          done();
        });
      });
    });

    it('should set callback err if expired', (done) => {
      store.touch = (keys, options, callback) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      lease.confirm((err, res) => {
        res.cancel((e, r) => {
          assert.instanceOf(e, errors.ExpiredError);
          done();
        });
      });
    });

    it('should set callback err if catastrophic failure', (done) => {
      store.remove = (keys, callback) => {
        process.nextTick(() => {
          callback(new Error('Oops'), undefined);
        });
      };

      lease.cancel((err, res) => {
        assert.instanceOf(err, errors.StoreError);
        done();
      });
    });

    it('should throw if already cancelled', (done) => {
      lease.cancel()
        .then((res) => {
          return res.cancel();
        })
        .catch((err) => {
          assert.instanceOf(err, errors.CancelledError);
          done();
        });
    });

    it('should throw if already confirmed', (done) => {
      lease.confirm()
        .then((res) => {
          return res.cancel();
        })
        .catch((err) => {
          assert.instanceOf(err, errors.ConfirmedError);
          done();
        });
    });

    it('should throw if expired', (done) => {
      store.touchAsync = (keys, options) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        return Promise.resolve(result);
      };

      lease.confirm()
        .catch((err) => {
          return lease.cancel();
        })
        .catch((err) => {
          assert.instanceOf(err, errors.ExpiredError);
          done();
        });
    });

    it('should throw if catastrophic failure', (done) => {
      store.removeAsync = (keys) => {
        return Promise.reject(Error('Oops'));
      };

      lease.cancel()
        .catch((err) => {
          assert.instanceOf(err, errors.StoreError);
          done();
        });
    });

    it('should set callback result to self', (done) => {
      lease.cancel((err, res) => {
        assert.instanceOf(res, Lease);
        done();
      });
    });

    it('should resolve Promise with self', (done) => {
      lease.cancel()
        .then((res) => {
          assert.instanceOf(res, Lease);
          done();
        });
    });

    it('should remove all bound keys', (done) => {
      store.remove = (keys, callback) => {
        assert.include(keys, 'foo');
        assert.include(keys, 'bar');
        assert.lengthOf(keys, 2);
        process.nextTick(() => {
          callback(undefined, true);
        });
      };

      lease.cancel((err, res) => {
        done();
      });
    });

    it('should remove all bound keys with Promise', (done) => {
      store.removeAsync = (keys) => {
        assert.include(keys, 'foo');
        assert.include(keys, 'bar');
        assert.lengthOf(keys, 2);
        return Promise.resolve(true);
      };

      lease.cancel()
        .then((res) => {
          done();
        });
    });
  });

  describe('#confirm', () => {
    it('should throw if callback not a func if provided', () => {
      assert.throws(() => {
        lease.confirm(42);
      }, TypeError);
    });

    it('should return Promise if callback not provided', (done) => {
      const res = lease.confirm();
      assert.instanceOf(res, Promise);
      done();
    });

    it('should throw if cancelled with Promise', (done) => {
      lease.cancel()
        .then((res) => {
          return res.confirm();
        })
        .catch((err) => {
          assert.instanceOf(err, errors.CancelledError);
          done();
        });
    });

    it('should throw if confirmed with Promise', (done) => {
      lease.confirm()
        .then((res) => {
          return res.confirm();
        })
        .catch((err) => {
          assert.instanceOf(err, errors.ConfirmedError);
          done();
        });
    });

    it('should throw if expired with Promise', (done) => {
      store.touchAsync = (keys, options) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        return Promise.resolve(result);
      };

      lease.confirm()
        .catch((err) => {
          assert.instanceOf(err, errors.ExpiredError);
          done();
        });
    });

    it('should set err if cancelled with callback', (done) => {
      lease.cancel((err, res) => {
        lease.confirm((e, r) => {
          assert.instanceOf(e, errors.CancelledError);
          done();
        })
      });
    });

    it('should set err if confirmed with callback', (done) => {
      lease.confirm((err, res) => {
        lease.confirm((e, r) => {
          assert.instanceOf(e, errors.ConfirmedError);
          done();
        })
      });
    });

    it('should set err if expired with callback', (done) => {
      store.touch = (keys, options, callback) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      lease.confirm((err, res) => {
        assert.instanceOf(err, errors.ExpiredError);
        done();
      });
    });

    it('should set isConfirmed on success with Promise', (done) => {
      lease.confirm()
        .then((res) => {
          assert.isTrue(res.isConfirmed);
          done();
        });
    });

    it('should set isConfirmed on success', (done) => {
      lease.confirm((err, res) => {
        assert.isTrue(res.isConfirmed);
        done();
      });
    });

    it('should set isExpired if expired with Promise', (done) => {
      store.touchAsync = (keys, options) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        return Promise.resolve(result);
      };

      lease.confirm()
        .catch((res) => {
          assert.isTrue(lease.isExpired);
          done();
        });
    });

    it('should set isExpired if expired', (done) => {
      store.touch = (keys, options, callback) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      lease.confirm((err, res) => {
        assert.isTrue(lease.isExpired);
        done();
      });
    });

    it('should remove keys if catastrophic failure with Promise', (done) => {
      store.touchAsync = (keys, options) => {
        return Promise.reject(new Error('Oops'));
      };

      store.removeAsync = (keys) => {
        assert.include(keys, 'foo');
        assert.include(keys, 'bar');
        assert.lengthOf(keys, 2);
        return Promise.resolve(true);
      };

      lease.confirm()
        .catch((err) => {
          done();
        });
    });

    it('should remove keys if catastrophic failure', (done) => {
      store.touch = (keys, options, callback) => {
        callback(new Error('Oops'));
      };

      store.remove = (keys, callback) => {
        assert.include(keys, 'foo');
        assert.include(keys, 'bar');
        assert.lengthOf(keys, 2);
        callback(undefined, true);
      };

      lease.confirm((err, res) => {
        done();
      });
    });

    it('should set isExpired if catastrophic failure with Promsie', (done) => {
      store.touchAsync = (keys, options) => {
        return Promise.reject(new Error('Oops'));
      };

      lease.confirm()
        .catch((err) => {
          assert.isTrue(lease.isExpired);
          done();
        });
    });

    it('should set isExpired if catastrophic failure', (done) => {
      store.touch = (keys, options, callback) => {
        process.nextTick((err, res) => {
          callback(new Error('Oops'));
        });
      };

      lease.confirm((err, res) => {
        assert.isTrue(lease.isExpired);
        done();
      });
    });

    it('should remove keys if any failed to update with Promise', (done) => {
      store.touchAsync = (keys, options) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        return Promise.resolve(result);
      };

      store.removeAsync = (keys) => {
        assert.include(keys, 'foo');
        assert.lengthOf(keys, 1);
        return Promise.resolve(true);
      };

      lease.confirm()
        .catch((err) => {
          done();
        });
    });

    it('should remove keys if any failed to update', (done) => {
      store.touch = (keys, options, callback) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      store.remove = (keys, callback) => {
        assert.include(keys, 'foo');
        assert.lengthOf(keys, 1);
        callback(undefined, true);
      };

      lease.confirm((err, res) => {
        done();
      });
    });

    it('should remove etags if any failed to update with Promise', (done) => {
      store.touchAsync = (keys, options) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        return Promise.resolve(result);
      };

      lease.confirm()
        .catch((err) => {
          const d = lease.documents;
          assert.isUndefined(d.get('foo').etag);
          assert.isUndefined(d.get('bar').etag);
          done();
        });
    });

    it('should remove etags if any failed to update', (done) => {
      store.touch = (keys, options, callback) => {
        const bar = result.get('bar');
        bar.success = false;
        bar.isExpired = true;
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      lease.confirm((err, res) => {
        const d = lease.documents;
        assert.isUndefined(d.get('foo').etag);
        assert.isUndefined(d.get('bar').etag);
        done();
      });
    });

    it('should remove TTL for all keys with Promise', (done) => {
      store.touchAsync = (keys, options) => {
        assert.strictEqual(options.ttl, 0);
        assert.include(keys, 'foo');
        assert.include(keys, 'bar');
        return Promise.resolve(result);
      };

      lease.confirm()
        .then((res) => {
          done();
        });
    });

    it('should remove TTL for all keys', (done) => {
      store.touch = (keys, options, callback) => {
        assert.strictEqual(options.ttl, 0);
        assert.include(keys, 'foo');
        assert.include(keys, 'bar');
        process.nextTick(() => {
          callback(undefined, result);
        });
      };

      lease.confirm((err, res) => {
        done();
      });
    });

    it('should set etags if returned by store with Promise', (done) => {
      lease.confirm()
        .then((res) => {
          const d = res.documents;
          assert.strictEqual(d.get('foo').etag, '456');
          assert.strictEqual(d.get('bar').etag, '654');
          done();
        });
    });

    it('should set etag if returned by store', (done) => {
      lease.confirm((err, res) => {
        const d = res.documents;
        assert.strictEqual(d.get('foo').etag, '456');
        assert.strictEqual(d.get('bar').etag, '654');
        done();
      });
    });
  });

});
