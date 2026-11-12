// Thrown by a repository when the storage rejects a row that breaks a unique constraint.
// Services turn it into the 409 that fits the request
export class UniqueViolationError extends Error {
  constructor (options?: ErrorOptions) {
    super('Unique constraint violated', options)
    this.name = 'UniqueViolationError'
  }
}
