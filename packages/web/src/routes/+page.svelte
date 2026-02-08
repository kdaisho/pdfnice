<script lang="ts">
	import 'pdfjs-dist/web/pdf_viewer.css';
	import type { getDocument, TextItem } from 'pdfjs-dist/types/src/display/api';
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

	let pdfFile: File | null = null;
	let pdfUrl: string | null = null;

	// Store page data for search
	interface PageTextData {
		pageWrapper: HTMLElement;
		viewport: { width: number; height: number; scale: number };
		textItems: Array<{
			str: string;
			transform: number[];
			width: number;
			height: number;
		}>;
	}
	let pagesData: PageTextData[] = [];

	// Search state
	let searchQuery = '';
	let matchCount = 0;
	let currentMatchIndex = 0;
	let highlightElements: HTMLElement[] = [];

	function performSearch() {
		// Clear previous highlights
		document.querySelectorAll('.search-highlight-overlay').forEach((el) => el.remove());
		highlightElements = [];
		matchCount = 0;
		currentMatchIndex = 0;

		if (!searchQuery.trim() || pagesData.length === 0) return;

		const query = searchQuery.toLowerCase();

		// Search through each page's text data
		pagesData.forEach((pageData) => {
			// Build combined text with character position mapping
			interface CharInfo {
				itemIndex: number;
				charIndex: number;
			}
			const charMap: CharInfo[] = [];
			let combinedText = '';

			pageData.textItems.forEach((item, itemIndex) => {
				for (let i = 0; i < item.str.length; i++) {
					charMap.push({ itemIndex, charIndex: i });
				}
				combinedText += item.str;
			});

			// Find matches
			const lowerCombined = combinedText.toLowerCase();
			let searchPos = 0;

			while (true) {
				const matchIndex = lowerCombined.indexOf(query, searchPos);
				if (matchIndex === -1) break;

				const matchEnd = matchIndex + query.length;
				matchCount++;

				// Find which text items this match spans
				const startChar = charMap[matchIndex];
				const endChar = charMap[matchEnd - 1];

				if (!startChar || !endChar) {
					searchPos = matchIndex + 1;
					continue;
				}

				// Create highlights for each text item in this match
				for (let itemIdx = startChar.itemIndex; itemIdx <= endChar.itemIndex; itemIdx++) {
					const item = pageData.textItems[itemIdx];
					const transform = item.transform;

					// Transform matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
					const x = transform[4];
					const y = transform[5];
					const fontHeight = Math.abs(transform[3]); // scaleY = font height in PDF units

					// Calculate the portion of this item that's highlighted
					let highlightStartChar = 0;
					let highlightEndChar = item.str.length;

					if (itemIdx === startChar.itemIndex) {
						highlightStartChar = startChar.charIndex;
					}
					if (itemIdx === endChar.itemIndex) {
						highlightEndChar = endChar.charIndex + 1;
					}

					// item.width is already the total width in PDF units
					const charWidth = item.width / item.str.length;
					const highlightX = x + highlightStartChar * charWidth;
					const highlightWidth = (highlightEndChar - highlightStartChar) * charWidth;

					// Create highlight overlay
					const highlight = document.createElement('div');
					highlight.className = 'search-highlight-overlay';
					highlight.dataset.matchIndex = String(matchCount - 1);

					// Position in PDF coordinates, then scale to viewport
					const scale = pageData.viewport.scale;
					highlight.style.left = `${highlightX * scale}px`;
					highlight.style.bottom = `${y * scale}px`;
					highlight.style.width = `${Math.max(highlightWidth * scale, 4)}px`;
					highlight.style.height = `${fontHeight * scale}px`;

					pageData.pageWrapper.appendChild(highlight);
					highlightElements.push(highlight);
				}

				searchPos = matchIndex + 1;
			}
		});

		if (highlightElements.length > 0) {
			scrollToMatch(0);
		}
	}

	function scrollToMatch(index: number) {
		// Remove current highlight styling
		highlightElements.forEach((el) => el.classList.remove('current-match'));

		if (matchCount === 0) return;

		currentMatchIndex = ((index % matchCount) + matchCount) % matchCount;

		// Find all highlights for this match and mark them as current
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
		if (event.key === 'Enter') {
			if (event.shiftKey) {
				prevMatch();
			} else {
				nextMatch();
			}
		} else if (event.key === 'Escape') {
			searchQuery = '';
			performSearch();
		}
	}

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

					// Store text data for search
					const textItems = textContent.items
						.filter((item): item is TextItem => 'str' in item && item.str.length > 0)
						.map((item) => ({
							str: item.str,
							transform: item.transform,
							width: item.width,
							height: item.height
						}));

					pagesData.push({
						pageWrapper,
						viewport: { width: viewport.width, height: viewport.height, scale: viewport.scale },
						textItems
					});

					const textLayer = new pdfjs.TextLayer({
						textContentSource: textContent,
						container: textLayerDiv,
						viewport: viewport
					});
					await textLayer.render();
					pageWrapper.appendChild(textLayerDiv);

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
		{#if data.user}
			<a href="/dashboard">Dashboard</a>
		{:else}
			<a href="/setup">Login / Sign Up</a>
		{/if}
	</nav>
</header>

<div class="content">
	<h2>PDF Viewer</h2>

	<input type="file" accept="application/pdf" onchange={handleFileChange} />
	{#if pdfUrl}
		<a href={pdfUrl} download={pdfFile?.name || 'download.pdf'} class="download-btn">Download PDF</a
		>

		<div class="search-bar">
			<input
				type="text"
				placeholder="Search in PDF..."
				bind:value={searchQuery}
				oninput={performSearch}
				onkeydown={handleSearchKeydown}
				class="search-input"
			/>
			{#if matchCount > 0}
				<span class="match-count">{currentMatchIndex + 1} / {matchCount}</span>
				<button onclick={prevMatch} class="nav-btn" title="Previous (Shift+Enter)">&#9650;</button>
				<button onclick={nextMatch} class="nav-btn" title="Next (Enter)">&#9660;</button>
			{:else if searchQuery.trim()}
				<span class="match-count">No matches</span>
			{/if}
		</div>
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

	/* Search bar styles */
	.search-bar {
		position: sticky;
		top: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 1em 0;
		padding: 8px 12px;
		background: #f5f5f5;
		border-radius: 6px;
		border: 1px solid #ddd;
	}

	.search-input {
		flex: 1;
		padding: 6px 10px;
		border: 1px solid #ccc;
		border-radius: 4px;
		font-size: 14px;
		min-width: 200px;
	}

	.search-input:focus {
		outline: none;
		border-color: #0070f3;
		box-shadow: 0 0 0 2px rgba(0, 112, 243, 0.2);
	}

	.match-count {
		font-size: 13px;
		color: #666;
		white-space: nowrap;
	}

	.nav-btn {
		padding: 4px 8px;
		background: #fff;
		border: 1px solid #ccc;
		border-radius: 4px;
		cursor: pointer;
		font-size: 10px;
		line-height: 1;
	}

	.nav-btn:hover {
		background: #e9e9e9;
	}

	/* Search highlight overlay styles */
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
