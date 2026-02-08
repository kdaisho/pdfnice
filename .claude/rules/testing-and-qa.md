---
description: 'Testing, code quality, and security standards for PDF Splitter'
---

# Testing & Quality Assurance

## Code Quality Standards

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (`pnpm run format`)
- **Linting**: ESLint + svelte-eslint-plugin (`pnpm run lint`)
- **Testing**: Vitest configured (`pnpm test`)

## Security Requirements

### WebAuthn Security

- **HTTPS required**: WebAuthn only works over HTTPS (localhost exception for dev)
- **RP ID**: Must match your domain exactly (e.g., `yourdomain.com`, not `www.yourdomain.com`)
- **Origin**: Include protocol (`https://yourdomain.com`)
- **Challenge TTL**: 5 minutes maximum, auto-cleanup stale challenges
- **Counter validation**: Must increment on each passkey use (prevents replay attacks)
- **Rate limiting**: 10 requests/min per email for challenge generation
- **userHandle validation**: Verify userHandle matches stored webauthn_user_id (prevents credential swapping)

### Payment Security (Phase 3)

- **Never expose Stripe secret key** to client
- **Stripe webhooks**: MUST verify signature via `stripe.webhooks.constructEvent()`
- **Store customer IDs** securely, never log payment details
- **Test mode** required before production (use test API keys)

### Session Security

- **httpOnly cookies**: Session tokens must use `httpOnly: true, secure: true, sameSite: 'strict'`
- **Session expiration**: 7-day max lifetime, validate on each request
- **No tokens in localStorage**: Only httpOnly cookies for auth

## Testing Strategy

### Phase 2 (Auth Foundation)

- Unit tests for DAO functions (findUserByEmail, savePasskey, etc.)
- Integration tests for auth flows (registration, login)
- Test challenge TTL expiration and cleanup

### Phase 3 (Monetization)

- Mock Stripe API calls in tests
- Test webhook signature verification
- E2E tests for payment flows

### Phase 4 (Future)

- Test PDF operations (merge, split, compress)
- Performance tests for large files (>50MB)
