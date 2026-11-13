import { Transform } from 'class-transformer';

// UUIDs are case-insensitive and PostgreSQL always returns them in lower case. Bringing an
// incoming id to that form at the boundary lets the rest of the code compare ids as plain strings.
// A value that is not a string is left for the validators to reject
export function LowercaseUuid () {
  return Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.toLowerCase() : value)
}
