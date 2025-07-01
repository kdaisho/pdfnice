<script lang="ts">
	import type { getDocument } from 'pdfjs-dist/types/src/display/api';
	import type { GlobalWorkerOptions } from 'pdfjs-dist';

	let pdfjs: {
		getDocument: typeof getDocument;
		GlobalWorkerOptions: typeof GlobalWorkerOptions;
	} | null = null;

	async function loadPdfJs() {
		if (!pdfjs) {
			const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist');
			const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
			GlobalWorkerOptions.workerSrc = worker.default;
			pdfjs = { getDocument, GlobalWorkerOptions };
		}
		return pdfjs;
	}

	let pdfFile: File | null = null;

	async function handleFileChange(event: Event) {
		if (!(event.target instanceof HTMLInputElement)) return;
		const pdfjs = await loadPdfJs();
		const input = event.target;

		// Avoid using Svelte's bind:this for direct DOM manipulation here, as SvelteKit SSR and reactivity can conflict with manual DOM updates.
		const container = document.getElementById('pdf-container');

		if (input.files && input.files[0] && container) {
			pdfFile = input.files[0];
			const fileReader = new FileReader();

			fileReader.onload = async (e) => {
				if (!e.target || !(e.target.result instanceof ArrayBuffer)) return;
				const pdf = await pdfjs.getDocument({ data: new Uint8Array(e.target.result) }).promise;

				for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
					const page = await pdf.getPage(pageNum);
					const viewport = page.getViewport({ scale: 1.5 });
					const canvas = document.createElement('canvas');
					const context = canvas.getContext('2d');

					if (!context) return;

					canvas.height = viewport.height;
					canvas.width = viewport.width;
					canvas.style.boxShadow = '0 0 16px rgba(0,0,0,0.15)';

					await page.render({ canvasContext: context, viewport }).promise;
					container.appendChild(canvas);
				}
			};
			fileReader.readAsArrayBuffer(pdfFile);
		}
	}
</script>

<h1>PDF Viewer</h1>

<input type="file" accept="application/pdf" onchange={handleFileChange} />
<div id="pdf-container" class="pdf"></div>

<style>
	.pdf {
		display: grid;
		gap: 16px;
		margin-top: 1em;
	}
</style>
