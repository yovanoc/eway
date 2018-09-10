import { isArray, isFunction } from 'util';
import ControllablePromise from '.';

export interface IControllablePromiseQueueOptions {
  concurrency: number;
}

export type promiseToAdd<T> = (() => ControllablePromise<T>) | (Array<() => ControllablePromise<T>>)

export default class ControllablePromiseQueue {

  // Promises which are not ready yet to run in the queue.
  get waitingCount() {
    return this.queue.length;
  }

  // Promises which are running but not done.
  get ongoingCount() {
    return this.mOngoingCount;
  }

  private queue: Array<() => void>;
  private paused: boolean;
  private mOngoingCount: number;
  private concurrency: number;
  private resolveEmpty: () => void;

  constructor(opts: IControllablePromiseQueueOptions) {
    this.queue = [];
    this.paused = false;
    opts = {
      concurrency: 1, ...opts
    };

    if (opts.concurrency < 1) {
      throw new TypeError('Expected `concurrency` to be an integer which is bigger than 0');
    }

    this.mOngoingCount = 0;
    this.concurrency = opts.concurrency;
    this.resolveEmpty = () => { /**/ };
  }

  public pause() {
    this.paused = true;
  }

  public resume() {
    this.paused = false;
    this._next();
  }

  public add<T>(fn: promiseToAdd<T>): ControllablePromiseQueue {
    if (isArray(fn) && fn.every(isFunction)) {
      return fn.length > 1 ? this.add(fn.shift()).add(fn) : this.add(fn[0]);
    } else if (isFunction(fn)) {
      const p = new ControllablePromise<T>((resolve, reject) => {
        const run = () => {
          this.mOngoingCount++;
          (fn as () => ControllablePromise<T>)().then(
            (val) => {
              resolve(val);
              this._next();
            },
            (err) => {
              reject(err);
              this._next();
            },
          );
        };

        if (this.mOngoingCount < this.concurrency && !this.paused) {
          run();
        } else {
          this.queue.push(run);
        }
      });
      return this;
    } else {
      // tslint:disable-next-line:max-line-length
      throw new TypeError('Expected `arg` in add(arg) must be a function which return a Promise, or an array of function which return a Promise');
    }
  }

  private _next() {
    if (this.paused) {
      return;
    }

    this.mOngoingCount--;

    if (this.queue.length > 0) {
      this.queue.shift()!();
    } else {
      this.resolveEmpty();
    }
  }
}
