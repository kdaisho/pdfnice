---
description: "Development workflow, environment setup, and deployment for PDF Splitter"
---

# Development Workflow

## Quick Start Commands

```bash
pnpm install          # Install dependencies
pnpm run dev          # Start dev server (http://localhost:5173)
pnpm run build        # Production build
pnpm run preview      # Test production build locally
pnpm run format       # Format code with Prettier
pnpm run lint         # Lint with ESLint
pnpm test             # Run Vitest tests
```

## Environment Variables

### Phase 2: Auth Foundation (Current)

```bash
# .env.local
# WebAuthn / Passkeys
PUBLIC_RP_ID=localhost                              # Relying Party ID (use 'localhost' for dev)
PUBLIC_RP_NAME="PDF Splitter"                       # Human-readable app name
PUBLIC_ORIGIN=http://localhost:5173                 # Expected origin (include protocol)

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pdfnice

# Session
SESSION_SECRET=<random-32-byte-hex>                 # For signing session tokens (generate with: openssl rand -hex 32)
```

### Phase 3: Monetization (Future - Deferred)

```bash
# Stripe
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...                     # From Stripe webhook configuration
```

### Phase 4: Cloud Sync (Future - Optional)

```bash
# Object Storage (Cloudflare R2 or S3)
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=pdfnice-projects
```

## Deployment Checklist

### Pre-Deployment

- [ ] All tests passing (`pnpm test`)
- [ ] No lint errors (`pnpm run lint`)
- [ ] Build succeeds (`pnpm run build`)
- [ ] Environment variables documented

### Phase 2 Deployment (Auth)

- [ ] Configure adapter for target platform (Vercel/Cloudflare/Railway)
- [ ] Set environment variables in hosting dashboard
- [ ] **Database setup**:
  - [ ] Provision PostgreSQL instance (Supabase/Neon/Railway)
  - [ ] Run migrations (to be created in Phase 2)
  - [ ] Verify DATABASE_URL connectivity
- [ ] **WebAuthn setup**:
  - [ ] Ensure HTTPS is enabled (required for passkeys)
  - [ ] Set `PUBLIC_RP_ID` to your domain (no protocol, e.g., `pdfnice.com`)
  - [ ] Set `PUBLIC_ORIGIN` with protocol (e.g., `https://pdfnice.com`)
  - [ ] Test passkey registration on production domain (different from localhost)
- [ ] **Session security**:
  - [ ] Generate new SESSION_SECRET for production (never reuse dev secret)
  - [ ] Verify httpOnly cookies work across domain

### Phase 3 Deployment (Monetization)

- [ ] **Stripe setup**:
  - [ ] Create product + pricing in Stripe dashboard
  - [ ] Switch to live API keys (pk_live_..., sk_live_...)
  - [ ] Configure webhook URL: `https://pdfnice.com/api/webhooks`
  - [ ] Enable Stripe Tax if selling globally
  - [ ] Test webhook delivery in Stripe dashboard
  - [ ] Set up Stripe Customer Portal for subscription management

### Monitoring & Observability

- [ ] Set up error monitoring (Sentry recommended)
- [ ] Configure logging for form actions
- [ ] Monitor database query performance
- [ ] Set up uptime monitoring (BetterStack, UptimeRobot)

## Resources

### Documentation
- [SvelteKit Docs](https://kit.svelte.dev/docs) - Framework reference
- [SvelteKit Form Actions](https://kit.svelte.dev/docs/form-actions) - Server-side form handling
- [Melt UI](https://melt-ui.com/) - Headless UI library for Svelte 5
- [SimpleWebAuthn](https://simplewebauthn.dev/) - Passkey authentication
- [WebAuthn Guide](https://webauthn.guide/) - Understanding WebAuthn concepts
- [PDF.js API](https://mozilla.github.io/pdf.js/api/)
- [pdf-lib Guide](https://pdf-lib.js.org/)
- [Zod](https://zod.dev/) - TypeScript-first schema validation

### Phase 3 Resources (Future)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Tax](https://stripe.com/tax)
