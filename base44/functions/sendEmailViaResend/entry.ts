// DEPRECATED — local imports not supported in Deno deploy.
// This file is intentionally empty. Email logic is inlined per function.
Deno.serve(() => Response.json({ error: 'Not a callable endpoint' }, { status: 404 }));