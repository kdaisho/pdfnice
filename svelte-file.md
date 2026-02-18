# PDF Splitter

## Text Search Functionality

Please suggest changes to the svelte file (svelte-file.md). The text search functionality has issue that it can't highlight the words accurately especially when the font size are different. Highlight won't cover fully when the font is large (e.g. titles)

## Current Code

```svelte
<script lang="ts">
	import 'pdfjs-dist/web/pdf_viewer.css';
	import type { getDocument } from 'pdfjs-dist/types/src/display/api';
	import type { GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let pdfjs: {
		getDocument: typeof getDocument;
		GlobalWorkerOptions: typeof GlobalWorkerOptions;
		TextLayer: typeof TextLayer;
	} | null = null;

	async function loadPdfJs() {
		if (!pdfjs) {
			const { getDocument, GlobalWorkerOptions, TextLayer } = await import('pdfjs-dist');
			const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
			GlobalWorkerOptions.workerSrc = worker.default;
			pdfjs = { getDocument, GlobalWorkerOptions, TextLayer };
		}
		return pdfjs;
	}

	let pdfFile = $state<File | null>(null);
	let pdfUrl = $state<string | null>(null);

	// Store page data for search
	interface PageTextData {
		pageWrapper: HTMLElement;
		viewport: { width: number; height: number; scale: number };
		textDivs: HTMLElement[];
		textContentItemsStr: string[];
	}
	let pagesData: PageTextData[] = [];

	// Search state
	let searchQuery = $state<string>('');
	let matchCount = $state<number>(0);
	let currentMatchIndex = $state<number>(0);
	let highlightElements: HTMLElement[] = [];
	let searchInputEl = $state<HTMLInputElement | null>(null);
	let matchCase = $state<boolean>(false);
	let matchWholeWord = $state<boolean>(false);
	let showSearchPopup = $state<boolean>(false);

	function performSearch() {
		// Clear previous highlights
		document.querySelectorAll('.search-highlight-overlay').forEach((el) => el.remove());
		highlightElements = [];
		matchCount = 0;
		currentMatchIndex = 0;

		if (!searchQuery.trim() || pagesData.length === 0) return;

		const query = matchCase ? searchQuery : searchQuery.toLowerCase();

		pagesData.forEach((pageData) => {
			const { textDivs, textContentItemsStr, pageWrapper } = pageData;

			// Build charMap: charMap[absoluteIdx] = {divIdx, offset}
			interface CharPos {
				divIdx: number;
				offset: number;
			}
			const charMap: CharPos[] = [];
			let combinedText = '';
			for (let d = 0; d < textContentItemsStr.length; d++) {
				const s = textContentItemsStr[d];
				for (let o = 0; o < s.length; o++) charMap.push({ divIdx: d, offset: o });
				combinedText += s;
			}

			const textToSearch = matchCase ? combinedText : combinedText.toLowerCase();
			let searchPos = 0;

			while (true) {
				const matchStart = textToSearch.indexOf(query, searchPos);
				if (matchStart === -1) break;

				if (matchWholeWord) {
					const before = matchStart > 0 ? textToSearch[matchStart - 1] : ' ';
					const after =
						matchStart + query.length < textToSearch.length
							? textToSearch[matchStart + query.length]
							: ' ';
					if (/\w/.test(before) || /\w/.test(after)) {
						searchPos = matchStart + 1;
						continue;
					}
				}

				const endIdx = matchStart + query.length - 1;
				const startPos = charMap[matchStart];
				const endPos = charMap[endIdx];

				if (!startPos || !endPos) {
					searchPos = matchStart + 1;
					continue;
				}

				const currentMatchIdx = matchCount++;
				const wrapperRect = pageWrapper.getBoundingClientRect();

				// Use div.getBoundingClientRect() for pixel-perfect size/position — this
				// correctly accounts for PDF.js CSS transforms (scaleX, scale, CSS vars).
				// Within the div, use proportional fractions for x-offset (monospace
				// approximation within a single text item, which is acceptable since each
				// div is typically a short word or run of text).
				for (let divIdx = startPos.divIdx; divIdx <= endPos.divIdx; divIdx++) {
					const div = textDivs[divIdx];
					const divText = textContentItemsStr[divIdx];
					if (!divText || divText.length === 0) continue;

					const segStart = divIdx === startPos.divIdx ? startPos.offset : 0;
					const segEnd = divIdx === endPos.divIdx ? endPos.offset + 1 : divText.length;

					const divRect = div.getBoundingClientRect();
					if (divRect.width === 0 && divRect.height === 0) continue;

					const startFrac = segStart / divText.length;
					const endFrac = segEnd / divText.length;

					const highlight = document.createElement('div');
					highlight.className = 'search-highlight-overlay';
					highlight.dataset.matchIndex = String(currentMatchIdx);
					highlight.style.left = `${divRect.left - wrapperRect.left + startFrac * divRect.width}px`;
					highlight.style.top = `${divRect.top - wrapperRect.top}px`;
					highlight.style.width = `${(endFrac - startFrac) * divRect.width}px`;
					highlight.style.height = `${divRect.height}px`;
					pageWrapper.appendChild(highlight);
					highlightElements.push(highlight);
				}

				searchPos = matchStart + 1;
			}
		});

		if (highlightElements.length > 0) scrollToMatch(0);
	}

	function scrollToMatch(index: number) {
		highlightElements.forEach((el) => el.classList.remove('current-match'));

		if (matchCount === 0) return;

		currentMatchIndex = ((index % matchCount) + matchCount) % matchCount;

		const currentHighlights = highlightElements.filter(
			(el) => el.dataset.matchIndex === String(currentMatchIndex)
		);
		currentHighlights.forEach((el) => el.classList.add('current-match'));

		if (currentHighlights.length > 0) {
			currentHighlights[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	}

	function nextMatch() {
		scrollToMatch(currentMatchIndex + 1);
	}

	function prevMatch() {
		scrollToMatch(currentMatchIndex - 1);
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			searchQuery = '';
			performSearch();
			showSearchPopup = false;
		}
	}

	function openSearch() {
		showSearchPopup = true;
		// Focus after DOM update
		setTimeout(() => {
			searchInputEl?.focus();
			searchInputEl?.select();
		}, 0);
	}

	function closeSearch() {
		searchQuery = '';
		performSearch();
		showSearchPopup = false;
	}

	function toggleMatchCase() {
		matchCase = !matchCase;
		performSearch();
	}

	function toggleMatchWholeWord() {
		matchWholeWord = !matchWholeWord;
		performSearch();
	}

	$effect(() => {
		const hasPdf = Boolean(pdfUrl);
		function onKeydown(e: KeyboardEvent) {
			// Cmd+f: Open search popup (always prevent browser's native find dialog)
			if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
				e.preventDefault();
				if (hasPdf) {
					openSearch();
				}
			}
			// Cmd+g: Next match
			if ((e.metaKey || e.ctrlKey) && e.key === 'g' && !e.shiftKey && !e.altKey) {
				if (hasPdf && matchCount > 0) {
					e.preventDefault();
					nextMatch();
				}
			}
			// Cmd+Shift+g: Previous match
			if ((e.metaKey || e.ctrlKey) && e.key === 'g' && e.shiftKey && !e.altKey) {
				if (hasPdf && matchCount > 0) {
					e.preventDefault();
					prevMatch();
				}
			}
			// Cmd+Opt+c: Toggle match case
			if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyC') {
				if (hasPdf) {
					e.preventDefault();
					toggleMatchCase();
				}
			}
			// Cmd+Opt+w: Toggle match whole word
			if ((e.metaKey || e.ctrlKey) && e.altKey && e.code === 'KeyW') {
				if (hasPdf) {
					e.preventDefault();
					toggleMatchWholeWord();
				}
			}
		}
		document.addEventListener('keydown', onKeydown, true);
		return () => document.removeEventListener('keydown', onKeydown, true);
	});

	async function handleFileChange(event: Event) {
		if (!(event.target instanceof HTMLInputElement)) return;
		const pdfjs = await loadPdfJs();
		const input = event.target;

		const container = document.getElementById('pdf-container');

		if (input.files && input.files[0] && container) {
			pdfFile = input.files[0];
			pdfUrl = URL.createObjectURL(pdfFile);
			container.innerHTML = '';
			pagesData = [];
			searchQuery = '';
			matchCount = 0;

			const fileReader = new FileReader();

			fileReader.onload = async (e) => {
				if (!e.target || !(e.target.result instanceof ArrayBuffer)) return;
				const pdf = await pdfjs.getDocument({ data: new Uint8Array(e.target.result) }).promise;

				for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
					const page = await pdf.getPage(pageNum);
					const viewport = page.getViewport({ scale: 1.5 });

					// Create page wrapper
					const pageWrapper = document.createElement('div');
					pageWrapper.className = 'page-wrapper';
					pageWrapper.style.width = `${viewport.width}px`;
					pageWrapper.style.height = `${viewport.height}px`;

					// Create and render canvas
					const canvas = document.createElement('canvas');
					const context = canvas.getContext('2d');

					if (!context) return;

					canvas.height = viewport.height;
					canvas.width = viewport.width;

					await page.render({ canvasContext: context, viewport }).promise;
					pageWrapper.appendChild(canvas);

					// Create and render text layer
					const textLayerDiv = document.createElement('div');
					textLayerDiv.className = 'textLayer';
					const PDF_TO_CSS_UNITS = 96 / 72;
					textLayerDiv.style.setProperty(
						'--scale-factor',
						(viewport.scale * PDF_TO_CSS_UNITS).toString()
					);

					const textContent = await page.getTextContent();

					const textLayer = new pdfjs.TextLayer({
						textContentSource: textContent,
						container: textLayerDiv,
						viewport: viewport
					});
					await textLayer.render();
					pageWrapper.appendChild(textLayerDiv);

					// Use querySelectorAll to get actual text spans — excludes markedContent
					// wrapper divs, giving guaranteed 1:1 alignment with text content strings.
					const textSpans = Array.from(
						textLayerDiv.querySelectorAll<HTMLElement>('span:not(.markedContent)')
					);
					pagesData.push({
						pageWrapper,
						viewport: { width: viewport.width, height: viewport.height, scale: viewport.scale },
						textDivs: textSpans,
						textContentItemsStr: textSpans.map((s) => s.textContent ?? '')
					});

					container.appendChild(pageWrapper);
				}
			};
			fileReader.readAsArrayBuffer(pdfFile);
		}
	}
</script>

<header class="nav-header">
	<h1>PDF Splitter</h1>
	<nav>
		{#if pdfUrl}
			<button
				onclick={openSearch}
				class="search-icon-btn"
				title="Search in document (Cmd+F)"
				aria-label="Search in document"
			>
				<svg
					width="18"
					height="18"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="11" cy="11" r="8" />
					<path d="M21 21l-4.35-4.35" />
				</svg>
			</button>
		{/if}
		{#if data.user}
			<a href="/dashboard">Dashboard</a>
		{:else}
			<a href="/setup">Login / Sign Up</a>
		{/if}
	</nav>
</header>

<div class="content">
	{#if pdfUrl && showSearchPopup}
		<div class="search-popup">
			<div class="search-input-wrapper">
				<input
					type="text"
					placeholder="Find in document"
					bind:value={searchQuery}
					bind:this={searchInputEl}
					oninput={performSearch}
					onkeydown={handleSearchKeydown}
					class="search-input"
				/>
				<span class="match-count">
					{#if matchCount > 0}
						{currentMatchIndex + 1} of {matchCount}
					{:else if searchQuery.trim()}
						No results
					{/if}
				</span>
			</div>
			<div class="search-controls">
				<button
					onclick={toggleMatchCase}
					class="toggle-btn"
					class:active={matchCase}
					title="Match Case (Cmd+Opt+C)"
					aria-label="Match case"
					aria-pressed={matchCase}
				>
					Aa
				</button>
				<button
					onclick={toggleMatchWholeWord}
					class="toggle-btn"
					class:active={matchWholeWord}
					title="Match Whole Word (Cmd+Opt+W)"
					aria-label="Match whole word"
					aria-pressed={matchWholeWord}
				>
					<span class="whole-word-icon">W</span>
				</button>
				<div class="nav-buttons">
					<button
						onclick={prevMatch}
						class="nav-btn"
						title="Previous (Cmd+Shift+G)"
						aria-label="Previous match"
						disabled={matchCount === 0}
					>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
							<path d="M6 3L1 8h10L6 3z" />
						</svg>
					</button>
					<button
						onclick={nextMatch}
						class="nav-btn"
						title="Next (Cmd+G)"
						aria-label="Next match"
						disabled={matchCount === 0}
					>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
							<path d="M6 9L1 4h10L6 9z" />
						</svg>
					</button>
				</div>
				<button
					onclick={closeSearch}
					class="close-btn"
					title="Close (Escape)"
					aria-label="Close search"
				>
					<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
						<path
							d="M9.5 3.2L8.8 2.5 6 5.3 3.2 2.5 2.5 3.2 5.3 6 2.5 8.8l.7.7L6 6.7l2.8 2.8.7-.7L6.7 6z"
						/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<h2>PDF Viewer</h2>

	<input type="file" accept="application/pdf" onchange={handleFileChange} />
	{#if pdfUrl}
		<a href={pdfUrl} download={pdfFile?.name || 'download.pdf'} class="download-btn">Download PDF</a
		>
	{/if}
	<div id="pdf-container" class="pdf"></div>
</div>

<style>
	.nav-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		background: white;
		border-bottom: 1px solid #eee;
		margin-bottom: 2rem;
	}

	.nav-header h1 {
		margin: 0;
		font-size: 1.5rem;
		color: #333;
	}

	.nav-header nav {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.nav-header nav a {
		color: #007bff;
		text-decoration: none;
		font-weight: 500;
		padding: 0.5rem 1rem;
		border-radius: 4px;
		transition: background 0.2s;
	}

	.nav-header nav a:hover {
		background: #f0f0f0;
	}

	.search-icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		padding: 0;
		background: transparent;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		cursor: pointer;
		color: #6b7280;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.search-icon-btn:hover {
		background: #f3f4f6;
		border-color: #9ca3af;
		color: #374151;
	}

	.content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 2rem;
	}

	.content h2 {
		margin-top: 0;
	}

	.pdf {
		display: grid;
		gap: 16px;
		margin-top: 1em;
	}
	.download-btn {
		display: inline-block;
		margin: 1em 0;
		padding: 0.5em 1em;
		background: #0070f3;
		color: #fff;
		border-radius: 4px;
		text-decoration: none;
		font-weight: bold;
		transition: background 0.2s;
	}
	.download-btn:hover {
		background: #005bb5;
	}

	/* Page wrapper for canvas + text layer */
	:global(.page-wrapper) {
		position: relative;
		box-shadow: 0 0 16px rgba(0, 0, 0, 0.15);
	}

	/* Search popup styles (browser-like) */
	.search-popup {
		position: fixed;
		top: 80px;
		right: 24px;
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 8px;
		background: #fff;
		border-radius: 8px;
		box-shadow:
			0 2px 8px rgba(0, 0, 0, 0.15),
			0 0 1px rgba(0, 0, 0, 0.1);
		border: 1px solid #d1d5db;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.search-input-wrapper {
		display: flex;
		align-items: center;
		background: #f3f4f6;
		border-radius: 4px;
		padding: 0 8px;
		border: 1px solid transparent;
		transition: border-color 0.15s;
	}

	.search-input-wrapper:focus-within {
		border-color: #3b82f6;
		background: #fff;
	}

	.search-input {
		border: none;
		background: transparent;
		padding: 6px 0;
		font-size: 13px;
		width: 180px;
		outline: none;
	}

	.search-input::placeholder {
		color: #9ca3af;
	}

	.match-count {
		font-size: 12px;
		color: #6b7280;
		white-space: nowrap;
		min-width: 60px;
		text-align: right;
		padding-left: 8px;
	}

	.search-controls {
		display: flex;
		align-items: center;
		gap: 2px;
	}

	.nav-buttons {
		display: flex;
		align-items: center;
		margin-left: 4px;
	}

	.nav-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #374151;
		transition: background 0.15s;
	}

	.nav-btn:hover:not(:disabled) {
		background: #f3f4f6;
	}

	.nav-btn:disabled {
		color: #d1d5db;
		cursor: default;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 4px;
		cursor: pointer;
		font-size: 12px;
		font-weight: 600;
		color: #6b7280;
		transition:
			background 0.15s,
			border-color 0.15s,
			color 0.15s;
	}

	.toggle-btn:hover {
		background: #f3f4f6;
	}

	.toggle-btn.active {
		background: #dbeafe;
		border-color: #3b82f6;
		color: #1d4ed8;
	}

	.toggle-btn.active:hover {
		background: #bfdbfe;
	}

	.whole-word-icon {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		font-size: 11px;
		font-weight: 700;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.close-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		padding: 0;
		background: transparent;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		color: #6b7280;
		margin-left: 2px;
		transition: background 0.15s;
	}

	.close-btn:hover {
		background: #f3f4f6;
		color: #374151;
	}

	/* Search highlight overlay */
	:global(.search-highlight-overlay) {
		position: absolute;
		background-color: rgba(255, 255, 0, 0.4);
		pointer-events: none;
		z-index: 2;
	}

	:global(.search-highlight-overlay.current-match) {
		background-color: rgba(255, 150, 0, 0.6);
	}
</style>
```
