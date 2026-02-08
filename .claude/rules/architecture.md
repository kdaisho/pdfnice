---
description: "Project structure and architectural decisions for PDF Splitter"
---

# Architecture

## Current File Structure

```
pdf-splitter/
├── src/
│   ├── routes/
│   │   ├── +page.svelte              # Main PDF viewer UI (385 lines)
│   │   └── +page.server.ts           # Server load function (minimal)
│   ├── lib/                          # Shared utilities (currently empty)
│   └── app.d.ts                      # TypeScript app definitions
├── .claude/
│   └── rules/                        # Modular project rules
│       ├── architecture.md
│       ├── logic-and-data.md
│       ├── testing-and-qa.md
│       ├── ui-patterns.md
│       └── workflow.md
├── examples/                         # Code examples (extracted from docs)
│   ├── trpc-setup/
│   ├── webauthn/
│   └── melt-ui-dialog.svelte
├── package.json
├── svelte.config.js
├── tsconfig.json
└── CLAUDE.md                         # High-level project guide
```

## Phase 1: Current Architecture (Viewer Only)

### Frontend (100% Client-Side)
- **Single-page viewer**: `/src/routes/+page.svelte` (385 lines)
- **PDF rendering**: PDF.js with canvas + text layer
- **Search**: Client-side with transform matrix calculations
- **No database**: Everything in-browser

### Core Component Flow
```
User uploads PDF
  ↓
Convert to ArrayBuffer
  ↓
PDF.js getDocument()
  ↓
For each page:
  - Render to canvas (1.5x scale)
  - Create text layer for selection
  - Store PageTextData for search
  ↓
Search builds character position map
  ↓
Highlight overlays calculated from transform matrices
```

## Phase 2: Planned Architecture (Auth Foundation)

### Edge-First Hybrid Model

**Frontend (Client-Side)**:
- PDF merge/split/compress using `pdf-lib` on ArrayBuffer
- Files **never uploaded** to server (privacy-first)
- Renders thumbnails for visual page selection
- TRPC client for auth API calls

**Backend (TRPC Routers)**:
- `authRouter`: Passkey registration/login flows (SimpleWebAuthn)
- Protected routes via TRPC middleware
- Session management with httpOnly cookies

**Database (PostgreSQL)**:
- `users`: User accounts
- `passkeys`: WebAuthn credentials
- `current_challenge`: Temporary challenge storage (5-min TTL)
- `sessions`: Login session tokens (7-day expiry)

### Planned File Structure (Phase 2)

```
src/
├── routes/
│   ├── +page.svelte                          # Public PDF viewer
│   ├── (authed)/                             # Protected routes
│   │   ├── dashboard/+page.svelte
│   │   └── setup/+page.svelte                # Passkey registration
│   ├── signin/+page.svelte
│   └── api/
│       └── trpc/[...trpc]/+server.ts         # TRPC endpoint
├── lib/
│   ├── server/
│   │   ├── trpc.ts                           # TRPC instance + context
│   │   ├── db/                               # Database access layer
│   │   │   ├── client.ts                     # DB connection
│   │   │   ├── schema.ts                     # Type-safe schema
│   │   │   └── migrations/                   # SQL migrations
│   │   └── routers/
│   │       ├── _app.ts                       # Root router
│   │       └── auth.ts                       # Auth procedures
│   ├── trpc.ts                               # TRPC client (frontend)
│   ├── components/
│   └── stores/
└── hooks.server.ts                           # Session validation
```

## Data Flow (Phase 2)

### Authentication Flow
```
1. User enters email → TRPC: auth.getRegistrationOptions
2. Server generates challenge, stores in current_challenge table
3. Client triggers WebAuthn (Touch ID/Face ID)
4. Client sends response → TRPC: auth.verifyRegistration
5. Server verifies, saves passkey, creates session
6. Server sets httpOnly session cookie
7. User redirected to dashboard
```

### Protected Route Access
```
1. Request to /dashboard
2. SvelteKit hooks.server.ts intercepts
3. Validate session cookie against DB
4. If valid: Attach user to event.locals.user
5. TRPC context receives user from locals
6. Protected procedures check ctx.user
```

### PDF Operation Flow (Client-Side Only)
```
User uploads PDF → pdf-lib loads in browser
  ↓
User selects pages/operations
  ↓
pdf-lib processes in-memory (ArrayBuffer)
  ↓
Generate new PDF blob
  ↓
Browser downloads result

[No server upload/processing]
```

## Phase 3: Monetization (Future)

### Additional Components
- `stripeRouter`: Checkout session creation, customer portal
- `/api/webhooks/+server.ts`: Stripe webhook handler (standard POST, not TRPC)
- Database additions: `stripe_customer_id`, `subscription_status`, `is_pro` in users table

### Payment Flow
```
1. User clicks "Upgrade to Pro"
2. TRPC: stripe.createCheckoutSession.mutate()
3. Redirect to Stripe hosted checkout
4. User pays
5. Stripe webhook → /api/webhooks
6. Verify signature, update user.is_pro = true
7. User redirected back, sees Pro features
```

## Phase 4: Cloud Sync (Optional)

**Only if users demand cross-device sync**

### Additional Components
- Object storage (Cloudflare R2 / S3)
- `pdf_projects` table (user_id, file_key, editing_state_json, updated_at)
- Auto-deletion after 7 days

### Privacy Trade-off
- Default: Files stay 100% local (current behavior)
- Opt-in: "Save to cloud" uploads encrypted PDF for cross-device access
- Clear UI warning about privacy implications

## Key Architectural Constraints

1. **Privacy-first**: PDF processing happens in-browser (pdf-lib), never upload files to server
2. **Performance**: Code-split heavy libraries (PDF.js ~500kb, pdf-lib ~300kb) via dynamic imports
3. **Type safety**: End-to-end types via TRPC (server procedures → client calls)
4. **Security**: WebAuthn for passwordless auth, httpOnly session cookies, challenge TTL
5. **Scalability**: Stateless TRPC API, horizontally scalable (sessions in DB, not memory)

## Router Organization

### Phase 2: authRouter
```typescript
authRouter = {
  getRegistrationOptions: publicProcedure
  verifyRegistration: publicProcedure
  getLoginOptions: publicProcedure
  verifyLogin: publicProcedure
  logout: protectedProcedure
}
```

### Phase 3: Additional routers
```typescript
stripeRouter = {
  createCheckoutSession: protectedProcedure
  createPortalSession: protectedProcedure
}

userRouter = {
  getCurrentUser: protectedProcedure
  getUsageStats: protectedProcedure      // For rate limiting display
}
```

## Database Schema (Phase 2)

```sql
-- Core user table
users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  usage_count_today INT DEFAULT 0,       -- For rate limiting
  last_reset_date DATE DEFAULT CURRENT_DATE
)

-- WebAuthn passkeys
passkeys (
  id TEXT PRIMARY KEY,                    -- credential.id from WebAuthn
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  webauthn_user_id TEXT UNIQUE NOT NULL,  -- From registration options
  public_key BYTEA NOT NULL,
  counter BIGINT NOT NULL,
  device_type VARCHAR(32) NOT NULL,       -- 'singleDevice' | 'multiDevice'
  backed_up BOOLEAN NOT NULL,
  transports TEXT,                        -- JSON array
  name VARCHAR(255),                      -- User-friendly name (e.g., "MacBook Pro Touch ID")
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Temporary challenge storage (auto-cleanup via TTL)
current_challenge (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  challenge TEXT NOT NULL,
  registration_options_user_id TEXT,      -- Only for registration flow
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
)

-- Login sessions
sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
)

-- Indices for performance
CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_current_challenge_user_id ON current_challenge(user_id);
```

## Technology Justification

| Technology | Why Chosen | Alternatives Considered |
|------------|-----------|------------------------|
| SvelteKit | SSR + API routes in one framework, Svelte 5 runes | Next.js (too React-heavy), Remix |
| TRPC | End-to-end type safety, zero boilerplate | REST (verbose), GraphQL (overkill) |
| pdf-lib | Browser-based, no server upload needed | Server-side processing (privacy violation) |
| SimpleWebAuthn | Passwordless auth, excellent DX | Auth.js (complex), custom JWT (insecure) |
| Melt UI | Headless for Svelte 5, full style control | shadcn-svelte (opinionated), Tailwind UI (bloat) |
| PostgreSQL | Relational data, ACID guarantees | Firebase (vendor lock-in), MongoDB (wrong fit) |
| Stripe | Full control, better margins | Lemon Squeezy (higher fees), Paddle (MoR complications) |

## Deployment Strategy

- **Phase 1**: Static hosting (Vercel/Netlify/Cloudflare Pages) - no backend needed
- **Phase 2**: Edge deployment (Vercel/Cloudflare Workers) + managed PostgreSQL (Supabase/Neon)
- **Phase 3**: Add Stripe webhook endpoint, requires stable URL
- **Phase 4**: Add object storage (Cloudflare R2 for free egress)
