# PDF Splitter Project

## Current Implementation Status

This is a SvelteKit-based PDF viewer with search functionality. The project is currently in **Phase 1** (basic viewer) with plans to expand into a full-featured PDF manipulation tool with paid features.

### What's Currently Built

- **PDF Viewer**: Renders PDFs using PDF.js with canvas + text layer
- **Text Search**: Full-text search with highlight navigation
- **Download**: Download the currently viewed PDF
- **Client-Side Processing**: All PDF operations happen in the browser

### Tech Stack (Current)

- **Framework**: SvelteKit 2.x with Svelte 5
- **PDF Rendering**: `pdfjs-dist` v5.3.31 (for display)
- **PDF Manipulation**: `pdf-lib` v1.17.1 (installed but not yet used)
- **Build**: Vite 6.x
- **Adapter**: `@sveltejs/adapter-node` (server-side rendering capable)
- **Language**: TypeScript

## Project Architecture

### File Structure

```
pdf-splitter/
├── src/
│   ├── routes/
│   │   ├── +page.svelte          # Main PDF viewer UI
│   │   └── +page.server.ts       # Server load function (minimal)
│   ├── lib/                      # Shared utilities (currently empty)
│   └── app.d.ts                  # TypeScript app definitions
├── package.json
├── svelte.config.js
└── tsconfig.json
```

### Core Components

#### `/src/routes/+page.svelte` (385 lines)

**PDF Rendering Flow**:
1. Dynamic import of PDF.js (code-split to reduce initial bundle)
2. Worker configuration: `pdfjs-dist/build/pdf.worker.mjs`
3. File upload → ArrayBuffer → `getDocument()` → render loop
4. For each page:
   - Create canvas with viewport scaling (default 1.5x)
   - Render PDF page to canvas
   - Create text layer for selection + search
   - Store text content for search indexing

**Search Implementation**:
- Stores `PageTextData[]` with text items + transform matrices
- On search: builds combined text with character position mapping
- Creates positioned highlight overlays using CSS absolute positioning
- Calculates positions from PDF transform matrices: `[scaleX, skewY, skewX, scaleY, translateX, translateY]`
- Supports keyboard navigation: Enter (next), Shift+Enter (prev), Escape (clear)

**Key Data Structures**:
```typescript
interface PageTextData {
  pageWrapper: HTMLElement;
  viewport: { width: number; height: number; scale: number };
  textItems: Array<{
    str: string;
    transform: number[];  // PDF transform matrix
    width: number;
    height: number;
  }>;
}
```

## Planned Architecture: Full-Stack PDF Tool

### Vision

Transform into a professional PDF manipulation tool with freemium model:
- **Free Tier**: Basic view/search (current functionality)
- **Pro Tier**: Merge, split, reorder, compress (>50MB files)

### Target Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend Framework | SvelteKit (existing) | Handles both UI and API routes |
| PDF Processing | `pdf-lib` (browser) | Privacy-first, no server upload needed |
| PDF Rendering | PDF.js (existing) | Thumbnail generation for drag-drop UI |
| UI Components | `shadcn-svelte` + Tailwind | Accessible, customizable components |
| Drag-and-Drop | `dnd-kit-svelte` | Page reordering before merge |
| Payment | **Stripe** | Full control, better margins than Lemon Squeezy |
| Auth | Better Auth or Supabase Auth | User session management |
| Database | Supabase (PostgreSQL) | Track subscriptions + user state |
| Hosting | Vercel or Cloudflare | Serverless API routes |

### Architecture: Edge-First Hybrid

**Frontend (Client-Side)**:
- Heavy lifting: PDF merge/split using `pdf-lib` on `ArrayBuffer`
- Files never uploaded (privacy + cost savings)
- Renders thumbnails for visual page selection

**Backend (SvelteKit API Routes)**:
- `/api/checkout`: Create Stripe Checkout Session
- `/api/webhooks`: Handle Stripe events (payment confirmation)
- `/api/portal`: Generate Stripe Customer Portal link
- All use `stripe` Node.js SDK

**Data Model** (Future):
```sql
users (
  id,
  email,
  stripe_customer_id,
  subscription_status  -- active | past_due | canceled
  is_pro BOOLEAN
)
```

### Payment Flow (Stripe Integration)

1. **User Action**: Clicks "Upgrade" on Pro feature
2. **Checkout**: Call `/api/checkout` → returns Stripe hosted page URL
3. **Payment**: User redirected to Stripe, enters payment
4. **Webhook**: Stripe sends `checkout.session.completed` to `/api/webhooks`
5. **Verification**: Server verifies signature, updates `users.is_pro = true`
6. **Access**: User redirected back, app grants Pro features

### Critical Implementation Notes

**Stripe as Merchant of Record**:
- You handle tax compliance (enable **Stripe Tax** in dashboard)
- Must implement webhook signature verification (security critical)
- Test mode required before production (use test API keys)
- Consider VAT/sales tax thresholds if selling globally

**Security Requirements**:
- Never expose Stripe secret key to client
- Validate webhook signatures using `stripe.webhooks.constructEvent()`
- Store customer IDs securely, never log payment details

## Development Guidelines

### Running the Project

```bash
pnpm install
pnpm run dev          # Start dev server
pnpm run build        # Production build
pnpm run preview      # Test production build
```

### Code Style

- **TypeScript**: Strict mode enabled
- **Formatting**: Prettier (run `pnpm run format`)
- **Linting**: ESLint + svelte-eslint-plugin (run `pnpm run lint`)
- **Testing**: Vitest configured (run `pnpm test`)

### PDF.js Usage Pattern

Always use dynamic import to avoid bloating initial bundle:
```typescript
async function loadPdfJs() {
  if (!pdfjs) {
    const { getDocument, GlobalWorkerOptions, TextLayer } =
      await import('pdfjs-dist');
    const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
    GlobalWorkerOptions.workerSrc = worker.default;
    pdfjs = { getDocument, GlobalWorkerOptions, TextLayer };
  }
  return pdfjs;
}
```

### pdf-lib Usage (Future)

```typescript
import { PDFDocument } from 'pdf-lib';

// Merge example
async function mergePDFs(files: File[]) {
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

## Implementation Roadmap

### Phase 1: Current State ✅
- [x] PDF viewer with PDF.js
- [x] Text layer rendering
- [x] Search with highlights
- [x] Download functionality

### Phase 2: Core PDF Features
- [ ] PDF merge (multiple files → one PDF)
- [ ] PDF split (one PDF → multiple files)
- [ ] Page reorder (drag-drop interface)
- [ ] Page deletion
- [ ] Thumbnail preview grid

### Phase 3: Monetization
- [ ] Supabase setup + user auth
- [ ] Database schema for users/subscriptions
- [ ] Stripe integration:
  - [ ] Create product + prices in Stripe dashboard
  - [ ] `/api/checkout` endpoint
  - [ ] `/api/webhooks` with signature verification
  - [ ] `/api/portal` for subscription management
- [ ] Feature gating (free vs. pro)
- [ ] Stripe Tax configuration

### Phase 4: Polish
- [ ] Compress PDFs (quality slider)
- [ ] Extract pages (page range selector)
- [ ] Password protection (pdf-lib encryption)
- [ ] Batch operations UI
- [ ] Mobile responsive design

## Key Constraints

1. **Privacy-First**: Never upload PDFs to server (process in browser)
2. **Performance**: Code-split heavy libraries (PDF.js, pdf-lib)
3. **Token Efficiency**: Keep client bundles small for fast load times
4. **Security**: Stripe webhooks require signature validation
5. **Compliance**: Must handle tax collection for paid features

## Environment Variables (Future)

```bash
# .env
PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...
```

## Deployment Checklist

- [ ] Configure adapter for target platform (Vercel/Cloudflare)
- [ ] Set environment variables in hosting dashboard
- [ ] Configure Stripe webhook URL: `https://yourdomain.com/api/webhooks`
- [ ] Enable Stripe Tax if selling globally
- [ ] Test webhook delivery in Stripe dashboard
- [ ] Set up error monitoring (Sentry recommended)

## Resources

- [SvelteKit Docs](https://kit.svelte.dev/docs)
- [PDF.js API](https://mozilla.github.io/pdf.js/api/)
- [pdf-lib Guide](https://pdf-lib.js.org/)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe Tax](https://stripe.com/tax)
