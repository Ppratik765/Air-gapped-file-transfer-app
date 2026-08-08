/**
 * Shared camera QR code scanner utility for WebRTC signaling exchange.
 */

import { readBarcodes, prepareZXingModule } from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/zxing_reader.wasm?url";

let wasmPrepared = false;

export async function ensureScannerWasm(): Promise<void> {
  if (wasmPrepared) return;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? wasmUrl : prefix + path,
    },
  });
  wasmPrepared = true;
}

export async function scanQrFromVideo(video: HTMLVideoElement): Promise<string | null> {
  if (!video.videoWidth || !video.videoHeight) return null;
  await ensureScannerWasm();

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  try {
    const results = await readBarcodes(imgData, {
      formats: ["QRCode"],
      maxNumberOfSymbols: 1,
    });
    if (results && results.length > 0 && results[0]?.text) {
      return results[0].text;
    }
  } catch {
    // Frame decode attempt failed
  }
  return null;
}
