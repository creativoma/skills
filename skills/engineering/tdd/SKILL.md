---
name: tdd
description: Test-driven development. Use when the user wants to build features or fix bugs test-first, mentions "red-green-refactor", or wants integration tests. Also covers AI-assisted test generation and mutation testing mindset.
---

# Test-Driven Development

TDD is the red → green loop. This skill is the reference that makes that loop produce tests worth keeping: what a good test is, where tests go, the anti-patterns, and the rules of the loop. Every section applies on every cycle — consult them before and during the loop, not after.

When exploring the codebase, read `CONTEXT.md` (if it exists) so test names and interface vocabulary match the project's domain language, and respect ADRs in the area you're touching.

## What a good test is

Tests verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't. A good test reads like a specification — "user can checkout with valid cart" tells you exactly what capability exists — and survives refactors because it doesn't care about internal structure.

See [tests.md](tests.md) for examples and [mocking.md](mocking.md) for mocking guidelines.

## AI + Tests: The Trap

When you ask AI to generate tests for existing code, it reads the implementation and validates its behavior. It does not question it. It cannot.

This produces tests that are green by construction. 100% coverage. Zero confidence.

**The trap**: AI writes tests after the fact → tests confirm what the code does → no test ever catches the bug the code already has.

**The fix — intention-first generation**:

1. Write what the function *should* do in plain language (the spec)
2. Ask AI to generate tests from the spec, not from the code
3. Write or adjust the implementation to pass those tests
4. Verify the tests can actually fail (see [mutation.md](mutation.md))

When prompting AI for tests, give it the intent:

```
❌  "Generate tests for this function: [paste code]"

✅  "Generate tests for a function that:
     - formats a price with currency symbol
     - always shows exactly two decimal places
     - throws on negative amounts
     - supports EUR and USD"
```

The second prompt cannot be answered by reading the code. It forces the AI to reason from requirements. Those tests will catch things the implementation got wrong.

After AI generates tests, always ask: **"What would I need to change in the implementation to make each of these tests fail?"** If the answer is "nothing obvious", the test is too weak.

## Test Quality Gate: Can This Test Fail?

Before accepting any test (AI-generated or hand-written), verify it can actually detect a broken implementation.

**Manual mutation check** — make each of these changes to the implementation, one at a time, and confirm the test fails:

- Change `===` to `!==` (or flip any condition)
- Remove a boundary check (`<=` → `<`, `>` → `>=`)
- Delete a line of logic entirely
- Replace a constant with a wrong value
- Swap two branches of an if/else

If the test still passes after any of these changes, it is not protecting you.

```typescript
// Original
function formatPrice(amount: number, currency: 'EUR' | 'USD'): string {
  const symbols = { EUR: '€', USD: '$' }
  return `${symbols[currency]}${amount.toFixed(2)}`
}

// Mutation: remove toFixed
return `${symbols[currency]}${amount}` // ← test must catch this

// Mutation: wrong symbol
const symbols = { EUR: '$', USD: '€' } // ← test must catch this
```

A test suite that survives these mutations is not a test suite. Improve the tests before moving on.

For systematic mutation testing at scale, see [mutation.md](mutation.md).

## Seams — where tests go

A **seam** is the public boundary you test at: the interface where you observe behavior without reaching inside. Tests live at seams, never against internals.

**Test only at pre-agreed seams.** Before writing any test, write down the seams under test and confirm them with the user. No test is written at an unconfirmed seam. You can't test everything — agreeing the seams up front is how testing effort lands on the critical paths and complex logic instead of every edge case.

Ask: "What's the public interface, and which seams should we test?"

When the shape of that interface is itself in question — how deep the module is, where the seam belongs, what the interface should expose — use the `/codebase-design` skill for the vocabulary. It is the shared source of the module, interface, depth, seam, adapter, leverage and locality terms, and it is a reference to consult, not a session to run.

## Anti-patterns

- **Implementation-coupled** — mocks internal collaborators, tests private methods, or verifies through a side channel (querying the database instead of using the interface). The tell: the test breaks when you refactor but behavior hasn't changed.
- **Tautological** — the assertion recomputes the expected value the way the code does (`expect(add(a, b)).toBe(a + b)`, a snapshot derived by hand the same way, a constant asserted equal to itself), so it passes by construction and can never disagree with the code. Expected values must come from an independent source of truth — a known-good literal, a worked example, the spec.
- **Horizontal slicing** — writing all tests first, then all implementation. Bulk tests verify _imagined_ behavior: you test the _shape_ of things rather than user-facing behavior, the tests go insensitive to real changes, and you commit to test structure before understanding the implementation. Work in **vertical slices** instead — one test → one implementation → repeat, each test a **tracer bullet** that responds to what the last cycle taught you.

## Rules of the loop

- **Red before green.** Write the failing test first, then only enough code to pass it. Don't anticipate future tests or add speculative features.
- **One slice at a time.** One seam, one test, one minimal implementation per cycle.
- **Verify the test can fail.** After each green cycle, apply one mutation (flip a condition, delete a line, change a value) and confirm the test turns red before reverting it. If no mutation breaks the test, the test is incomplete — see [mutation.md](mutation.md).
- **Refactoring is not part of the loop.** It belongs to the review stage (see the `code-review` skill), not the red → green implementation cycle.
