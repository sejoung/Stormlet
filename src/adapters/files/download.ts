/** Save `content` as a file through the browser's download flow. */
export function downloadText(filename: string, content: string, type = 'application/json') {
  downloadBlob(filename, new Blob([content], { type }));
}

/** Save `blob` as a file through the browser's download flow. */
export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  // Revoke after the click has been handled, or some browsers cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export const readFileText = (file: Blob): Promise<string> => file.text();
