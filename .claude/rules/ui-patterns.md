---
description: 'UI components, styling, and UX patterns for PDF Splitter'
---

# UI Patterns & Styling

## Styling Philosophy

- **Custom CSS**: Full control, no utility framework overhead (no Tailwind)
- **Component-scoped styles**: Use `<style>` blocks in `.svelte` files
- **Melt UI**: For interactive primitives (dialogs, dropdowns, tabs) - handles behavior, you style visually
- **Performance**: Code-split heavy libraries (PDF.js, pdf-lib) with dynamic imports

## Current UI Implementation (Phase 1)

### PDF Viewer

- **Canvas rendering**: Default 1.5x viewport scale for clarity
- **Text layer overlay**: Enables text selection and search
- **File upload**: ArrayBuffer → `getDocument()` → render loop

### Search Implementation

- **Data structure**: `PageTextData[]` stores text items + transform matrices
- **Highlight rendering**: Absolute positioned overlays calculated from PDF transform matrices
  - Transform matrix format: `[scaleX, skewY, skewX, scaleY, translateX, translateY]`
- **Keyboard navigation**:
  - `Enter`: Next match
  - `Shift+Enter`: Previous match
  - `Escape`: Clear search

### Key Data Structure

```typescript
interface PageTextData {
	pageWrapper: HTMLElement;
	viewport: { width: number; height: number; scale: number };
	textItems: Array<{
		str: string;
		transform: number[]; // PDF transform matrix
		width: number;
		height: number;
	}>;
}
```

## Planned UI Patterns (Phase 2+)

### Melt UI Components Needed

- **Dialog**: Upgrade prompts, confirmations, delete warnings
- **DropdownMenu**: File actions menu (split, merge, delete pages)
- **Tabs**: Switch between merge/split/compress modes
- **Progress**: Upload/processing progress bars
- **Tooltip**: Feature explanations, pro-tier badges

### Melt UI Usage Pattern

Melt UI provides headless (unstyled) component builders. You control all visual design via CSS.

**Installation**:

```bash
pnpm add @melt-ui/svelte
```

**Example usage**: See `examples/melt-ui-dialog.svelte`

**Styling approach**:

- Melt UI handles: keyboard nav, focus management, ARIA attributes, state
- You write: All visual CSS (colors, spacing, animations, shadows)

### PDF Operations UI (Phase 2)

#### Thumbnail Grid

- Visual page selection before merge/split
- Drag-and-drop reordering using `dnd-kit-svelte`
- Checkbox multi-select for batch operations

#### File Upload Dropzone

- Drag-and-drop zone for multiple PDFs
- File list with remove buttons
- Visual feedback for invalid files

#### Page Manipulation

- Reorder pages via drag-and-drop
- Delete pages with Melt UI dialog confirmation
- Visual preview before download

## Component Organization

```
src/
├── routes/
│   ├── +page.svelte                    # Main PDF viewer (Phase 1)
│   └── (authed)/                       # Protected routes (Phase 2+)
│       ├── dashboard/+page.svelte
│       └── setup/+page.svelte          # Passkey registration
├── lib/
│   ├── components/
│   │   ├── Button.svelte
│   │   ├── Dialog.svelte               # Melt UI wrapper
│   │   ├── FileUpload.svelte
│   │   └── ThumbnailGrid.svelte        # Phase 2
│   └── stores/
│       └── pdfStore.ts                 # PDF state management
```

## Performance Constraints

### Code Splitting

Always use dynamic imports for heavy libraries to avoid bloating initial bundle:

```typescript
// PDF.js dynamic import
async function loadPdfJs() {
	if (!pdfjs) {
		const { getDocument, GlobalWorkerOptions, TextLayer } = await import('pdfjs-dist');
		const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
		GlobalWorkerOptions.workerSrc = worker.default;
		pdfjs = { getDocument, GlobalWorkerOptions, TextLayer };
	}
	return pdfjs;
}
```

### Bundle Size Goals

- Initial bundle: <100kb (excludes PDF.js, pdf-lib - loaded on demand)
- PDF.js: ~500kb (lazy-loaded when user uploads file)
- pdf-lib: ~300kb (lazy-loaded when user performs operations)

## Accessibility

- **Keyboard navigation**: All interactive elements accessible via Tab/Enter/Escape
- **ARIA labels**: Melt UI handles this automatically for primitives
- **Focus management**: Dialog traps focus, returns to trigger on close
- **Screen reader**: Announce search results, page navigation, operation status
