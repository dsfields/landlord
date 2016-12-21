'use strict';

function CollisionError(keys) {
  Error.call(this);
  Error.captureStackTrace(this, CollisionError);
  this.message = 'Cannot create lease: key collision detected in store';
  this.keys = keys;
}
CollisionError.prototype = Object.create(Error.prototype);
CollisionError.prototype.constructor = CollisionError;


function ExpiredError() {
  Error.call(this);
  Error.captureStackTrace(this, ExpiredError);
  this.message = 'Cannot confirm lease: expired';
}
ExpiredError.prototype = Object.create(Error.prototype);
ExpiredError.prototype.constructor = ExpiredError;


function CancelledError() {
  Error.call(this);
  Error.captureStackTrace(this, CancelledError);
  this.message = 'The lease has been cancelled';
}
CancelledError.prototype = Object.create(Error.prototype);
CancelledError.prototype.constructor = CancelledError;


function ConfirmedError() {
  Error.call(this);
  Error.captureStackTrace(this, ConfirmedError);
  this.message = 'The lease has been confirmed';
}
ConfirmedError.prototype = Object.create(Error.prototype);
ConfirmedError.prototype.constructor = ConfirmedError;


function StoreError(err) {
  Error.call(this);
  Error.captureStackTrace(this, ConfirmedError);
  this.message = 'Landlord\'s internal data store has reported an error';
  this.internal = err;
}
StoreError.prototype = Object.create(Error.prototype);
StoreError.prototype.constructor = StoreError;


module.exports = {
  CollisionError: CollisionError,
  ExpiredError: ExpiredError,
  CancelledError: CancelledError,
  ConfirmedError: ConfirmedError,
  StoreError: StoreError,
  isKnown: function(err) {
    return (err instanceof CollisionError
        || err instanceof ExpiredError
        || err instanceof CancelledError
        || err instanceof ConfirmedError
        || err instanceof StoreError);
  }
};
