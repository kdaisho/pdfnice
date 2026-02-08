# Code Examples

This directory contains **boilerplate code examples** extracted from the project documentation to reduce context bloat.

## Purpose

Instead of cluttering `.claude/rules/` with 300+ lines of TRPC/WebAuthn setup code, we reference these examples by path. You already know how these libraries work—these are just project-specific patterns.

## Structure

```
examples/
├── trpc-setup/
│   ├── server-context.ts       # TRPC instance, context, middleware
│   ├── trpc-endpoint.ts        # SvelteKit TRPC endpoint
│   └── client-setup.ts         # TRPC client configuration
├── webauthn/
│   ├── auth-router.ts          # authRouter skeleton (registration/login)
│   └── client-usage.svelte     # Client-side passkey flow
├── pdf-operations.ts           # pdf-lib operations (merge, split, reorder)
└── melt-ui-dialog.svelte       # Melt UI dialog pattern
```

## Usage

These examples are **referenced** in `.claude/rules/` files, not copy-pasted. When implementing a feature, review the relevant example for patterns, then adapt to your specific needs.

**Example**: When implementing Phase 2 auth, see:
- `webauthn/auth-router.ts` for TRPC procedure structure
- `webauthn/client-usage.svelte` for client-side flow
- `trpc-setup/*` for initial TRPC configuration

## Not Production Code

These examples contain:
- ✅ Correct patterns and structure
- ✅ Proper error handling
- ✅ Security best practices
- ❌ Actual database calls (commented out)
- ❌ Environment-specific configuration

**Adapt, don't copy-paste blindly.**
