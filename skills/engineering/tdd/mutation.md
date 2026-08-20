# Mutation Testing

Mutation testing answers the question: **"If I break this code, does the test catch it?"**

A test that passes even when the code is wrong is not a test. It is noise.

## The Mental Model

A _mutant_ is a small deliberate change to the implementation:

- Flip a condition: `>` → `>=`, `&&` → `||`
- Negate a return: `return true` → `return false`
- Delete a line of logic
- Replace a constant with a wrong value
- Swap two branches

A _surviving mutant_ means a bug could exist in your code and your tests would not catch it. That is a gap.

## Manual Mutation (Do This Every Cycle)

Before accepting a test, introduce one or two mutations manually and confirm the test turns RED.

Pick mutations that target the core invariant of the function:

```typescript
// Function: formatPrice always shows two decimals
// Mutation 1: remove toFixed
return `${symbols[currency]}${amount}`
// → test for formatPrice(10, 'EUR') must fail

// Mutation 2: wrong symbol mapping
const symbols = { EUR: '$', USD: '€' }
// → test for currency symbol must fail

// Mutation 3: no throw on negative
if (amount < 0) return `${symbols[currency]}0.00` // instead of throw
// → test for negative amounts must fail
```

If none of these break a test, the test suite has a gap. Fix the tests before reverting.

## When to Run a Mutation Testing Tool

Manual mutation is enough for most cycles. Use a tool (Stryker, Vitest mutation) when:

- You have 100% line/branch coverage but low confidence
- A bug escaped to production despite green tests
- You want to audit an existing test suite before a major refactor
- A critical module needs hardened coverage (payment, auth, data integrity)

Do NOT run it on every commit — it is slow and expensive. Use it as a periodic audit or before a release.

## Reading Tool Results

**Killed mutant** — the test caught the change. Good.

**Surviving mutant** — no test detected the change. Investigate:
  1. Is the behavior this mutant covers actually important?
  2. If yes: add a test that targets this specific invariant
  3. If no: accept the surviving mutant and document why

Not every surviving mutant needs a new test. Some code paths are genuinely not worth covering. The value is in making the decision consciously.

## Stryker (JavaScript/TypeScript)

```bash
npx stryker run
```

Config (`stryker.config.mjs`):

```js
export default {
  mutate: ['src/**/*.ts', '!src/**/*.test.ts'],
  testRunner: 'vitest',
  reporters: ['html', 'clear-text'],
  thresholds: { high: 80, low: 60, break: 50 },
}
```

Start with a threshold of 60 on existing projects. Raise it as you improve.

## Common Surviving Mutant Patterns and Fixes

**Boundary condition survivors** — `<` vs `<=`, `>` vs `>=`

```typescript
// Surviving: changing d.getTime() <= Date.now() to d.getTime() < Date.now()
// Fix: add a test at the exact boundary
test('rejects a date equal to now', () => {
  const now = new Date().toISOString()
  expect(isValidDate(now)).toBe(false)
})
```

**Logical operator survivors** — `&&` vs `||`

```typescript
// Surviving: changing (a && b) to (a || b)
// Fix: add a test where only one condition is true
test('requires both conditions', () => {
  expect(validate({ active: true, verified: false })).toBe(false)
  expect(validate({ active: false, verified: true })).toBe(false)
})
```

**Return value survivors** — function returns wrong type or value

```typescript
// Surviving: changing return [] to return null
// Fix: assert on the shape of the return value
test('returns an empty array, not null, when no results', () => {
  const result = search('')
  expect(Array.isArray(result)).toBe(true)
  expect(result).toHaveLength(0)
})
```
