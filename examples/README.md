# Code Examples

This directory contains **boilerplate code examples** extracted from the project documentation to reduce context bloat.

## Purpose

Instead of cluttering `.claude/rules/` with 300+ lines of form action setup code, we reference these examples by path. You already know how SvelteKit works—these are just project-specific patterns.

## Structure

```
examples/
├── form-actions/
│   ├── auth-actions.ts        # Auth form actions (registration/login)
│   ├── protected-layout.ts    # Protected route pattern
│   └── hooks-server.ts        # Session validation hook
├── webauthn/
│   ├── client-usage.svelte    # Client-side passkey flow with form actions
│   └── types.ts               # WebAuthn type definitions
├── pdf-operations.ts          # pdf-lib operations (merge, split, reorder)
└── melt-ui-dialog.svelte      # Melt UI dialog pattern
```

## Usage

These examples are **referenced** in `.claude/rules/` files, not copy-pasted. When implementing a feature, review the relevant example for patterns, then adapt to your specific needs.

**Example**: When implementing Phase 2 auth, see:

- `form-actions/auth-actions.ts` for form action structure
- `form-actions/hooks-server.ts` for session middleware
- `webauthn/client-usage.svelte` for client-side flow

## Not Production Code

These examples contain:

- ✅ Correct patterns and structure
- ✅ Proper error handling
- ✅ Security best practices
- ❌ Actual database calls (commented out)
- ❌ Environment-specific configuration

**Adapt, don't copy-paste blindly.**
