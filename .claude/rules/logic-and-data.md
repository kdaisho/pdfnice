---
description: "Business logic, data models, and API patterns for PDF Splitter"
---

# Logic & Data

## Phase 2: Auth Foundation (Current Priority)

### TRPC Setup

**Installation**:
```bash
pnpm add @trpc/server @trpc/client zod
```

**Core Concepts**:
- **End-to-end type safety**: Server procedure types automatically flow to client
- **Zero boilerplate**: No manual API client code, no code generation
- **Context**: Each TRPC request receives user session from SvelteKit `event.locals`
- **Procedures**: `publicProcedure` (no auth), `protectedProcedure` (requires auth)

**Setup locations**:
- Server: `src/lib/server/trpc.ts` (TRPC instance + context)
- Routers: `src/lib/server/routers/*.ts`
- Endpoint: `src/routes/api/trpc/[...trpc]/+server.ts`
- Client: `src/lib/trpc.ts`

**Code examples**: See `examples/trpc-setup/` for full implementation

#### TRPC Context

Context provides session data to all procedures:

```typescript
// src/lib/server/trpc.ts
export async function createContext(event: RequestEvent) {
  return {
    user: event.locals.user,  // From SvelteKit hooks
    cookies: event.cookies,
  };
}
```

#### Protected Procedure Middleware

```typescript
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }
  return next({ ctx: { user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(isAuthed);
```

### SimpleWebAuthn Integration

**Installation**:
```bash
pnpm add @simplewebauthn/server @simplewebauthn/browser
```

**Architecture**: Challenge-response authentication
- Client (`@simplewebauthn/browser`): Interacts with device authenticator (Touch ID, Face ID, security key)
- Server (`@simplewebauthn/server`): Generates challenges, verifies responses

**Integration pattern**: SimpleWebAuthn is exposed via TRPC procedures (not REST endpoints)

#### Registration Flow

```typescript
// authRouter procedures:
1. auth.getRegistrationOptions(email)    → Returns PublicKeyCredentialCreationOptionsJSON
2. [Client calls startRegistration()]
3. auth.verifyRegistration(email, response) → Saves passkey, creates session
```

**Client example**:
```typescript
import { trpc } from '$lib/trpc';
import { startRegistration } from '@simplewebauthn/browser';

const options = await trpc.auth.getRegistrationOptions.query({ email });
const response = await startRegistration(options);
const result = await trpc.auth.verifyRegistration.mutate({
  email,
  registrationResponse: JSON.stringify(response),
});
```

**Server example**: See `examples/webauthn/auth-router.ts` for full TRPC router implementation

#### Authentication Flow

```typescript
// authRouter procedures:
1. auth.getLoginOptions(email)           → Returns PublicKeyCredentialRequestOptionsJSON
2. [Client calls startAuthentication()]
3. auth.verifyLogin(email, response)     → Verifies signature, creates session
```

#### Critical Security Implementation

**Challenge Management**:
- Store in `current_challenge` table with 5-minute TTL
- Delete existing challenges for user before creating new one (prevent multiple active challenges)
- Validate `created_at` timestamp on retrieval (reject if > 5 minutes old)
- Auto-delete after verification (one-time use)

**Rate Limiting**:
- In-memory Map: 10 challenge requests per minute per email
- Clean up stale entries every 5 minutes
- Location: `authRouter` before `generateRegistrationOptions()`

**Counter Validation**:
- Store counter in `passkeys.counter` column
- Verify `newCounter > storedCounter` on each authentication
- Update stored counter after successful verification
- Prevents replay attacks

**userHandle Validation**:
- During login verification, validate `response.userHandle === passkey.webauthn_user_id`
- Prevents credential swapping attacks
- Reject authentication if mismatch

**Reference Implementation**: See [frontend-community-simple](https://github.com/kdaisho/frontend-community-simple/blob/main/apps/server/src/services/auth/index.ts) for production-quality patterns

### Session Management

**Session Creation**:
```typescript
// After successful WebAuthn verification
const sessionToken = crypto.randomUUID();
const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

await db.insert(sessions).values({
  user_id: user.id,
  token: sessionToken,
  expires_at: expiresAt,
});

cookies.set('session', sessionToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
});
```

**Session Validation** (SvelteKit hooks):
```typescript
// src/hooks.server.ts
export async function handle({ event, resolve }) {
  const sessionToken = event.cookies.get('session');

  if (sessionToken) {
    const session = await db.query.sessions.findFirst({
      where: and(
        eq(sessions.token, sessionToken),
        gt(sessions.expires_at, new Date())
      ),
      with: { user: true },
    });

    if (session) {
      event.locals.user = session.user;
    }
  }

  return resolve(event);
}
```

### Database Access Layer

**Recommended**: Drizzle ORM or Kysely for type-safe queries

**DAO Pattern** (Data Access Object):
- Separate DB queries from business logic
- Location: `src/lib/server/db/dao/auth.ts`
- Functions: `findUserByEmail`, `savePasskey`, `saveChallenge`, `getChallenge`, `saveSession`, etc.

**Example**:
```typescript
// src/lib/server/db/dao/auth.ts
export async function findUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email),
  });
}

export async function saveChallenge(userId: string, challenge: string, registrationOptionsUserId?: string) {
  // Delete existing challenges for this user
  await db.delete(current_challenge).where(eq(current_challenge.user_id, userId));

  return db.insert(current_challenge).values({
    user_id: userId,
    challenge,
    registration_options_user_id: registrationOptionsUserId,
    expires_at: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
  });
}
```

### Rate Limiting Implementation

**In-memory rate limiter** (simple, resets on server restart):
```typescript
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(email: string): void {
  const now = Date.now();
  const key = email.toLowerCase();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return;
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    throw new TRPCError({
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many authentication attempts. Please try again later.',
    });
  }

  record.count++;
}

// Cleanup every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);
```

**Future**: Use Redis for distributed rate limiting in production

### PDF Operations (Client-Side Only)

All PDF manipulation happens in-browser using `pdf-lib`. **Never upload PDFs to server.**

**Dynamic import pattern**:
```typescript
// Lazy-load pdf-lib (~300kb) only when needed
async function loadPdfLib() {
  const { PDFDocument } = await import('pdf-lib');
  return PDFDocument;
}
```

**Merge operation**:
```typescript
async function mergePDFs(files: File[]) {
  const PDFDocument = await loadPdfLib();
  const mergedPdf = await PDFDocument.create();

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(page => mergedPdf.addPage(page));
  }

  const pdfBytes = await mergedPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
```

**Code examples**: See `examples/pdf-operations.ts`

### Business Rules (Phase 2)

**Free Tier** (All users with accounts):
- View PDFs
- Search PDFs
- Download PDFs
- Merge/split (up to 10 operations per day)

**Rate Limiting**:
- Track `usage_count_today` in `users` table
- Reset daily via cron job or on-demand check (`last_reset_date`)
- Display remaining operations in UI

**Protected Routes**:
- `/dashboard`: Requires auth
- `/setup`: Requires auth (passkey registration)
- `/`: Public (PDF viewer)

## Phase 3: Monetization (Future - Deferred)

### Stripe Integration

**When to implement**: After Phase 2 auth is stable and users request paid features

**Components needed**:
- `stripeRouter` with `createCheckoutSession`, `createPortalSession` procedures
- `/api/webhooks/+server.ts` for Stripe webhook (standard POST, not TRPC)
- Add `stripe_customer_id`, `subscription_status`, `is_pro` to `users` table

**Payment flow**:
```typescript
// Client
const { url } = await trpc.stripe.createCheckoutSession.mutate();
window.location.href = url; // Redirect to Stripe

// Webhook (after payment)
if (event.type === 'checkout.session.completed') {
  await db.update(users)
    .set({ is_pro: true, subscription_status: 'active' })
    .where(eq(users.email, session.customer_email));
}
```

**Code examples**: See `examples/trpc-setup/stripe-router.ts` (to be created in Phase 3)

**Critical**: Stripe webhooks MUST verify signatures:
```typescript
const event = stripe.webhooks.constructEvent(
  body,
  sig,
  process.env.STRIPE_WEBHOOK_SECRET!
);
```

### Feature Gating

**TRPC middleware** (Phase 3):
```typescript
const isProUser = t.middleware(({ ctx, next }) => {
  if (!ctx.user?.is_pro) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Pro subscription required' });
  }
  return next({ ctx });
});

export const proProcedure = protectedProcedure.use(isProUser);
```

**Pro Features** (future):
- Unlimited operations per day
- Files >50MB
- Batch operations (merge 10+ PDFs)
- Priority support

## Phase 4: Cloud Sync (Optional - User-Requested Only)

**Only implement if users demand cross-device sync**

### Object Storage Integration

**Components**:
- Cloudflare R2 or S3 for encrypted PDF storage
- `pdf_projects` table (user_id, file_key, editing_state_json, updated_at)
- Auto-delete files after 7 days

**Privacy considerations**:
- Default: Files stay 100% local (current behavior)
- Opt-in: "Save to cloud" button uploads encrypted PDF
- Clear UI warning about privacy trade-off
- User can delete cloud projects anytime

**Not implementing yet** - defer until Phase 4

## Data Models

### Current Schema (Phase 2)

See `architecture.md` for full SQL schema with:
- `users` table
- `passkeys` table (WebAuthn credentials)
- `current_challenge` table (temporary, 5-min TTL)
- `sessions` table (7-day expiry)

### Future Schema Extensions

**Phase 3 (Monetization)**:
```sql
ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN subscription_status TEXT; -- 'active' | 'past_due' | 'canceled' | NULL
ALTER TABLE users ADD COLUMN is_pro BOOLEAN DEFAULT FALSE;
```

**Phase 4 (Cloud Sync)**:
```sql
CREATE TABLE pdf_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  file_key TEXT NOT NULL,           -- R2/S3 object key
  editing_state_json JSONB,         -- Selected pages, operations
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  auto_delete_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);
```

## Reference Implementations

**Production example**: [frontend-community-simple](https://github.com/kdaisho/frontend-community-simple)

**Key learnings**:
- TRPC integration: All auth procedures are type-safe routers
- Challenge management: Separate `current_challenge` table with TTL validation
- Security: Rate limiting, counter validation, userHandle verification
- DAO pattern: Clean separation of DB queries and business logic
- Kysely migrations: Schema versioning with type safety

**Code to review**:
- `apps/server/src/services/auth/index.ts` - authRouter implementation
- `apps/server/src/services/auth/dao.ts` - DAO pattern
- `apps/server/database/migrations/` - Database schema evolution
