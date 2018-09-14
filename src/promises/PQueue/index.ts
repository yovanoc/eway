import { ControllablePromise, IPriorityQueueOptions, PriorityQueue } from "../..";

export interface IPQueueOptions {
  carryoverConcurrencyCount?: boolean;
  intervalCap?: number;
  interval?: number;
  concurrency?: number;
  autoStart?: boolean;
  queueClass?: typeof PriorityQueue;
}

export class PQueue {
  public isPaused: boolean;

  private carryoverConcurrencyCount: boolean;
  private isIntervalIgnored: boolean;
  private intervalCount: number;
  private intervalCap: number;
  private interval: number;
  private intervalId: NodeJS.Timer;
  private intervalEnd: number;
  private timeoutId: NodeJS.Timer;
  private queue: PriorityQueue;
  private queueClass: typeof PriorityQueue;
  private pendingCount: number;
  private concurrency: number;
  private resolveEmpty: () => void;
  private resolveIdle: () => void;

  constructor(options?: IPQueueOptions) {
    options = {
      carryoverConcurrencyCount: false,
      intervalCap: Infinity,
      interval: 0,
      concurrency: Infinity,
      autoStart: true,
      queueClass: PriorityQueue,
      ...options
    };

    if (!(typeof options.concurrency === 'number' && options.concurrency >= 1)) {
      throw new TypeError(`Expected \`concurrency\` to be a number from 1 and up, got \`${options.concurrency}\` (${typeof options.concurrency})`);
    }

    if (!(typeof options.intervalCap === 'number' && options.intervalCap >= 1)) {
      throw new TypeError(`Expected \`intervalCap\` to be a number from 1 and up, got \`${options.intervalCap}\` (${typeof options.intervalCap})`);
    }

    if (!(typeof options.interval === 'number' && Number.isFinite(options.interval) && options.interval >= 0)) {
      throw new TypeError(`Expected \`interval\` to be a finite number >= 0, got \`${options.interval}\` (${typeof options.interval})`);
    }

    this.carryoverConcurrencyCount = options.carryoverConcurrencyCount;
    this.isIntervalIgnored = options.intervalCap === Infinity || options.interval === 0;
    this.intervalCount = 0;
    this.intervalCap = options.intervalCap;
    this.interval = options.interval;
    this.intervalId = null;
    this.intervalEnd = 0;
    this.timeoutId = null;

    this.queue = new options.queueClass();
    this.queueClass = options.queueClass;
    this.pendingCount = 0;
    this.concurrency = options.concurrency;
    this.isPaused = options.autoStart === false;
    this.resolveEmpty = () => { /**/ };
    this.resolveIdle = () => { /**/ };
  }

  public add<T>(fn: () => ControllablePromise<T>, options?: IPriorityQueueOptions): ControllablePromise<T> {
    return new ControllablePromise<T>((resolve, reject, progress, onPause, onResume, onCancel) => {
      const run = () => {
        this.pendingCount++;
        this.intervalCount++;

        try {
          const fnn = fn();
          onPause(fnn.pause)
          onResume(fnn.resume)
          onCancel(fnn.cancel)
          fnn.onProgress(progress);
          fnn.then(
            val => {
              resolve(val);
              this._next();
            },
            err => {
              reject(err);
              this._next();
            }
          );
        } catch (err) {
          reject(err);
          this._next();
        }
      };

      this.queue.enqueue(run, options);
      this._tryToStartAnother();
    });
  }

  public addAll<T>(fns: Array<() => ControllablePromise<T>>, options?: IPriorityQueueOptions): Array<ControllablePromise<T>> {
    return fns.map(fn => this.add(fn, options));
  }

  public start() {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;
    while (this._tryToStartAnother()) { /**/ }
  }

  public pause() {
    this.isPaused = true;
  }

  public clear() {
    this.queue = new this.queueClass();
  }

  public onEmpty() {
    // Instantly resolve if the queue is empty
    if (this.queue.size === 0) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      const existingResolve = this.resolveEmpty;
      this.resolveEmpty = () => {
        existingResolve();
        resolve();
      };
    });
  }

  public onIdle() {
    // Instantly resolve if none pending and if nothing else is queued
    if (this.pendingCount === 0 && this.queue.size === 0) {
      return Promise.resolve();
    }

    return new Promise<void>(resolve => {
      const existingResolve = this.resolveIdle;
      this.resolveIdle = () => {
        existingResolve();
        resolve();
      };
    });
  }

  get size() {
    return this.queue.size;
  }

  get pending() {
    return this.pendingCount;
  }

  private get _doesIntervalAllowAnother() {
    return this.isIntervalIgnored || this.intervalCount < this.intervalCap;
  }

  private get _doesConcurrentAllowAnother() {
    return this.pendingCount < this.concurrency;
  }

  private _next() {
    this.pendingCount--;
    this._tryToStartAnother();
  }

  private _resolvePromises() {
    this.resolveEmpty();
    this.resolveEmpty = () => { /**/ };

    if (this.pendingCount === 0) {
      this.resolveIdle();
      this.resolveIdle = () => { /**/ };
    }
  }

  private _onResumeInterval() {
    this._onInterval();
    this._initializeIntervalIfNeeded();
    this.timeoutId = null;
  }

  private intervalPaused() {
    const now = Date.now();

    if (this.intervalId === null) {
      const delay = this.intervalEnd - now;
      if (delay < 0) {
        // Act as the interval was done
        // We don't need to resume it here,
        // because it'll be resumed on line 160
        this.intervalCount = (this.carryoverConcurrencyCount) ? this.pendingCount : 0;
      } else {
        // Act as the interval is pending
        if (this.timeoutId === null) {
          this.timeoutId = setTimeout(() => this._onResumeInterval(), delay);
        }

        return true;
      }
    }

    return false;
  }

  private _tryToStartAnother() {
    if (this.queue.size === 0) {
      // We can clear the interval ("pause")
      // because we can redo it later ("resume")
      clearInterval(this.intervalId);
      this.intervalId = null;

      this._resolvePromises();

      return false;
    }

    if (!this.isPaused) {
      const canInitializeInterval = !this.intervalPaused();
      if (this._doesIntervalAllowAnother && this._doesConcurrentAllowAnother) {
        this.queue.dequeue()();
        if (canInitializeInterval) {
          this._initializeIntervalIfNeeded();
        }

        return true;
      }
    }

    return false;
  }

  private _initializeIntervalIfNeeded() {
    if (this.isIntervalIgnored || this.intervalId !== null) {
      return;
    }

    this.intervalId = setInterval(() => this._onInterval(), this.interval);
    this.intervalEnd = Date.now() + this.interval;
  }

  private _onInterval() {
    if (this.intervalCount === 0 && this.pendingCount === 0) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.intervalCount = (this.carryoverConcurrencyCount) ? this.pendingCount : 0;
    while (this._tryToStartAnother()) { /**/ }
  }
}
