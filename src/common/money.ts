// Amounts travel through the API as decimal strings and are stored as integer minor units.
// USD, EUR and KZT all have two decimal places

// '123.45' -> 12345n
export function toMinor (decimal: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(decimal)

  if (!match) {
    throw new Error(`Invalid money amount: ${decimal}`)
  }

  return BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'))
}

// 12345n -> '123.45'
export function toDecimal (minor: bigint): string {
  return `${minor / 100n}.${(minor % 100n).toString().padStart(2, '0')}`
}
