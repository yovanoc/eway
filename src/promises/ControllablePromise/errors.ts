/**
 * @class ControllablePromiseCancelError
 * @extends {Error}
 */
export class ControllablePromiseCancelError extends Error {
  /**
   * Creates an instance of ControllablePromiseCancelError.CancelError
   */
  constructor() {
    super('Controllable Promise was canceled')
    this.name = 'ControllablePromiseCancelError'
  }
}

/**
 * @class ControllablePromisePreconditionError
 * @extends {Error}
 */
// tslint:disable-next-line:max-classes-per-file
export class ControllablePromisePreconditionError extends Error {
  /**
   * Creates an instance of ControllablePromiseCancelError.CancelError
   * @argument {String} message - The error message
   */
  constructor(message: string) {
    super(message)
    this.name = 'ControllablePromisePreconditionError'
  }
}
