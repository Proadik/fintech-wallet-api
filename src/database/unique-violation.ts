import { UniqueViolationError } from '../common/errors/unique-violation.error.js';

// https://www.postgresql.org/docs/current/errcodes-appendix.html
const PG_UNIQUE_VIOLATION = '23505'

// Drizzle wraps the driver's error, so the Postgres code sits somewhere in the cause chain
function isUniqueViolation (error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if ('code' in e && e.code === PG_UNIQUE_VIOLATION) {
      return true
    }
  }

  return false
}

export async function rethrowUniqueViolation<T> (query: Promise<T>): Promise<T> {
  try {
    return await query
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new UniqueViolationError({ cause: error })
    }

    throw error
  }
}
