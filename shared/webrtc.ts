/**
 * Shared WebRTC & SDP compression helper module for 100% offline, air-gapped
 * peer-to-peer file transfer via visual QR code signaling.
 */

export interface WebRTCFileMetadata {
  type: "meta";
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Compress an SDP string using browser CompressionStream (deflate-raw) and
 * encode to Base64 with prefix (e.g. WD_OFFER:... or WD_ANSWER:...).
 */
export async function compressSdp(sdp: string, prefix: "OFFER" | "ANSWER"): Promise<string> {
  const textBytes = new TextEncoder().encode(sdp);
  let compressedBuffer: ArrayBuffer;

  if (typeof CompressionStream !== "undefined") {
    try {
      const cs = new CompressionStream("deflate-raw");
      const writer = cs.writable.getWriter();
      void writer.write(textBytes);
      void writer.close();
      compressedBuffer = await new Response(cs.readable).arrayBuffer();
    } catch {
      // Fallback if deflate-raw fails
      const cs = new CompressionStream("gzip");
      const writer = cs.writable.getWriter();
      void writer.write(textBytes);
      void writer.close();
      compressedBuffer = await new Response(cs.readable).arrayBuffer();
    }
  } else {
    // Fallback: uncompressed UTF-8 bytes to Base64
    compressedBuffer = textBytes.buffer as ArrayBuffer;
  }

  const bytes = new Uint8Array(compressedBuffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return `WD_${prefix}:${btoa(binary)}`;
}

/**
 * Decompress an SDP Base64 string produced by compressSdp.
 */
export async function decompressSdp(payload: string, expectedPrefix: "OFFER" | "ANSWER"): Promise<string> {
  const prefix = `WD_${expectedPrefix}:`;
  if (!payload.startsWith(prefix)) {
    throw new Error(`Invalid signaling code format. Expected ${prefix} prefix.`);
  }

  const base64 = payload.slice(prefix.length).trim();
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  if (typeof DecompressionStream !== "undefined") {
    try {
      const ds = new DecompressionStream("deflate-raw");
      const writer = ds.writable.getWriter();
      void writer.write(bytes);
      void writer.close();
      const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
      return new TextDecoder().decode(decompressedBuffer);
    } catch {
      const ds = new DecompressionStream("gzip");
      const writer = ds.writable.getWriter();
      void writer.write(bytes);
      void writer.close();
      const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
      return new TextDecoder().decode(decompressedBuffer);
    }
  }

  return new TextDecoder().decode(bytes);
}

/**
 * Create a new RTCPeerConnection configured for offline local P2P transfers.
 */
export function createLocalPeerConnection(): RTCPeerConnection {
  return new RTCPeerConnection({ iceServers: [] });
}

/**
 * Await local ICE candidate gathering to complete or timeout.
 */
export function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }

    const timer = setTimeout(() => {
      resolve();
    }, timeoutMs);

    const checkState = () => {
      if (pc.iceGatheringState === "complete") {
        clearTimeout(timer);
        pc.removeEventListener("icegatheringstatechange", checkState);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", checkState);
  });
}

/**
 * Stream binary file bytes over an open RTCDataChannel with backpressure flow control.
 */
export async function sendFileOverDataChannel(
  channel: RTCDataChannel,
  file: File,
  onProgress: (sentBytes: number, totalBytes: number) => void,
  chunkSize = 64 * 1024,
): Promise<void> {
  channel.binaryType = "arraybuffer";
  channel.bufferedAmountLowThreshold = 64 * 1024;

  // 1. Send metadata JSON header
  const meta: WebRTCFileMetadata = {
    type: "meta",
    name: file.name,
    size: file.size,
    mimeType: file.type || "application/octet-stream",
  };
  channel.send(JSON.stringify(meta));

  // 2. Read and stream file in chunks
  const buffer = await file.arrayBuffer();
  let offset = 0;

  while (offset < file.size) {
    if (channel.readyState !== "open") {
      throw new Error("WebRTC DataChannel closed mid-transfer.");
    }

    // Flow control: wait for buffered amount to drain if channel buffer fills
    if (channel.bufferedAmount > 256 * 1024) {
      await new Promise<void>((resolve) => {
        const onLow = () => {
          channel.removeEventListener("bufferedamountlow", onLow);
          resolve();
        };
        channel.addEventListener("bufferedamountlow", onLow);
      });
    }

    const end = Math.min(offset + chunkSize, file.size);
    const chunk = buffer.slice(offset, end);
    channel.send(chunk);

    offset = end;
    onProgress(offset, file.size);

    // Yield macro-task every 10 chunks for UI updates
    if ((offset / chunkSize) % 10 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }
}
