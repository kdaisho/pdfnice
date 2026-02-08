---
description: 'Business logic, data models, and API patterns for PDF Splitter'
---

# Logic & Data

## Phase 2: Auth Foundation (Current Priority)

### SvelteKit Form Actions

**Why Form Actions over tRPC**:

- **Native SvelteKit**: No extra dependencies
- **Progressive enhancement**: Forms work without JavaScript
- **Built-in CSRF protection**: SvelteKit handles this automatically
- **Simpler mental model**: Standard web forms, no abstraction layer

**Core Concepts**:

- **Actions**: Server functions triggered by form POST
- **Load functions**: Fetch data for page rendering
- **ActionData**: Return data from actions to the page
- **use:enhance**: Progressive enhancement for JS-enabled clients

**Setup locations**:

- Actions: `src/routes/**/+page.server.ts` (export `actions`)
- Load: `src/routes/**/+page.server.ts` or `+layout.server.ts` (export `load`)
- Hooks: `src/hooks.server.ts` (session validation)

**Code examples**: See `examples/form-actions/` for full implementation

#### Form Action Pattern

```typescript
// src/routes/signin/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import type { Actions } from './$types';

const emailSchema = z.object({
	email: z.string().email()
});

export const actions: Actions = {
	getOptions: async ({ request, cookies }) => {
		const formData = await request.formData();
		const result = emailSchema.safeParse({ email: formData.get('email') });

		if (!result.success) {
			return fail(400, { error: 'Invalid email' });
		}

		// Generate WebAuthn challenge...
		return { options: challengeOptions };
	},

	verify: async ({ request, cookies }) => {
		// Verify WebAuthn response, create session...
		redirect(303, '/dashboard');
	}
};
```

#### Protected Routes via Layout

```typescript
// src/routes/(authed)/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		redirect(303, '/signin');
	}
	return { user: locals.user };
};
```

### SimpleWebAuthn Integration

**Installation**:

```bash
pnpm add @simplewebauthn/server @simplewebauthn/browser zod
```

**Architecture**: Challenge-response authentication

- Client (`@simplewebauthn/browser`): Interacts with device authenticator (Touch ID/Face ID)
- Server (`@simplewebauthn/server`): Generates challenges, verifies responses

**Integration pattern**: SimpleWebAuthn exposed via SvelteKit form actions

#### Registration Flow

```
1. POST /setup?/getOptions     → Action returns PublicKeyCredentialCreationOptionsJSON
2. Client calls startRegistration() with options
3. POST /setup?/verify         → Action saves passkey, creates session
```

**Client example** (`+page.svelte`):

```svelte
<script lang="ts">
	import { enhance } from '$app/forms';
	import { startRegistration } from '@simplewebauthn/browser';
	import type { ActionData } from './$types';

	export let form: ActionData;

	async function handleRegistration(event: SubmitEvent) {
		// After getOptions action returns, call WebAuthn API
		if (form?.options) {
			const response = await startRegistration(form.options);
			// Submit verification form with response
			const verifyForm = document.getElementById('verify-form') as HTMLFormElement;
			const input = verifyForm.querySelector('input[name="response"]') as HTMLInputElement;
			input.value = JSON.stringify(response);
			verifyForm.requestSubmit();
		}
	}
</script>

<form method="POST" action="?/getOptions" use:enhance on:submit={handleRegistration}>
	<input name="email" type="email" required />
	<button type="submit">Register</button>
</form>

<form id="verify-form" method="POST" action="?/verify" use:enhance hidden>
	<input name="email" type="hidden" value={form?.email} />
	<input name="response" type="hidden" />
</form>
```

**Server example**: See `examples/form-actions/auth-actions.ts`

#### Authentication Flow

```
1. POST /signin?/getOptions    → Action returns PublicKeyCredentialRequestOptionsJSON
2. Client calls startAuthentication() with options
3. POST /signin?/verify        → Action verifies signature, creates session cookie
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
- Location: Form action before `generateRegistrationOptions()`

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
	expires_at: expiresAt
});

cookies.set('session', sessionToken, {
	httpOnly: true,
	secure: true,
	sameSite: 'strict',
	maxAge: 60 * 60 * 24 * 7, // 7 days
	path: '/'
});
```

**Session Validation** (SvelteKit hooks):

```typescript
// src/hooks.server.ts
export async function handle({ event, resolve }) {
	const sessionToken = event.cookies.get('session');

	if (sessionToken) {
		const session = await db.query.sessions.findFirst({
			where: and(eq(sessions.token, sessionToken), gt(sessions.expires_at, new Date())),
			with: { user: true }
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
		where: eq(users.email, email)
	});
}

export async function saveChallenge(
	userId: string,
	challenge: string,
	registrationOptionsUserId?: string
) {
	// Delete existing challenges for this user
	await db.delete(current_challenge).where(eq(current_challenge.user_id, userId));

	return db.insert(current_challenge).values({
		user_id: userId,
		challenge,
		registration_options_user_id: registrationOptionsUserId,
		expires_at: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
	});
}
```

### Rate Limiting Implementation

**In-memory rate limiter** (simple, resets on server restart):

```typescript
// src/lib/server/rate-limit.ts
import { fail } from '@sveltejs/kit';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

export function checkRateLimit(email: string): { error: string } | null {
	const now = Date.now();
	const key = email.toLowerCase();
	const record = rateLimitMap.get(key);

	if (!record || now > record.resetTime) {
		rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
		return null;
	}

	if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
		return { error: 'Too many authentication attempts. Please try again later.' };
	}

	record.count++;
	return null;
}

// Usage in form action:
export const actions = {
	getOptions: async ({ request }) => {
		const formData = await request.formData();
		const email = formData.get('email') as string;

		const rateLimitError = checkRateLimit(email);
		if (rateLimitError) {
			return fail(429, rateLimitError);
		}

		// Continue with WebAuthn...
	}
};
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
		pages.forEach((page) => mergedPdf.addPage(page));
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

- Form actions: `checkout`, `portal` in billing page
- `/api/webhooks/+server.ts` for Stripe webhook (POST endpoint)
- Add `stripe_customer_id`, `subscription_status`, `is_pro` to `users` table

**Payment flow**:

```typescript
// src/routes/(authed)/billing/+page.server.ts
import { redirect } from '@sveltejs/kit';
import Stripe from 'stripe';
import type { Actions } from './$types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const actions: Actions = {
	checkout: async ({ locals }) => {
		const session = await stripe.checkout.sessions.create({
			customer_email: locals.user.email,
			line_items: [{ price: 'price_xxx', quantity: 1 }],
			mode: 'subscription',
			success_url: `${process.env.PUBLIC_ORIGIN}/billing?success=true`,
			cancel_url: `${process.env.PUBLIC_ORIGIN}/billing`
		});

		redirect(303, session.url!);
	}
};
```

**Webhook handler** (`/api/webhooks/+server.ts`):

```typescript
import type { RequestHandler } from './$types';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const POST: RequestHandler = async ({ request }) => {
	const body = await request.text();
	const sig = request.headers.get('stripe-signature')!;

	// CRITICAL: Verify webhook signature
	const event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);

	if (event.type === 'checkout.session.completed') {
		const session = event.data.object;
		await db
			.update(users)
			.set({ is_pro: true, subscription_status: 'active' })
			.where(eq(users.email, session.customer_email));
	}

	return new Response('OK', { status: 200 });
};
```

### Feature Gating

**Load function check** (Phase 3):

```typescript
// src/routes/(authed)/(pro)/+layout.server.ts
import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user?.is_pro) {
		redirect(303, '/billing?upgrade=true');
	}
	return { user: locals.user };
};
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

**Key learnings** (from prior projects):

- Challenge management: Separate `current_challenge` table with TTL validation
- Security: Rate limiting, counter validation, userHandle verification
- DAO pattern: Clean separation of DB queries and business logic
- Form actions: Natural fit for auth flows (submit email → get challenge → verify)
