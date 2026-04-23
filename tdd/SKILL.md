---
name: tdd
description: Test-driven development with red-green-refactor loop. Use when user wants to build features or fix bugs using TDD, mentions "red-green-refactor", wants integration tests, or asks for test-first development. Also covers AI-assisted test generation and mutation testing mindset.
---

# Test-Driven Development

## Philosophy

**Core principle**: Tests should verify behavior through public interfaces, not implementation details. Code can change entirely; tests shouldn't.

**Good tests** are integration-style: they exercise real code paths through public APIs. They describe _what_ the system does, not _how_ it does it. A good test reads like a specification - "user can checkout with valid cart" tells you exactly what capability exists. These tests survive refactors because they don't care about internal structure.

**Bad tests** are coupled to implementation. They mock internal collaborators, test private methods, or verify through external means (like querying a database directly instead of using the interface). The warning sign: your test breaks when you refactor, but behavior hasn't changed. If you rename an internal function and tests fail, those tests were testing implementation, not behavior.

**A test that cannot fail is not a test. It is an executable comment.**

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

## Anti-Pattern: Horizontal Slices

**DO NOT write all tests first, then all implementation.** This is "horizontal slicing" - treating RED as "write all tests" and GREEN as "write all code."

This produces **crap tests**:

- Tests written in bulk test _imagined_ behavior, not _actual_ behavior
- You end up testing the _shape_ of things (data structures, function signatures) rather than user-facing behavior
- Tests become insensitive to real changes - they pass when behavior breaks, fail when behavior is fine
- You outrun your headlights, committing to test structure before understanding the implementation

**Correct approach**: Vertical slices via tracer bullets. One test → one implementation → repeat. Each test responds to what you learned from the previous cycle. Because you just wrote the code, you know exactly what behavior matters and how to verify it.

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5

RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
  ...
```

## Workflow

### 1. Planning

Before writing any code:

- [ ] Confirm with user what interface changes are needed
- [ ] Confirm with user which behaviors to test (prioritize)
- [ ] Identify opportunities for [deep modules](deep-modules.md) (small interface, deep implementation)
- [ ] Design interfaces for [testability](interface-design.md)
- [ ] List the behaviors to test (not implementation steps)
- [ ] Get user approval on the plan

Ask: "What should the public interface look like? Which behaviors are most important to test?"

**You can't test everything.** Confirm with the user exactly which behaviors matter most. Focus testing effort on critical paths and complex logic, not every possible edge case.

### 2. Write Intentions Before Code

Before writing any test, write the function's contract in plain language:

```
formatPrice:
  - given an amount and a currency code, returns a formatted string
  - always includes exactly two decimal places (10 → "10.00", 10.9 → "10.90")
  - prefixes with the correct symbol (EUR → €, USD → $)
  - throws if amount is negative
```

This becomes the source for both tests and implementation. If using AI, pass this — not the code.

### 3. Tracer Bullet

Write ONE test that confirms ONE thing about the system:

```
RED:   Write test for first behavior → test fails
GREEN: Write minimal code to pass → test passes
```

This is your tracer bullet - proves the path works end-to-end.

### 4. Incremental Loop

For each remaining behavior:

```
RED:   Write next test → fails
GREEN: Minimal code to pass → passes
```

Rules:

- One test at a time
- Only enough code to pass current test
- Don't anticipate future tests
- Keep tests focused on observable behavior

### 5. Verify Tests Can Fail

After each GREEN cycle, before moving on:

- Pick one mutation (flip a condition, delete a line, change a value)
- Confirm the test turns RED
- Revert the mutation

If no mutation breaks the test, the test is incomplete. Strengthen it or replace it.

### 6. Refactor

After all tests pass, look for [refactor candidates](refactoring.md):

- [ ] Extract duplication
- [ ] Deepen modules (move complexity behind simple interfaces)
- [ ] Apply SOLID principles where natural
- [ ] Consider what new code reveals about existing code
- [ ] Run tests after each refactor step

**Never refactor while RED.** Get to GREEN first.

## Checklist Per Cycle

```
[ ] Intent written before test (spec first, code second)
[ ] Test describes behavior, not implementation
[ ] Test uses public interface only
[ ] Test would survive internal refactor
[ ] Code is minimal for this test
[ ] No speculative features added
[ ] At least one mutation breaks this test (verified manually)
[ ] AI-generated tests were prompted from intent, not from existing code
```
