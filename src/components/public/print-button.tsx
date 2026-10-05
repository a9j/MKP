"use client";

/**
 * Opens the browser's print dialog, where "Save as PDF" produces a clean copy
 * of the page. The print stylesheet strips the site chrome, so the PDF is just
 * the explainer and its sources. Used when no PDF file is attached.
 */
export function PrintButton({ className = "btn" }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      Download as PDF
    </button>
  );
}
