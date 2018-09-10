export interface IControllable<T> {
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
}

export type PromiseExecutor<T> =
  (
    resolve: (value?: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void
  ) => void;

export type ControllablePromiseExecutor<T> =
  (
    resolve: (value?: T | PromiseLike<T>) => void,
    reject: (reason?: any) => void,
    progress: (stats?: any) => void,
    onPause: (executor: PromiseExecutor<void>) => void,
    onResume: (executor: PromiseExecutor<void>) => void,
    onCancel: (executor: PromiseExecutor<void>) => void
  ) => void;

export enum ControllablePromiseState {
  RESUMED,
  PAUSED,
  FULFILLED,
  CANCELED,
  REJECTED
}
