// PayFast package catalogue — Step 4 of 10.
//
// Placeholder packages — these are mirrored verbatim inside
// base44/functions/payfast-sign/entry.ts (`PACKAGES` constant). KEEP THE TWO
// COPIES IN SYNC. We duplicate intentionally because the Deno function
// cannot import from src/. Once we move packages to a database table in a
// later step, both copies go away.
//
// Why duplicate at all? Because the *amount* must be looked up server-side
// from a trusted source. If the browser sent the amount, a curious user
// could change R3,980.00 to R10.00 in DevTools and PayFast would happily
// accept the signed-but-tampered request. By having the server re-derive
// the amount from package_id, only the package_id can be tampered with —
// and the worst case there is the user buying the wrong package, never an
// underpayment.
export const PAYFAST_PACKAGES = [
  {
    id: 'ignite',
    name: 'Ignite Setup',
    description: 'Marketing iO Ignite package - one-time setup fee',
    amount: '3980.00',
  },
  {
    id: 'spark',
    name: 'Spark Setup',
    description: 'Marketing iO Spark package - one-time setup fee',
    amount: '1980.00',
  },
  {
    id: 'ignite-test',
    name: 'Sandbox Test',
    description: 'Sandbox test transaction',
    amount: '10.00',
  },
];

export const DEFAULT_PACKAGE_ID = 'ignite-test';
