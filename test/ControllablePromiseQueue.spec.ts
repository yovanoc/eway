import { assert } from "chai";

import { ControllablePromise, ControllablePromiseQueue } from "../src"

describe("ControllablePromiseQueue", () => {

  describe('When the concurrency limit is 1', () => {
    it('only execute one promise at one time', (done) => {
      const promiseQueue = new ControllablePromiseQueue({ concurrency: 1 });
      promiseQueue.add(() => {
        return new ControllablePromise(resolve => {
          assert.equal(promiseQueue.ongoingCount, 1);
          setTimeout(() => {
            resolve(1);
          }, 500)
        })
      });

      promiseQueue.add(() => {
        return new ControllablePromise(resolve => {
          setTimeout(() => {
            resolve(1);
            assert.equal(promiseQueue.ongoingCount, 1);
          }, 500)
        })
      });

      promiseQueue.add(() => {
        return new ControllablePromise(resolve => {
          setTimeout(() => {
            resolve(1);
            assert.equal(promiseQueue.ongoingCount, 1);
            done();
          }, 500)
        })
      });

      // only one promise is waiting to run
      assert.equal(promiseQueue.waitingCount, 2);

      // only one promise is running
      assert.equal(promiseQueue.ongoingCount, 1);
    });
  });

  describe('When the concurrency limit is 2', () => {
    it('only execute not more than two promises at one time', (done) => {
      const promiseQueue = new ControllablePromiseQueue({ concurrency: 2 });
      promiseQueue.add(() => {
        return new ControllablePromise(resolve => {
          setTimeout(() => {
            resolve(1);
            assert.equal(promiseQueue.ongoingCount, 2);
          }, 500)
        })
      });

      promiseQueue.add(() => {
        return new ControllablePromise(resolve => {
          setTimeout(() => {
            resolve(1);
            assert.equal(promiseQueue.ongoingCount, 2);
          }, 500)
        })
      });

      promiseQueue.add(() => {
        return new ControllablePromise(resolve => {
          setTimeout(() => {
            resolve(1);
            assert.equal(promiseQueue.ongoingCount, 2);
          }, 500)
        })
      });

      promiseQueue.add(() => {
        return new ControllablePromise(resolve => {
          setTimeout(() => {
            resolve(1);
            assert.ok([1, 2].indexOf(promiseQueue.ongoingCount) > -1);
            done();
          }, 500)
        })
      });

      // only two promise is waiting to run
      assert.equal(promiseQueue.waitingCount, 2);

      // only two promises is running
      assert.equal(promiseQueue.ongoingCount, 2);
    });
  });

  describe('"Add" method can be chaining', () => {
    it('the return value is itself', (done) => {
      const promiseQueue = new ControllablePromiseQueue({ concurrency: 1 });
      const pqInstance = promiseQueue.add(() => {
        return new ControllablePromise(resolve => {
          assert.equal(promiseQueue.ongoingCount, 1);
          setTimeout(() => {
            resolve(1);
          }, 500)
        })
      });

      assert.ok(pqInstance instanceof ControllablePromiseQueue);

      pqInstance.add(() => {
        return new ControllablePromise(resolve => {
          setTimeout(() => {
            resolve(1);
            assert.equal(promiseQueue.ongoingCount, 1);
            done();
          }, 500)
        })
      });

      // only one promise is waiting to run
      assert.equal(promiseQueue.waitingCount, 1);

      // only one promise is running
      assert.equal(promiseQueue.ongoingCount, 1);
    });
  });
})
