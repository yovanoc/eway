import {
  ControllablePromiseCancelError,
  ControllablePromisePreconditionError
} from "./errors";
import {
  ControllablePromiseExecutor,
  ControllablePromiseState,
  IControllable,
  PromiseExecutor
} from "./types";

export class ControllablePromise<T> implements IControllable<T> {
  /**
   * @readonly
   * @returns {boolean} - True is the controllable promise is paused
   */
  get isPaused(): boolean {
    return this.state === ControllablePromiseState.PAUSED;
  }

  /**
   * @readonly
   * @returns {boolean} - True is the controllable promise is resumed
   */
  get isResumed(): boolean {
    return this.state === ControllablePromiseState.RESUMED;
  }

  /**
   * @readonly
   * @returns {boolean} - True is the controllable promise is canceled
   */
  get isCanceled(): boolean {
    return this.state === ControllablePromiseState.CANCELED;
  }

  /**
   * @readonly
   * @returns {boolean} - True is the controllable promise is rejected
   */
  get isRejected(): boolean {
    return this.state === ControllablePromiseState.REJECTED;
  }

  /**
   * @readonly
   * @returns {boolean} - True is the controllable promise is fulfilled
   */
  get isFulfilled(): boolean {
    return this.state === ControllablePromiseState.FULFILLED;
  }

  /**
   * @readonly
   * @returns {boolean} - True is the controllable promise is canceled, rejected or fulfilled
   */
  get isSettled(): boolean {
    return (
      this.state === ControllablePromiseState.CANCELED ||
      this.state === ControllablePromiseState.REJECTED ||
      this.state === ControllablePromiseState.FULFILLED
    );
  }

  private lock: boolean;
  private state: ControllablePromiseState;
  private listeners: Set<(stats?: any) => void>;

  private promise: Promise<T>;

  private pauseFn!: PromiseExecutor<void>;
  private resumeFn!: PromiseExecutor<void>;
  private cancelFn!: PromiseExecutor<void>;

  constructor(executor: ControllablePromiseExecutor<T>) {
    this.lock = false;
    this.state = ControllablePromiseState.RESUMED;

    // A controllable promise can have multiple onProgress handlers
    this.listeners = new Set();

    this.promise = new Promise<T>((resolveMain, rejectMain) => {
      this.rejectMain = rejectMain;

      const resolve = (value?: T | PromiseLike<T>) => {
        // We resolve pause and cancel in case of atomic controllable promise
        this.resolvePause();
        this.resolveCancel();
        // Next event loop
        setImmediate(() => {
          if (this.isCanceled) {
            return rejectMain(new ControllablePromiseCancelError());
          }
          // If a resolve() is requested while in paused state,
          // we defer the fulfillment to the next resume()
          const fulfillMain = () => {
            this.state = ControllablePromiseState.FULFILLED;
            resolveMain(value);
          };
          if (!this.isPaused) {
            fulfillMain();
          } else {
            this.resolveMain = fulfillMain;
          }
        });
      };

      const reject = (reason: any) => {
        this.rejectPause(reason);
        this.rejectCancel(reason);
        this.state = ControllablePromiseState.REJECTED;
        rejectMain(reason);
      };

      const onProgress = (stats?: any) => {
        this.listeners.forEach(listener => listener(stats));
      };

      const pause = (pauseFn: PromiseExecutor<void>) =>
        (this.pauseFn = pauseFn);
      const resume = (resumeFn: PromiseExecutor<void>) =>
        (this.resumeFn = resumeFn);
      const cancel = (cancelFn: PromiseExecutor<void>) =>
        (this.cancelFn = cancelFn);

      return executor(resolve, reject, onProgress, pause, resume, cancel);
    });
  }

  public pause() {
    return new Promise<void>((resolvePause, rejectPause) => {
      if (this.lock) {
        return rejectPause(
          new ControllablePromisePreconditionError("Operation in progress")
        );
      }
      if (this.isCanceled) {
        return rejectPause(
          new ControllablePromisePreconditionError("Promise was canceled")
        );
      }
      if (this.isSettled) {
        return rejectPause(
          new ControllablePromisePreconditionError("Promise was settled")
        );
      }
      if (this.isPaused) {
        return resolvePause();
      }

      this.lock = true;

      if (typeof this.pauseFn !== "function") {
        // No callback is provided for onPause
        this.resolvePause = resolvePause;
        this.rejectPause = rejectPause;
      } else {
        this.pauseFn(resolvePause, rejectPause);
      }
    })
      .then(() => {
        this.lock = false;
        this.state = ControllablePromiseState.PAUSED;
      })
      .catch(error => {
        if (!(error instanceof ControllablePromisePreconditionError)) {
          this.lock = false;
        }

        throw error;
      });
  }

  public resume() {
    return new Promise<void>((resolveResume, rejectResume) => {
      if (this.lock) {
        return rejectResume(
          new ControllablePromisePreconditionError("Operation in progress")
        );
      }
      if (this.isCanceled) {
        return rejectResume(
          new ControllablePromisePreconditionError("Promise was canceled")
        );
      }
      if (this.isSettled) {
        return rejectResume(
          new ControllablePromisePreconditionError("Promise was settled")
        );
      }
      if (this.isResumed) {
        return resolveResume();
      }

      if (typeof this.resumeFn !== "function") {
        // No callback is provided for onResume
        // We resolve pause promise if main promise is finished
        this.resolvePause();
        resolveResume();

        // We resolve main promise if it is finished
        this.resolveMain();
        return;
      }

      this.lock = true;
      this.resumeFn(resolveResume, rejectResume);
    })
      .then(() => {
        this.lock = false;
        this.state = ControllablePromiseState.RESUMED;
      })
      .catch(error => {
        if (!(error instanceof ControllablePromisePreconditionError)) {
          this.lock = false;
        }

        throw error;
      });
  }

  public cancel() {
    return new Promise<void>((resolveCancel, rejectCancel) => {
      if (this.lock) {
        return rejectCancel(
          new ControllablePromisePreconditionError("Operation in progress")
        );
      }
      if (this.isCanceled) {
        return rejectCancel(
          new ControllablePromisePreconditionError("Promise was canceled")
        );
      }
      if (this.isSettled) {
        return rejectCancel(
          new ControllablePromisePreconditionError("Promise was settled")
        );
      }
      if (this.isCanceled) {
        return resolveCancel();
      }

      this.lock = true;

      if (typeof this.cancelFn !== "function") {
        // No callback is provided for onCancel
        this.resolveCancel = resolveCancel;
        this.rejectCancel = rejectCancel;
        return;
      }

      this.cancelFn(resolveCancel, rejectCancel);
    })
      .then(() => {
        this.lock = false;

        if (typeof this.cancelFn === "function" && this.isSettled) {
          throw new Error("Promise was settled during cancel handler");
        }

        this.state = ControllablePromiseState.CANCELED;
        this.rejectMain(new ControllablePromiseCancelError());
      })
      .catch(error => {
        if (!(error instanceof ControllablePromisePreconditionError)) {
          this.lock = false;
        }

        throw error;
      });
  }

  public onProgress(cb: (stats?: any) => void): ControllablePromise<T> {
    if (typeof cb !== "function") {
      throw new TypeError(`Expected a Function, got ${typeof cb}`);
    }
    this.listeners.add(cb);
    return this;
  }

  public then<TResult1 = T, TResult2 = never>(
    onfulfilled?:
      | ((value: T) => TResult1 | PromiseLike<TResult1>)
      | undefined
      | null,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | undefined
      | null
  ): Promise<TResult1 | TResult2> {
    return this.promise.then(onfulfilled, onrejected);
  }

  public catch<TResult = never>(
    onrejected?:
      | ((reason: any) => TResult | PromiseLike<TResult>)
      | undefined
      | null
  ): Promise<T | TResult> {
    return this.promise.catch(onrejected);
  }

  private resolveMain = () => {
    /**/
  };
  private rejectMain = (reason: any) => {
    /**/
  };

  // These function will be called in case of 'atomic controllable promises'
  private resolvePause = () => {
    /**/
  };
  private rejectPause = (reason: any) => {
    /**/
  };
  private resolveCancel = () => {
    /**/
  };
  private rejectCancel = (reason: any) => {
    /**/
  };
}
