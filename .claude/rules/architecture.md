---
description: 'Project structure and architectural decisions for PDF Splitter'
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
│   ├── form-actions/
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

### SvelteKit-Native Model

**Frontend (Client-Side)**:

- PDF merge/split/compress using `pdf-lib` on ArrayBuffer
- Files **never uploaded** to server (privacy-first)
- Renders thumbnails for visual page selection
- Form submissions with `use:enhance` for auth

**Backend (Form Actions + Load Functions)**:

- `+page.server.ts` actions: Passkey registration/login flows (SimpleWebAuthn)
- Protected routes via `hooks.server.ts` + route groups `(authed)`
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
│   ├── +layout.server.ts                     # Global load (user data)
│   ├── (authed)/                             # Protected route group
│   │   ├── +layout.server.ts                 # Auth guard (redirect if no session)
│   │   ├── dashboard/
│   │   │   ├── +page.svelte
│   │   │   └── +page.server.ts               # Load user data
│   │   └── setup/
│   │       ├── +page.svelte                  # Passkey registration UI
│   │       └── +page.server.ts               # Registration actions
│   ├── signin/
│   │   ├── +page.svelte                      # Login UI
│   │   └── +page.server.ts                   # Login actions
│   └── api/
│       └── webhooks/+server.ts               # Stripe webhooks (Phase 3)
├── lib/
│   ├── server/
│   │   ├── db/                               # Database access layer
│   │   │   ├── client.ts                     # DB connection
│   │   │   ├── schema.ts                     # Type-safe schema
│   │   │   └── dao/                          # Data access objects
│   │   │       └── auth.ts
│   │   ├── auth.ts                           # WebAuthn helper functions
│   │   └── session.ts                        # Session create/validate helpers
│   ├── components/
│   └── stores/
└── hooks.server.ts                           # Session validation middleware
```

## Data Flow (Phase 2)

### Authentication Flow (Form Actions)

```
1. User enters email, submits form
2. POST /signin?/getOptions → action generates challenge, stores in DB
3. Action returns challenge options via ActionData
4. Client JS calls startAuthentication() with options
5. User authenticates (Touch ID/Face ID)
6. Client submits response via second form POST
7. POST /signin?/verify → action verifies, creates session cookie
8. Action returns redirect(303, '/dashboard')
```

### Protected Route Access

```
1. Request to /dashboard
2. SvelteKit hooks.server.ts intercepts
3. Validate session cookie against DB
4. If valid: Attach user to event.locals.user
5. (authed)/+layout.server.ts checks event.locals.user
6. If missing: redirect(303, '/signin')
7. Load functions receive user via event.locals
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

- Form action: `checkout` in billing page for session creation
- `/api/webhooks/+server.ts`: Stripe webhook handler (POST endpoint)
- Database additions: `stripe_customer_id`, `subscription_status`, `is_pro` in users table

### Payment Flow

```
1. User clicks "Upgrade to Pro"
2. POST /billing?/checkout → action creates Stripe session
3. Action returns redirect to Stripe hosted checkout
4. User pays
5. Stripe webhook → /api/webhooks/+server.ts
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
3. **Type safety**: Zod validation in actions, typed ActionData/PageData via SvelteKit
4. **Security**: WebAuthn for passwordless auth, httpOnly session cookies, challenge TTL
5. **Scalability**: Stateless form actions, horizontally scalable (sessions in DB, not memory)
6. **Progressive enhancement**: Forms work without JS via SvelteKit form actions

## Form Action Organization

### Phase 2: Auth Actions

```typescript
// src/routes/signin/+page.server.ts
export const actions = {
  getOptions: async ({ request, cookies }) => { ... },  // Generate challenge
  verify: async ({ request, cookies }) => { ... },      // Verify and create session
};

// src/routes/(authed)/setup/+page.server.ts
export const actions = {
  register: async ({ request, locals }) => { ... },     // Add new passkey
  rename: async ({ request, locals }) => { ... },       // Rename passkey
  delete: async ({ request, locals }) => { ... },       // Remove passkey
};

// src/routes/(authed)/+layout.server.ts
export const load = async ({ locals }) => {
  if (!locals.user) redirect(303, '/signin');
  return { user: locals.user };
};
```

### Phase 3: Billing Actions

```typescript
// src/routes/(authed)/billing/+page.server.ts
export const actions = {
  checkout: async ({ locals }) => { ... },              // Create Stripe session
  portal: async ({ locals }) => { ... },                // Open customer portal
};
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

| Technology     | Why Chosen                                               | Alternatives Considered                                 |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------- |
| SvelteKit      | SSR + form actions + load functions, Svelte 5 runes      | Next.js (too React-heavy), Remix                        |
| Form Actions   | Native SvelteKit, progressive enhancement, CSRF built-in | TRPC (extra dependency), REST (verbose)                 |
| pdf-lib        | Browser-based, no server upload needed                   | Server-side processing (privacy violation)              |
| SimpleWebAuthn | Passwordless auth, excellent DX                          | Auth.js (complex), custom JWT (insecure)                |
| Melt UI        | Headless for Svelte 5, full style control                | shadcn-svelte (opinionated), Tailwind UI (bloat)        |
| PostgreSQL     | Relational data, ACID guarantees                         | Firebase (vendor lock-in), MongoDB (wrong fit)          |
| Stripe         | Full control, better margins                             | Lemon Squeezy (higher fees), Paddle (MoR complications) |

## Deployment Strategy

- **Phase 1**: Static hosting (Vercel/Netlify/Cloudflare Pages) - no backend needed
- **Phase 2**: Edge deployment (Vercel/Cloudflare Workers) + managed PostgreSQL (Supabase/Neon)
- **Phase 3**: Add Stripe webhook endpoint, requires stable URL
- **Phase 4**: Add object storage (Cloudflare R2 for free egress)
