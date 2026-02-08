# PDF Splitter - Privacy-First PDF Tool

## Philosophy

**Privacy-First**: All PDF processing happens in-browser using pdf-lib. Files never uploaded to server.

**SvelteKit-Native**: Form actions for auth/payments, client-side heavy lifting for PDF operations.

**Freemium Model**: Free viewer/search, paid features (merge/split/compress) with anti-abuse auth.

**Phased Development**:
- **Phase 1** ✅: Basic PDF viewer with search
- **Phase 2** (Current): Auth foundation (SimpleWebAuthn + Form Actions)
- **Phase 3** (Future): Stripe monetization
- **Phase 4** (Optional): Cloud sync if user-demanded

---

## Quick Start

```bash
pnpm install          # Install dependencies
pnpm run dev          # Start dev server (http://localhost:5173)
pnpm run build        # Production build
pnpm run preview      # Test production build
pnpm run format       # Format code with Prettier
pnpm run lint         # Lint with ESLint
pnpm test             # Run Vitest tests
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | SvelteKit 2.x + Svelte 5 | SSR + API routes + Form actions |
| API Layer | Form Actions | Built-in, progressive enhancement, CSRF protection |
| PDF Processing | pdf-lib (browser) | Privacy-first, no server upload |
| PDF Rendering | PDF.js | Canvas + text layer for search |
| UI Components | Melt UI | Headless, accessible for Svelte 5 |
| Styling | Custom CSS | Full control, no utility bloat |
| Auth | SimpleWebAuthn | Passwordless passkeys |
| Database | PostgreSQL | Relational data (Supabase/Neon) |
| Payment (Phase 3) | Stripe | Better margins, full control |
| Drag-Drop (Phase 2) | dnd-kit-svelte | Page reordering |
| Hosting | Vercel/Cloudflare | Edge deployment |

---

## Current Status

### Phase 1: Completed ✅
- PDF viewer with canvas rendering (1.5x scale)
- Text layer overlay for selection
- Full-text search with highlight navigation
- Keyboard nav: Enter (next), Shift+Enter (prev), Escape (clear)
- Download functionality
- 100% client-side (no backend)

### Phase 2: In Progress 🚧
**Auth Foundation** - Enable user accounts to prevent abuse:
- Database setup (users, passkeys, sessions, current_challenge)
- SimpleWebAuthn passkey authentication (Touch ID/Face ID)
- Form actions for auth flows (+page.server.ts)
- SvelteKit hooks for session validation
- Rate limiting (10 operations/day for free tier)
- PDF operations UI (merge/split using pdf-lib in browser)

### Phase 3: Planned 📋
**Monetization** - Add paid tier when ready:
- Stripe integration (checkout, webhooks, customer portal)
- Feature gating (free vs. pro)
- Pro features: Unlimited operations, >50MB files, priority support

### Phase 4: Optional ⏳
**Cloud Sync** - Only if users demand cross-device sync:
- Object storage (Cloudflare R2)
- Opt-in PDF project persistence
- Privacy trade-off clearly communicated

---

## Project Structure

```
pdf-splitter/
├── src/
│   ├── routes/
│   │   ├── +page.svelte              # Main PDF viewer
│   │   ├── +page.server.ts           # Minimal server load
│   │   ├── (authed)/                 # Protected routes (Phase 2+)
│   │   │   └── dashboard/+page.server.ts  # Load + actions
│   │   ├── signin/+page.server.ts    # Auth form actions
│   │   └── api/webhooks/+server.ts   # Stripe webhooks (Phase 3)
│   ├── lib/
│   │   ├── server/                   # Server-only code (Phase 2+)
│   │   │   ├── db/                   # Database access layer
│   │   │   ├── auth.ts               # WebAuthn helpers
│   │   │   └── session.ts            # Session management
│   │   ├── components/               # Reusable Svelte components
│   │   └── stores/                   # Svelte stores
│   ├── hooks.server.ts               # Session validation (Phase 2+)
│   └── app.d.ts
├── .claude/
│   └── rules/                        # Modular project rules
│       ├── architecture.md           # File structure, tech decisions
│       ├── logic-and-data.md         # Form actions, auth, DB, business logic
│       ├── testing-and-qa.md         # Code quality, security standards
│       ├── ui-patterns.md            # Components, styling, UX
│       └── workflow.md               # Environment, deployment, resources
├── examples/                         # Code examples (boilerplate extracted)
│   ├── form-actions/                 # Auth form action examples
│   ├── webauthn/                     # WebAuthn client/server
│   ├── pdf-operations.ts
│   └── melt-ui-dialog.svelte
├── package.json
├── svelte.config.js
└── CLAUDE.md                         # This file
```

---

## Where to Find Information

This file is the **high-level guide**. For detailed instructions:

### **UI/UX Implementation**
→ `.claude/rules/ui-patterns.md`
- Styling philosophy (custom CSS, Melt UI)
- PDF viewer implementation (canvas, text layer, search)
- Component patterns and organization
- Performance constraints (code splitting)

### **Business Logic & Data**
→ `.claude/rules/logic-and-data.md`
- Form actions setup and usage
- SimpleWebAuthn integration (passkey auth)
- Database access layer (DAO pattern)
- Session management
- Rate limiting implementation
- PDF operations (merge/split/compress)

### **Testing & Security**
→ `.claude/rules/testing-and-qa.md`
- Code quality standards (TypeScript, Prettier, ESLint)
- Security requirements (WebAuthn, Stripe, sessions)
- Testing strategy per phase

### **Development Workflow**
→ `.claude/rules/workflow.md`
- Environment variables (by phase)
- Deployment checklists
- Resources and documentation links
- Reference implementations

### **Architecture Details**
→ `.claude/rules/architecture.md`
- File structure evolution
- Data flow diagrams
- Database schema (SQL)
- Technology justification
- Deployment strategy

### **Code Examples**
→ `examples/` directory
- Form actions patterns (auth flows)
- WebAuthn client/server examples
- PDF operations (pdf-lib)
- Melt UI component examples

---

## Key Constraints

1. **Privacy-First**: PDF files NEVER uploaded to server. All merge/split/compress operations happen in-browser using pdf-lib on ArrayBuffer.

2. **Performance**: Code-split heavy libraries via dynamic imports:
   - PDF.js: ~500kb (loaded when user uploads file)
   - pdf-lib: ~300kb (loaded when user performs operations)
   - Initial bundle: <100kb

3. **Type Safety**: Zod validation in form actions, typed ActionData/PageData via SvelteKit.

4. **Security**:
   - WebAuthn: HTTPS required, 5-min challenge TTL, counter validation, userHandle verification
   - Sessions: httpOnly cookies, 7-day expiry, validated via SvelteKit hooks
   - Rate limiting: 10 requests/min per email for challenge generation

5. **Phased Implementation**: Build auth foundation (Phase 2) before monetization (Phase 3). Don't implement cloud sync (Phase 4) until users demand it.

---

## Implementation Roadmap

### Phase 2: Auth Foundation (Next)
- [x] Plan auth architecture
- [ ] Database schema + migrations (users, passkeys, sessions, current_challenge)
- [ ] Form actions for auth (+page.server.ts with actions)
- [ ] SimpleWebAuthn integration (registration/login flows)
- [ ] SvelteKit hooks (session validation)
- [ ] Rate limiting (in-memory Map)
- [ ] Protected routes (/dashboard, /setup)
- [ ] PDF operations UI (merge/split with pdf-lib)

### Phase 3: Monetization (Future)
- [ ] Stripe setup (product, prices, test mode)
- [ ] Checkout form action (createCheckoutSession, createPortalSession)
- [ ] Webhook endpoint (/api/webhooks with signature verification)
- [ ] Database additions (stripe_customer_id, subscription_status, is_pro)
- [ ] Feature gating (load function checks is_pro)
- [ ] Stripe Tax configuration

### Phase 4: Cloud Sync (Optional)
- [ ] User research: Do users want cross-device sync?
- [ ] Object storage setup (Cloudflare R2)
- [ ] pdf_projects table (file_key, editing_state_json)
- [ ] Opt-in UI with privacy warning
- [ ] Auto-deletion after 7 days

---

## Business Rules

### Free Tier (Phase 2)
- View PDFs
- Search PDFs
- Download PDFs
- Merge/split/compress: **10 operations per day**
- Requires account to prevent abuse

### Pro Tier (Phase 3)
**$9/month**:
- Unlimited operations per day
- Files >50MB
- Batch operations (merge 10+ PDFs)
- Priority support
- Early access to new features

### Rate Limiting Strategy
- Track `usage_count_today` in users table
- Reset daily (check `last_reset_date`)
- Display remaining operations in UI
- Graceful error when limit exceeded

---

## Security Checklist

### WebAuthn
- ✅ RP_ID matches domain (no protocol)
- ✅ Origin includes protocol
- ✅ Challenge TTL: 5 minutes max
- ✅ Counter validation (increment check)
- ✅ userHandle validation (prevents credential swapping)
- ✅ Rate limiting (10/min per email)
- ✅ HTTPS required (localhost exception for dev)

### Sessions
- ✅ httpOnly: true
- ✅ secure: true
- ✅ sameSite: 'strict'
- ✅ 7-day max expiry
- ✅ Validated on each request via hooks

### Stripe (Phase 3)
- ✅ Never expose secret key to client
- ✅ Webhook signature verification (CRITICAL)
- ✅ Test mode before production
- ✅ No logging of payment details

---

## Reference Implementation

**Key Learnings** (from prior projects):
- SimpleWebAuthn challenge-response pattern
- Challenge management (separate table, TTL validation)
- Security hardening (rate limiting, counter validation, userHandle check)
- DAO pattern (clean separation of DB queries)

---

## Resources

**Core Documentation**:
- [SvelteKit](https://kit.svelte.dev/docs) - Form actions, load functions, hooks
- [SvelteKit Form Actions](https://kit.svelte.dev/docs/form-actions)
- [SimpleWebAuthn](https://simplewebauthn.dev/)
- [Melt UI](https://melt-ui.com/)
- [PDF.js API](https://mozilla.github.io/pdf.js/api/)
- [pdf-lib](https://pdf-lib.js.org/)
- [Zod](https://zod.dev/)

**Phase 3 Resources** (when ready):
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Tax](https://stripe.com/tax)

---

## Common Tasks

### Add a new form action
1. Create `+page.server.ts` in the route directory
2. Export `actions` object with named actions
3. Validate input with Zod
4. Return data via `fail()` or redirect via `redirect()`
5. Access in Svelte via `form` prop from `use:enhance`

### Add a new protected route
1. Create in `src/routes/(authed)/`
2. Session validated via `hooks.server.ts` automatically
3. Access user via `event.locals.user` in +page.server.ts

### Perform PDF operation
1. Import function from `examples/pdf-operations.ts`
2. Call with File objects from input
3. Download resulting Blob
4. **Never upload to server**

### Debug WebAuthn issues
1. Check browser console for errors
2. Verify RP_ID matches domain
3. Ensure HTTPS (or localhost for dev)
4. Check challenge hasn't expired (5 min TTL)
5. Verify counter increments

---

**Last Updated**: Phase 2 planning complete, implementation in progress
