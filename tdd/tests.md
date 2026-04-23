# Good and Bad Tests

## Good Tests

**Integration-style**: Test through real interfaces, not mocks of internal parts.

```typescript
// GOOD: Tests observable behavior
test("user can checkout with valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Characteristics:

- Tests behavior users/callers care about
- Uses public API only
- Survives internal refactors
- Describes WHAT, not HOW
- One logical assertion per test
- **Can be broken by mutating the implementation**

## Bad Tests

**Implementation-detail tests**: Coupled to internal structure.

```typescript
// BAD: Tests implementation details
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Red flags:

- Mocking internal collaborators
- Testing private methods
- Asserting on call counts/order
- Test breaks when refactoring without behavior change
- Test name describes HOW not WHAT
- Verifying through external means instead of interface
- **Passes even when the implementation has a bug**

```typescript
// BAD: Bypasses interface to verify
test("createUser saves to database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: Verifies through interface
test("createUser makes user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

## Intention-First Tests vs AI-Reading-Code Tests

The biggest source of weak tests when using AI: asking it to generate tests for existing code.

AI reads the code and validates what it does. It does not question whether what it does is correct.

```typescript
// Implementation with a subtle bug: <= leaves a race condition at Date.now()
function isValidDate(date: string): boolean {
  const d = new Date(date)
  return !isNaN(d.getTime()) && d.getTime() <= Date.now()
}
```

**What AI generates when given the code:**

```typescript
// GREEN — but does not protect you
test('returns true for valid past date', () => {
  expect(isValidDate('2024-01-15')).toBe(true)
})

test('returns false for future date', () => {
  expect(isValidDate('2030-01-15')).toBe(false)
})
```

These pass. 100% coverage. The edge case at `Date.now()` is invisible because the AI confirmed the code's logic, not the contract.

**What intention-first generates:**

```
Prompt: "Generate tests for a date validator that:
  - returns true for dates strictly in the past
  - returns false for future dates
  - returns false for invalid date strings
  - returns false for dates equal to the current moment (boundary exclusive)"
```

```typescript
// This forces the boundary question
test('rejects a date equal to now', () => {
  const now = new Date().toISOString()
  expect(isValidDate(now)).toBe(false)
})

test('rejects invalid date strings', () => {
  expect(isValidDate('not-a-date')).toBe(false)
  expect(isValidDate('')).toBe(false)
})
```

The spec surfaced the bug. The implementation's `<=` would fail the `rejects a date equal to now` test.

---

**Another example — formatting:**

```typescript
function formatPrice(amount: number, currency: 'EUR' | 'USD'): string {
  const symbols = { EUR: '€', USD: '$' }
  return `${symbols[currency]}${amount.toFixed(2)}`
}
```

**AI from code:**

```typescript
test('formats EUR correctly', () => {
  expect(formatPrice(10.5, 'EUR')).toBe('€10.50')
})
```

Remove `toFixed` from the implementation → test still passes if amount is `10.5` (already has one decimal that rounds to two). The test doesn't protect the invariant.

**Intention-first:**

```typescript
// Prompt: "always shows exactly two decimal places, even for whole numbers or single-decimal values"

test('pads whole numbers to two decimals', () => {
  expect(formatPrice(10, 'EUR')).toBe('€10.00')
})

test('pads single-decimal to two decimals', () => {
  expect(formatPrice(10.9, 'USD')).toBe('$10.90')
})

test('throws on negative amounts', () => {
  expect(() => formatPrice(-10, 'EUR')).toThrow()
})
```

Remove `toFixed` → `formatPrice(10, 'EUR')` returns `'€10'` → test fails immediately.
