import { ControllablePromise } from "../../";

export interface IPromiseQueuItem<T> {
  promiseGenerator: () => ControllablePromise<T>;
  resolve: (value?: T | PromiseLike<T>) => void;
  reject: (reason: any) => void;
}

export interface IPromiseQueueOptions {
  onEmpty?: () => void;
}

export default class ControllablePromiseQueue<T> {

  private maxPendingPromises: number;
  private maxQueuedPromises: number;
  private options: IPromiseQueueOptions;
  private pendingPromises: number;
  private queue: Array<IPromiseQueuItem<T>>;

  constructor(maxPendingPromises: number = Infinity, maxQueuedPromises: number = Infinity, options: IPromiseQueueOptions = {}) {
    this.options = options;
    this.pendingPromises = 0;
    this.maxPendingPromises = maxPendingPromises;
    this.maxQueuedPromises = maxQueuedPromises;
    this.queue = [];
  }

  public add(promiseGenerator: () => ControllablePromise<T>): ControllablePromise<T> {
    return new ControllablePromise<T>((resolve, reject) => {
      // Do not queue to much promises
      if (this.queue.length >= this.maxQueuedPromises) {
        return reject(new Error('Queue limit reached'));
      }

      // Add to queue
      this.queue.push({
        promiseGenerator,
        resolve,
        reject
      });

      this._dequeue();
    });
  }

  /**
   * Number of simultaneously running promises (which are resolving)
   *
   * @return {number}
   */
  public getPendingLength(): number {
    return this.pendingPromises;
  }

  /**
   * Number of queued promises (which are waiting)
   *
   * @return {number}
   */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /**
   * @returns {boolean} true if first item removed from queue
   * @private
   */
  private _dequeue(): boolean {
    if (this.pendingPromises >= this.maxPendingPromises) {
      return false;
    }

    // Remove from queue
    const item = this.queue.shift();
    if (!item) {
      if (this.options.onEmpty) {
        this.options.onEmpty();
      }
      return false;
    }

    try {
      this.pendingPromises++;

      item.promiseGenerator()
        // Forward all stuff
        .then(value => {
          // It is not pending now
          this.pendingPromises--;
          // It should pass values
          item.resolve(value);
          this._dequeue();
        }, err => {
          // It is not pending now
          this.pendingPromises--;
          // It should not mask errors
          item.reject(err);
          this._dequeue();
        });
    } catch (err) {
      this.pendingPromises--;
      item.reject(err);
      this._dequeue();
    }

    return true;
  }
}
