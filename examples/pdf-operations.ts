// PDF Operations using pdf-lib (Client-Side Only)
// All processing happens in browser, files never uploaded to server

// Dynamic import to avoid bloating initial bundle (~300kb)
async function loadPdfLib() {
  const { PDFDocument } = await import('pdf-lib');
  return PDFDocument;
}

/**
 * Merge multiple PDF files into one
 * @param files - Array of File objects from file input
 * @returns Blob containing merged PDF
 */
export async function mergePDFs(files: File[]): Promise<Blob> {
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

/**
 * Split PDF into individual pages
 * @param file - PDF file to split
 * @returns Array of Blobs, one per page
 */
export async function splitPDF(file: File): Promise<Blob[]> {
  const PDFDocument = await loadPdfLib();
  const bytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(bytes);
  const pageCount = sourcePdf.getPageCount();
  const pages: Blob[] = [];

  for (let i = 0; i < pageCount; i++) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(sourcePdf, [i]);
    newPdf.addPage(copiedPage);
    const pdfBytes = await newPdf.save();
    pages.push(new Blob([pdfBytes], { type: 'application/pdf' }));
  }

  return pages;
}

/**
 * Extract specific pages from PDF
 * @param file - PDF file
 * @param pageIndices - Array of page indices to extract (0-based)
 * @returns Blob containing only selected pages
 */
export async function extractPages(file: File, pageIndices: number[]): Promise<Blob> {
  const PDFDocument = await loadPdfLib();
  const bytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(bytes);
  const newPdf = await PDFDocument.create();

  const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
  copiedPages.forEach(page => newPdf.addPage(page));

  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Remove specific pages from PDF
 * @param file - PDF file
 * @param pageIndicesToRemove - Array of page indices to remove (0-based)
 * @returns Blob with specified pages removed
 */
export async function removePages(file: File, pageIndicesToRemove: number[]): Promise<Blob> {
  const PDFDocument = await loadPdfLib();
  const bytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(bytes);
  const pageCount = sourcePdf.getPageCount();

  // Get indices to keep (inverse of remove)
  const pageIndicesToKeep = Array.from({ length: pageCount }, (_, i) => i)
    .filter(i => !pageIndicesToRemove.includes(i));

  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(sourcePdf, pageIndicesToKeep);
  copiedPages.forEach(page => newPdf.addPage(page));

  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Reorder pages in PDF
 * @param file - PDF file
 * @param newOrder - Array of page indices in desired order (0-based)
 * @returns Blob with pages reordered
 */
export async function reorderPages(file: File, newOrder: number[]): Promise<Blob> {
  const PDFDocument = await loadPdfLib();
  const bytes = await file.arrayBuffer();
  const sourcePdf = await PDFDocument.load(bytes);
  const newPdf = await PDFDocument.create();

  const copiedPages = await newPdf.copyPages(sourcePdf, newOrder);
  copiedPages.forEach(page => newPdf.addPage(page));

  const pdfBytes = await newPdf.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/**
 * Trigger browser download of PDF blob
 * @param blob - PDF blob to download
 * @param filename - Suggested filename
 */
export function downloadPDF(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Example usage:
// const files = [...fileInput.files];
// const merged = await mergePDFs(files);
// downloadPDF(merged, 'merged.pdf');
