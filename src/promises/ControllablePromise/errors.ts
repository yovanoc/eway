export class ControllablePromiseCancelError extends Error {
  constructor() {
    super('Controllable Promise was canceled')
    this.name = 'ControllablePromiseCancelError'
  }
}

// tslint:disable-next-line:max-classes-per-file
export class ControllablePromisePreconditionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ControllablePromisePreconditionError'
  }
}
