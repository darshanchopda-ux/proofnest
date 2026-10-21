"use client";

import { Icon } from "@/components/Icon";

/** Opens the print dialog with a title that becomes the saved PDF's file name. */
export function PrintButton({ fileName }: { fileName: string }) {
  return (
    <button
      className="btn accent"
      type="button"
      onClick={() => {
        const title = document.title;
        document.title = fileName;
        window.print();
        document.title = title;
      }}
    >
      <Icon name="download" small />Save as PDF or print
    </button>
  );
}
