/**
 * Shared camera QR code scanner utility for WebRTC signaling exchange.
 */

import { readBarcodes, prepareZXingModule } from "zxing-wasm/reader";
import wasmUrl from "../receive/wasm-url";
import { applyAdvancedConstraint, probeCameraCapabilities } from "./platform";

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

/**
 * Acquire the highest quality / resolution camera stream available on the device
 * specifically for WebRTC handshake QR scanning.
 */
export async function getHighestQualityCameraStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    // 1. Highest resolution (4K / UHD) back camera
    {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 3840, min: 1280 },
        height: { ideal: 2160, min: 720 },
      },
    },
    // 2. Full HD 1080p back camera
    {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      },
    },
    // 3. HD 720p back camera
    {
      audio: false,
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    // 4. Any environment camera
    {
      audio: false,
      video: { facingMode: "environment" },
    },
    // 5. Default video fallback
    {
      audio: false,
      video: true,
    },
  ];

  let lastErr: unknown = null;
  for (const constraint of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraint);
      const track = stream.getVideoTracks()[0];
      if (track) {
        const caps = probeCameraCapabilities(track);
        if (caps.continuousFocus) {
          await applyAdvancedConstraint(track, { focusMode: "continuous" }).catch(() => undefined);
        }
      }
      return stream;
    } catch (err) {
      lastErr = err;
    }
  }

  throw lastErr || new Error("Unable to access high quality camera");
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
