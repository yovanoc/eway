import { assert } from "chai";

import { ControllablePromise } from "../src";

describe("ControllablePromise", () => {
  it("new ControllablePromise", done => {
    const expectedValue = Symbol();

    const cp = new ControllablePromise(resolve => {
      setTimeout(() => resolve(expectedValue));
    });

    assert(cp.isResumed);
    assert(!cp.isPaused);
    assert(!cp.isCanceled);
    assert(!cp.isRejected);
    assert(!cp.isFulfilled);
    assert(!cp.isSettled);
    // assert(!cp.lock)

    cp.then(value => {
      assert(!cp.isResumed);
      assert(!cp.isPaused);
      assert(!cp.isCanceled);
      assert(!cp.isRejected);
      assert(cp.isFulfilled);
      assert(cp.isSettled);
      // assert(!cp.lock)
      assert.strictEqual(value, expectedValue);
      done();
    }).catch(done);
  });

  it("reject on error", done => {
    const expectedMessage = "Fatal error";
    const cp = new ControllablePromise((resolve, reject) => {
      setTimeout(() => reject(new Error(expectedMessage)));
    });

    cp.then(() => done(new Error("Should fail")))
      .catch(error => {
        assert(!cp.isResumed);
        assert(!cp.isPaused);
        assert(!cp.isCanceled);
        assert(cp.isRejected);
        assert(!cp.isFulfilled);
        assert(cp.isSettled);
        // assert(!cp.lock)
        assert.strictEqual(error.message, expectedMessage);
        done();
      })
      .catch(done);
  });

  describe("progress", () => {
    it("emit progress to multiple listeners", done => {
      let expectedStats: any = null;

      const cp = new ControllablePromise((resolve, reject, progress) => {
        setTimeout(() => {
          progress(
            (expectedStats = { percent: 10, files: { count: 1, total: 10 } })
          );
          progress(
            (expectedStats = { percent: 30, files: { count: 3, total: 10 } })
          );
          progress(
            (expectedStats = { percent: 50, files: { count: 5, total: 10 } })
          );
          progress(
            (expectedStats = { percent: 100, files: { count: 10, total: 10 } })
          );
          setTimeout(resolve);
        });
      });

      cp.then(() => {
        assert(!cp.isResumed);
        assert(!cp.isPaused);
        assert(!cp.isCanceled);
        assert(!cp.isRejected);
        assert(cp.isFulfilled);
        assert(cp.isSettled);
        // assert(!cp.lock)
        done();
      }).catch(done);

      cp.onProgress(stats => {
        assert.deepStrictEqual(stats, expectedStats);
      }).catch(done);

      cp.onProgress(stats => {
        assert.deepStrictEqual(stats, expectedStats);
      }).catch(done);
    });

    it("onProgress should return this", done => {
      const cp = new ControllablePromise((resolve, reject, progress) => {
        setTimeout(() => {
          progress({});
          setTimeout(resolve);
        });
      });

      const shouldBeCp = cp.onProgress(stats =>
        assert.deepStrictEqual(stats, {})
      );
      shouldBeCp
        .then(() => {
          assert.strictEqual(cp, shouldBeCp);
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
          done();
        })
        .catch(done);
    });

    it("fail if progress callback is not a function", done => {
      const cp = new ControllablePromise((resolve, reject, progress) => {
        progress(50);
      });

      try {
        // @ts-ignore
        cp.onProgress("console.log")
          .then(() => done(new Error("Should not success or fail")))
          .catch(() => done(new Error("Should not success or fail")));
      } catch (err) {
        assert(err instanceof TypeError);
        done();
      }
    });
  });

  describe("cancel", () => {
    it("reject a ControllablePromiseCancelError when canceled", done => {
      let cancelHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onCancel(resolveCancel => {
            cancelHandlerRunCount += 1;
            resolveCancel();
          });
          setTimeout(resolve);
        }
      );

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          assert.strictEqual(error.name, "ControllablePromiseCancelError");
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
        })
        .catch(done);

      const cancelPromise = cp.cancel();
      // assert(cp.lock)
      cancelPromise
        .then(() => {
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(cancelHandlerRunCount, 1);
          done();
        })
        .catch(done);
    });

    it("if cancel handler is rejected, just unlock", done => {
      let cancelHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onCancel((resolveCancel, rejectCancel) => {
            cancelHandlerRunCount += 1;
            rejectCancel();
          });
          setTimeout(resolve);
        }
      );

      cp.then(() => {
        assert(!cp.isResumed);
        assert(!cp.isPaused);
        assert(!cp.isCanceled);
        assert(!cp.isRejected);
        assert(cp.isFulfilled);
        assert(cp.isSettled);
      }).catch(done);

      const cancelPromise = cp.cancel();
      // assert(cp.lock)
      cancelPromise
        .then(() => done(new Error("Should reject")))
        .catch(() => {
          assert(cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(cancelHandlerRunCount, 1);
          done();
        })
        .catch(done);
    });

    it("cancel should fail if the promise is already fulfilled", done => {
      let cancelHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onCancel(resolveCancel => {
            cancelHandlerRunCount += 1;
            resolveCancel();
          });
          resolve();
        }
      );

      cp.catch(done);

      setTimeout(() => {
        const cancelPromise = cp.cancel();
        // assert(!cp.lock)
        cancelPromise
          .then(() => done(new Error("Should fail")))
          .catch(error => {
            assert(cp.isSettled);
            assert(cp.isFulfilled);
            // assert(!cp.lock)
            assert.strictEqual(cancelHandlerRunCount, 0);
            assert.strictEqual(
              error.name,
              "ControllablePromisePreconditionError"
            );
            assert.strictEqual(error.message, "Promise was settled");
            done();
          })
          .catch(done);
      });
    });

    it("cancel should fail if the promise is already rejected", done => {
      let cancelHandlerRunCount = 0;
      const expectedMessage = "Fatal error";
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onCancel(resolveCancel => {
            cancelHandlerRunCount += 1;
            resolveCancel();
          });
          reject(new Error(expectedMessage));
        }
      );

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          assert.strictEqual(error.message, expectedMessage);
          assert(cp.isRejected);
        })
        .catch(done);

      setTimeout(() => {
        const cancelPromise = cp.cancel();
        // assert(!cp.lock)
        cancelPromise
          .then(() => done(new Error("Should fail")))
          .catch(error => {
            assert(cp.isSettled);
            assert(cp.isRejected);
            // assert(!cp.lock)
            assert.strictEqual(cancelHandlerRunCount, 0);
            assert.strictEqual(
              error.name,
              "ControllablePromisePreconditionError"
            );
            assert.strictEqual(error.message, "Promise was settled");
            done();
          })
          .catch(done);
      });
    });

    it("cancel should fail if the promise is already canceled", done => {
      let cancelHandlerRunCount = 0;
      let hasReject = false;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onCancel(resolveCancel => {
            cancelHandlerRunCount += 1;
            resolveCancel();
          });
          setTimeout(resolve);
        }
      );

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          hasReject = true;
          assert.strictEqual(error.name, "ControllablePromiseCancelError");
        })
        .catch(done);

      const cancelPromise = cp.cancel();
      // assert(cp.lock)
      cancelPromise
        .then(() => {
          try {
            assert(cp.isCanceled);
            // assert(!cp.lock)
            assert.strictEqual(cancelHandlerRunCount, 1);
          } catch (error) {
            return done(error);
          }

          return cp.cancel();
        })
        .then(() => done(new Error("Should fail")))
        .catch(error => {
          assert(hasReject);
          assert(cp.isSettled);
          assert(cp.isCanceled);
          // assert(!cp.lock)
          assert.strictEqual(cancelHandlerRunCount, 1);
          assert.strictEqual(
            error.name,
            "ControllablePromisePreconditionError"
          );
          assert.strictEqual(error.message, "Promise was canceled");
          done();
        })
        .catch(done);
    });

    it("cancel should fail if the promise is currently canceling", done => {
      let cancelHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onCancel(resolveCancel => {
            cancelHandlerRunCount += 1;
            resolveCancel();
          });
          setTimeout(resolve);
        }
      );

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          // assert(!cp.lock)
          assert.strictEqual(error.name, "ControllablePromiseCancelError");
        })
        .catch(done);

      cp.cancel().catch(done);
      cp.cancel()
        .catch(error => {
          assert.strictEqual(cancelHandlerRunCount, 1);
          assert.strictEqual(
            error.name,
            "ControllablePromisePreconditionError"
          );
          assert.strictEqual(error.message, "Operation in progress");
          done();
        })
        .catch(done);
    });

    it("cancel should fail if the promise has settled during cancel handler", done => {
      let cancelHandlerRunCount = 0;
      let hasResolve = false;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onCancel(resolveCancel => {
            cancelHandlerRunCount += 1;
            setTimeout(resolveCancel, 50);
          });
          setTimeout(resolve);
        }
      );

      cp.then(() => (hasResolve = true)).catch(done);

      cp.cancel()
        .catch(error => {
          assert(hasResolve);
          assert.strictEqual(cancelHandlerRunCount, 1);
          assert.strictEqual(
            error.message,
            "Promise was settled during cancel handler"
          );
          done();
        })
        .catch(done);
    });

    it("if no onCancel handler, cancel when the promise is finished", done => {
      let processed = false;

      const cp = new ControllablePromise(resolve => {
        setTimeout(() => {
          processed = true;
          resolve();
        });
      });

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          assert.strictEqual(error.name, "ControllablePromiseCancelError");
          assert.strictEqual(
            error.message,
            "Controllable Promise was canceled"
          );
          done();
        })
        .catch(done);

      const cancelPromise = cp.cancel();
      // assert(cp.lock)
      cancelPromise
        .then(() => {
          assert(cp.isCanceled);
          // assert(!cp.lock)
          assert(processed);
        })
        .catch(done);
    });

    it("if no onCancel handler, cancel should fail if error occur in main promise", done => {
      const expectedMessage = "Fatal error";
      const cp = new ControllablePromise((resolve, reject) => {
        setTimeout(() => reject(new Error(expectedMessage)));
      });

      cp.then(() => done(new Error("Should fail"))).catch(() =>
        assert(cp.isRejected)
      );

      const cancelPromise = cp.cancel();
      // assert(cp.lock)
      cancelPromise
        .then(() => done(new Error("Should fail")))
        .catch(error => {
          assert(cp.isRejected);
          // assert(!cp.lock)
          assert.strictEqual(error.message, expectedMessage);
          done();
        })
        .catch(done);
    });
  });

  describe("pause", () => {
    it("pause", done => {
      let pauseHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
        }
      );

      cp.then(() => done(new Error("Should fail"))).catch(done);

      setTimeout(() => {
        const pausePromise = cp.pause();
        // assert(cp.lock)
        pausePromise
          .then(() => {
            assert(!cp.isResumed);
            assert(cp.isPaused);
            assert(!cp.isCanceled);
            assert(!cp.isRejected);
            assert(!cp.isFulfilled);
            assert(!cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(pauseHandlerRunCount, 1);
            done();
          })
          .catch(done);
      });
    });

    it("pause should fail if the promise is already settled", done => {
      let pauseHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
          resolve();
        }
      );

      cp.catch(done);

      setTimeout(() => {
        const pausePromise = cp.pause();
        // assert(!cp.lock)
        pausePromise
          .then(() => done(new Error("Should fail")))
          .catch(error => {
            assert(!cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(!cp.isRejected);
            assert(cp.isFulfilled);
            assert(cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(pauseHandlerRunCount, 0);
            assert.strictEqual(
              error.name,
              "ControllablePromisePreconditionError"
            );
            assert.strictEqual(error.message, "Promise was settled");
            done();
          })
          .catch(done);
      });
    });

    it("pause should fail if the promise is already rejected", done => {
      let pauseHandlerRunCount = 0;
      const expectedMessage = "Fatal error";
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
          reject(new Error(expectedMessage));
        }
      );

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          assert.strictEqual(error.message, expectedMessage);
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 0);
        })
        .catch(done);

      setTimeout(() => {
        const pausePromise = cp.pause();
        // assert(!cp.lock)
        pausePromise
          .then(() => done(new Error("Should fail")))
          .catch(error => {
            assert(!cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(cp.isRejected);
            assert(!cp.isFulfilled);
            assert(cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(pauseHandlerRunCount, 0);
            assert.strictEqual(error.message, "Promise was settled");
            done();
          })
          .catch(done);
      });
    });

    it("pause should fail if the promise is already canceled", done => {
      let pauseHandlerRunCount = 0;
      let cancelHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
          onCancel(resolveCancel => {
            cancelHandlerRunCount += 1;
            resolveCancel();
          });
          setTimeout(resolve);
        }
      );

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          assert.strictEqual(error.name, "ControllablePromiseCancelError");
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 0);
          assert.strictEqual(cancelHandlerRunCount, 1);
        })
        .catch(done);

      const cancelPromise = cp.cancel();
      // assert(cp.lock)
      cancelPromise
        .then(() => {
          try {
            assert(!cp.isResumed);
            assert(!cp.isPaused);
            assert(cp.isCanceled);
            assert(!cp.isRejected);
            assert(!cp.isFulfilled);
            assert(cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(pauseHandlerRunCount, 0);
            assert.strictEqual(cancelHandlerRunCount, 1);
            return cp.pause();
          } catch (err) {
            done(err);
          }
        })
        .then(() => done(new Error("Should fail")))
        .catch(() => done());
    });

    it("pause should fail if the promise is currently pausing", done => {
      let pauseHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
          setTimeout(resolve);
        }
      );

      cp.then(() => done(new Error("Should fail"))).catch(done);

      let shouldBeLockInSecond = true;

      const firstPausePromise = cp.pause();
      // assert(cp.lock)
      firstPausePromise
        .then(() => {
          assert(!cp.isResumed);
          assert(cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 1);
          shouldBeLockInSecond = false;
        })
        .catch(done);

      const secondPausePromise = cp.pause();
      // assert(cp.lock)
      secondPausePromise
        .catch(() => {
          assert.strictEqual(pauseHandlerRunCount, 1);
          // assert.strictEqual(cp.lock, shouldBeLockInSecond)
          done();
        })
        .catch(done);
    });

    it("if no onPause handler, pause when the promise is finished", done => {
      let processed = false;

      const cp = new ControllablePromise(resolve => {
        setTimeout(() => {
          processed = true;
          resolve();
        });
      });

      cp.then(() => done(new Error("Should not resolve or reject"))).catch(
        done
      );

      const pausePromise = cp.pause();
      // assert(cp.lock)
      pausePromise
        .then(() => {
          assert(!cp.isResumed);
          assert(cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          assert(processed);
          done();
        })
        .catch(done);
    });

    it("if no onPause handler, pause should fail if error occur in main promise", done => {
      const pauseHandlerRunCount = 0;
      const expectedMessage = "Fatal error";
      const cp = new ControllablePromise((resolve, reject) => {
        setTimeout(() => reject(new Error(expectedMessage)));
      });

      cp.then(() => done(new Error("Should fail")))
        .catch(() => {
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 0);
        })
        .catch(done);

      const pausePromise = cp.pause();
      // assert(cp.lock)
      pausePromise
        .then(() => done(new Error("Should fail")))
        .catch(error => {
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 0);
          assert.strictEqual(error.message, expectedMessage);
          done();
        })
        .catch(done);
    });
  });

  describe("resume", () => {
    it("resume", done => {
      let pauseHandlerRunCount = 0;
      let resumeHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
          onResume(resolveResume => {
            resumeHandlerRunCount += 1;
            resolveResume();
          });
        }
      );

      cp.then(() => done(new Error("Should not resolve or reject"))).catch(
        done
      );

      setTimeout(() => {
        cp.pause()
          .then(() => {
            assert.strictEqual(pauseHandlerRunCount, 1);

            const resumePromise = cp.resume();
            // assert(cp.lock)
            resumePromise
              .then(() => {
                assert(cp.isResumed);
                assert(!cp.isPaused);
                assert(!cp.isCanceled);
                assert(!cp.isRejected);
                assert(!cp.isFulfilled);
                assert(!cp.isSettled);
                // assert(!cp.lock)
                assert.strictEqual(pauseHandlerRunCount, 1);
                assert.strictEqual(resumeHandlerRunCount, 1);
                done();
              })
              .catch(done);
          })
          .catch(done);
      });
    });

    it("resume when already resumed", done => {
      let resumeHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume) => {
          onResume(resolveResume => {
            resumeHandlerRunCount += 1;
            resolveResume();
          });
        }
      );

      cp.then(() => done(new Error("Should not resolve or reject"))).catch(
        done
      );

      setTimeout(() => {
        const resumePromise = cp.resume();
        // assert(!cp.lock)
        resumePromise
          .then(() => {
            assert(cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(!cp.isRejected);
            assert(!cp.isFulfilled);
            assert(!cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(resumeHandlerRunCount, 0);
            done();
          })
          .catch(done);
      });
    });

    it("resume should unlock if handler has an error", done => {
      let pauseHandlerRunCount = 0;
      let resumeHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
          onResume((resolveResume, rejectResume) => {
            resumeHandlerRunCount += 1;
            rejectResume();
          });
        }
      );

      cp.then(() => done(new Error("Should not resolve or reject"))).catch(
        done
      );

      setTimeout(() => {
        cp.pause()
          .then(() => {
            assert.strictEqual(pauseHandlerRunCount, 1);

            const resumePromise = cp.resume();
            // assert(cp.lock)
            resumePromise
              .then(() => done(new Error("Should reject")))
              .catch(() => {
                assert(!cp.isResumed);
                assert(cp.isPaused);
                assert(!cp.isCanceled);
                assert(!cp.isRejected);
                assert(!cp.isFulfilled);
                assert(!cp.isSettled);
                // assert(!cp.lock)
                assert.strictEqual(pauseHandlerRunCount, 1);
                assert.strictEqual(resumeHandlerRunCount, 1);
                done();
              })
              .catch(done);
          })
          .catch(done);
      });
    });

    it("resume should fail if the promise is already fulfilled", done => {
      let resumeHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume) => {
          onResume(resolveResume => {
            resumeHandlerRunCount += 1;
            resolveResume();
          });
          resolve();
        }
      );

      cp.catch(done);

      setTimeout(() => {
        const resumePromise = cp.resume();
        // assert(!cp.lock)
        resumePromise
          .then(() => done(new Error("Should fail")))
          .catch(error => {
            assert(!cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(!cp.isRejected);
            assert(cp.isFulfilled);
            assert(cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(resumeHandlerRunCount, 0);
            assert.strictEqual(
              error.name,
              "ControllablePromisePreconditionError"
            );
            assert.strictEqual(error.message, "Promise was settled");
            done();
          })
          .catch(done);
      });
    });

    it("resume should fail if the promise is already rejected", done => {
      let resumeHandlerRunCount = 0;
      const expectedMessage = "Fatal error";
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume) => {
          onResume(resolveResume => {
            resumeHandlerRunCount += 1;
            resolveResume();
          });
          reject(new Error(expectedMessage));
        }
      );

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          assert.strictEqual(error.message, expectedMessage);
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
        })
        .catch(done);

      setTimeout(() => {
        const resumePromise = cp.resume();
        // assert(!cp.lock)
        resumePromise
          .then(() => done(new Error("Should fail")))
          .catch(error => {
            assert(!cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(cp.isRejected);
            assert(!cp.isFulfilled);
            assert(cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(resumeHandlerRunCount, 0);
            assert.strictEqual(
              error.name,
              "ControllablePromisePreconditionError"
            );
            assert.strictEqual(error.message, "Promise was settled");
            done();
          })
          .catch(done);
      });
    });

    it("resume should fail if the promise is already canceled", done => {
      let resumeHandlerRunCount = 0;
      let cancelHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onResume(resolveResume => {
            resumeHandlerRunCount += 1;
            resolveResume();
          });
          onCancel(resolveCancel => {
            cancelHandlerRunCount += 1;
            resolveCancel();
          });
          setTimeout(resolve);
        }
      );

      cp.then(() => done(new Error("Should fail"))).catch(error => {
        assert.strictEqual(error.name, "ControllablePromiseCancelError");
        assert(!cp.isResumed);
        assert(!cp.isPaused);
        assert(cp.isCanceled);
        assert(!cp.isRejected);
        assert(!cp.isFulfilled);
        assert(cp.isSettled);
        // assert(!cp.lock)
      });

      const cancelPromise = cp.cancel();
      // assert(cp.lock)
      cancelPromise
        .then(() => {
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(resumeHandlerRunCount, 0);
          assert.strictEqual(cancelHandlerRunCount, 1);

          const resumePromise = cp.resume();
          // assert(!cp.lock)
          return resumePromise;
        })
        .then(() => done(new Error("Should fail")))
        .catch(error => {
          // assert(!cp.lock)
          assert.strictEqual(resumeHandlerRunCount, 0);
          assert.strictEqual(cancelHandlerRunCount, 1);
          assert.strictEqual(
            error.name,
            "ControllablePromisePreconditionError"
          );
          assert.strictEqual(error.message, "Promise was canceled");
          done();
        })
        .catch(done);
    });

    it("resume should fail if the promise is currently resuming", done => {
      let resumeHandlerRunCount = 0;
      let hasResumed = false;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume) => {
          onResume(resolveResume => {
            setTimeout(() => {
              resumeHandlerRunCount += 1;
              resolveResume();
            }, 50);
          });
          setTimeout(() => resolve());
        }
      );

      cp.then(() => {
        assert(!cp.isResumed);
        assert(!cp.isPaused);
        assert(!cp.isCanceled);
        assert(!cp.isRejected);
        assert(cp.isFulfilled);
        assert(cp.isSettled);
        // assert(!cp.lock)
      }).catch(done);

      cp.pause().then(() => {
        const firstResumePromise = cp.resume();
        // assert(cp.lock)
        assert.strictEqual(resumeHandlerRunCount, 0);
        firstResumePromise
          .then(() => {
            assert(cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(!cp.isRejected);
            assert(!cp.isFulfilled);
            assert(!cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(resumeHandlerRunCount, 1);
            hasResumed = true;
          })
          .catch(done);

        // assert(cp.lock)
        const secondResumePromise = cp.resume();
        // assert(cp.lock)
        secondResumePromise
          .catch(error => {
            // assert.strictEqual(cp.lock, !hasResumed)
            assert.strictEqual(
              error.name,
              "ControllablePromisePreconditionError"
            );
            assert.strictEqual(error.message, "Operation in progress");
            done();
          })
          .catch(done);
      });
    });

    it("resume should fail if error occur in main promise", done => {
      let resumeHandlerRunCount = 0;
      const expectedMessage = "Fatal error";
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume) => {
          onResume(resolveResume =>
            setTimeout(() => {
              resumeHandlerRunCount += 1;
              resolveResume();
            }, 50)
          );
          setTimeout(() => reject(new Error(expectedMessage)));
        }
      );

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          assert.strictEqual(error.message, expectedMessage);
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
        })
        .catch(done);

      setTimeout(() => {
        const resumePromise = cp.resume();
        // assert(!cp.lock)
        resumePromise
          .then(() => done(new Error("Should fail")))
          .catch(error => {
            assert(!cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(cp.isRejected);
            assert(!cp.isFulfilled);
            assert(cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(resumeHandlerRunCount, 0);
            assert.strictEqual(
              error.name,
              "ControllablePromisePreconditionError"
            );
            assert.strictEqual(error.message, "Promise was settled");
            done();
          })
          .catch(done);
      });
    });

    it("if no onResume handler, should success when main promise resolve", done => {
      let processed = false;

      const cp = new ControllablePromise(resolve => {
        setTimeout(() => {
          processed = true;
          resolve();
        });
      });

      cp.then(() => {
        assert(!cp.isResumed);
        assert(!cp.isPaused);
        assert(!cp.isCanceled);
        assert(!cp.isRejected);
        assert(cp.isFulfilled);
        assert(cp.isSettled);
        // assert(!cp.lock)
      }).catch(done);

      const resumePromise = cp.resume();
      // assert(!cp.lock)
      resumePromise
        .then(() => {
          assert(cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          assert(!processed);

          setTimeout(() => {
            assert(!cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(!cp.isRejected);
            assert(cp.isFulfilled);
            assert(cp.isSettled);
            // assert(!cp.lock)
            done();
          }, 10);
        })
        .catch(done);
    });

    it("if no onPause handler, resume should fail if error occur in main promise", done => {
      const expectedMessage = "Fatal error";
      const cp = new ControllablePromise((resolve, reject) => {
        setTimeout(() => reject(new Error(expectedMessage)));
      });

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          assert.strictEqual(error.message, expectedMessage);
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
        })
        .catch(done);

      setTimeout(() => {
        const resumePromise = cp.resume();
        // assert(!cp.lock)
        resumePromise
          .then(() => done(new Error("Should fail")))
          .catch(error => {
            assert(!cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(cp.isRejected);
            assert(!cp.isFulfilled);
            assert(cp.isSettled);
            // assert(!cp.lock)
            assert.strictEqual(
              error.name,
              "ControllablePromisePreconditionError"
            );
            assert.strictEqual(error.message, "Promise was settled");
            done();
          })
          .catch(done);
      });
    });
  });

  describe("pause/resume/cancel", () => {
    it("pause then resume", done => {
      let pauseHandlerRunCount = 0;
      let resumeHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
          onResume(resolveResume => {
            resumeHandlerRunCount += 1;
            resolveResume();
          });
        }
      );

      cp.then(() => done(new Error("Should fail"))).catch(done);

      cp.pause()
        .then(() => {
          assert(!cp.isResumed);
          assert(cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 1);
          assert.strictEqual(resumeHandlerRunCount, 0);
          return cp.resume();
        })
        .then(() => {
          assert(cp.isResumed);
          assert(!cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 1);
          assert.strictEqual(resumeHandlerRunCount, 1);
          done();
        })
        .catch(done);
    });

    it("pause then pause", done => {
      let pauseHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
        }
      );

      cp.then(() => done(new Error("Should fail"))).catch(done);

      cp.pause()
        .then(() => {
          assert(!cp.isResumed);
          assert(cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 1);
          return cp.pause();
        })
        .then(() => {
          assert(!cp.isResumed);
          assert(cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 1);
          done();
        })
        .catch(done);
    });

    it("pause then cancel", done => {
      let pauseHandlerRunCount = 0;
      let cancelHandlerRunCount = 0;
      const cp = new ControllablePromise(
        (resolve, reject, progress, onPause, onResume, onCancel) => {
          onPause(resolvePause => {
            pauseHandlerRunCount += 1;
            resolvePause();
          });
          onCancel(resolveCancel => {
            cancelHandlerRunCount += 1;
            resolveCancel();
          });
        }
      );

      cp.then(() => done(new Error("Should fail")))
        .catch(error => {
          assert.strictEqual(error.name, "ControllablePromiseCancelError");
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
        })
        .catch(done);

      cp.pause()
        .then(() => {
          assert(!cp.isResumed);
          assert(cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 1);
          assert.strictEqual(cancelHandlerRunCount, 0);
          return cp.cancel();
        })
        .then(() => {
          assert(!cp.isResumed);
          assert(!cp.isPaused);
          assert(cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(cp.isSettled);
          // assert(!cp.lock)
          assert.strictEqual(pauseHandlerRunCount, 1);
          assert.strictEqual(cancelHandlerRunCount, 1);
          done();
        })
        .catch(done);
    });

    it("if no handlers, paused/finished promise should resolve when resumed", done => {
      const cp = new ControllablePromise(resolve => {
        setTimeout(resolve);
      });

      cp.catch(done);

      cp.pause()
        .then(() => {
          assert(!cp.isResumed);
          assert(cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)
          return cp.resume();
        })
        .then(() => {
          assert(cp.isResumed);

          setTimeout(() => {
            assert(!cp.isResumed);
            assert(!cp.isPaused);
            assert(!cp.isCanceled);
            assert(!cp.isRejected);
            assert(cp.isFulfilled);
            assert(cp.isSettled);
            // assert(!cp.lock)
            done();
          });
        })
        .catch(done);
    });

    it("if no handler, main promise should not resolve if paused and no resume", done => {
      const cp = new ControllablePromise(resolve => {
        setTimeout(resolve);
      });

      cp.then(() => done(new Error("Should fail"))).catch(done);

      cp.pause()
        .then(() => {
          assert(!cp.isResumed);
          assert(cp.isPaused);
          assert(!cp.isCanceled);
          assert(!cp.isRejected);
          assert(!cp.isFulfilled);
          assert(!cp.isSettled);
          // assert(!cp.lock)

          setTimeout(() => {
            assert(!cp.isResumed);
            assert(cp.isPaused);
            assert(!cp.isCanceled);
            assert(!cp.isRejected);
            assert(!cp.isFulfilled);
            assert(!cp.isSettled);
            // assert(!cp.lock)
            done();
          });
        })
        .catch(done);
    });
  });
});
