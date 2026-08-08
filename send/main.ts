// Sender: turn a file into an endless fountain-coded QR stream.
//
// Tuning notes from the experiments this PoC is distilled from:
// - Frame payload sets the QR version; denser wins on goodput as long as the
//   receiver can still decode it. 1465 bytes ≈ V27 is a safe middle ground
//   for arbitrary monitors; 2953 (V40) is the ceiling and works phone-to-
//   phone at close range.
// - The mask pattern is pinned (any declared mask is valid to a decoder);
//   this skips the spec's 8-way mask evaluation and speeds generation ~4×.
// - Displays need each frame shown for ≥2 refresh cycles or captures catch
//   the transition; 24 fps on a 60 Hz screen is comfortable.
// - Error correction stays at L by default: the fountain layer already
//   handles erasures, and a frame is either decoded whole or discarded.

import QRCode from "qrcode";
import { initTheme } from "../shared/theme";
import { initAppPromoBanner } from "../shared/app-promo";
import { fitQrDisplaySize } from "../shared/display";
import { rasterizeQr } from "../shared/qr-raster";
import { formatBytes } from "../shared/format";
import {
  MAX_SOURCE_BLOCKS,
  blockLength,
  fitsInOneStream,
  minimumFrameBytes,
  smallestSufficientFrameSize,
  sourceBlockCount,
} from "../shared/frame-capacity";
import { LTEncoder } from "../shared/fountain";
import { MAX_SNIPPET_BYTES, MAX_SNIPPET_LABEL, packSnippet } from "../shared/snippet";
import {
  MAX_FILE_BYTES,
  MAX_FILE_LABEL,
  OPTICAL_MAX_FILE_BYTES,
  OPTICAL_MAX_FILE_LABEL,
  getRadioMaxFileLimit,
  fnv1a,
  packFile,
  packFrame,
  type FrameHeader,
  type PackedOpticalFile,
} from "../shared/protocol";
import { statusLine } from "../shared/status-line";
import { requestScreenWakeLock } from "../shared/wake-lock";
import { wireShareDialog } from "../shared/share-dialog";
import { bindTapToFocus } from "../shared/camera-focus";

const MARGIN = 4; // quiet-zone modules
const LOOKAHEAD = 3;

// `npm run demo` (vite --mode demo). Locks the sender to the two bundled
// payloads so the app can be left running in front of strangers without
// handing them a file picker into the host machine.
const DEMO = import.meta.env.VITE_DEMO === "1";

const canvas = document.getElementById("qr") as HTMLCanvasElement;
const stage = document.getElementById("stage") as HTMLDivElement;
const specs = document.getElementById("specs")!;
const cfgFile = document.getElementById("cfg-file") as HTMLInputElement;
const filePickerLabel = document.getElementById("file-picker-label")!;
const filePickerButton = document.getElementById("file-picker-button")!;
const toolTitle = document.getElementById("tool-title")!;
const snippetText = document.getElementById("snippet-text") as HTMLTextAreaElement;
const snippetLabel = document.getElementById("snippet-label")!;
const sendSnippetBtn = document.getElementById("send-snippet") as HTMLButtonElement;
const paneFile = document.getElementById("pane-file")!;
const paneSnippet = document.getElementById("pane-snippet")!;
const paneDemo = document.getElementById("pane-demo")!;
const modePicker = document.getElementById("mode-picker")!;
const modeInputs = [...document.querySelectorAll<HTMLInputElement>('input[name="send-mode"]')];
const streamSpecs = document.getElementById("stream-specs")!;
const footerHint = document.getElementById("footer-hint")!;
const spec = (id: string) => document.getElementById(id)!;

/** Panels that only mean something while a stream is up: the spec grid at the
 *  bottom of Transfer settings, and the receiver hint under the status line. */
function showStreamPanels(visible: boolean): void {
  streamSpecs.hidden = !visible;
  footerHint.hidden = !visible;
}

const openShareDialog = wireShareDialog();
const cfgFps = document.getElementById("cfg-fps") as HTMLSelectElement;
const cfgBytes = document.getElementById("cfg-bytes") as HTMLSelectElement;
const cfgEcc = document.getElementById("cfg-ecc") as HTMLSelectElement;
const cfgSize = document.getElementById("cfg-size") as HTMLInputElement;

let selectedFile: {
  name: string;
  size: number;
  payload: Uint8Array;
  compression: "none" | "gzip";
  transmittedSize: number;
} | null = null;
let generation = 0; // bumped on every restart; stale loops see it and die
let resizeDisplay: (() => void) | null = null;

const specsLine = statusLine(specs);
const setStatus = specsLine.setStatus;

/**
 * Errors also hide the stage — a stale QR stream pulsing away under a
 * rejection message reads as "still working".
 *
 * Callers decide whether the pick survives. A file rejected on size is gone;
 * a stream that can't start at the current bytes/frame is not, because turning
 * that setting back up is the fix.
 */
function showError(message: string): void {
  setStageFullscreen(false);
  stage.hidden = true;
  showStreamPanels(false);
  specsLine.showError(message);
}

function currentMode(): "file" | "snippet" {
  return modeInputs.find((input) => input.checked)?.value === "snippet" ? "snippet" : "file";
}

/** The picker reads as state — which file is armed — and the button offers
 *  the next action: pick when idle, stop when streaming. A rejected pick
 *  keeps the idle wording: the status line already names what went wrong,
 *  and nothing is streaming. */
function updateFilePicker(): void {
  const armed = currentMode() === "file" && selectedFile !== null;
  paneFile.classList.toggle("has-file", armed);
  filePickerButton.textContent = armed ? "Stop transfer" : "Select File";
  const radioLimit = getRadioMaxFileLimit();
  const limitLabel = currentTransferTech === "radio" ? radioLimit.label : OPTICAL_MAX_FILE_LABEL;
  filePickerLabel.textContent =
    armed && selectedFile ? `Selected file: ${selectedFile.name}` : `Any file · up to ${limitLabel}`;
}

/** Tear the stream down and disarm the picker. The input is cleared so the
 *  same file can be picked again (change would not fire otherwise) and so a
 *  mode switch does not silently resurrect the stopped stream. */
function stopTransfer(): void {
  generation++;
  selectedFile = null;
  setStageFullscreen(false);
  stage.hidden = true;
  showStreamPanels(false);
  cfgFile.value = "";

  // Complete WebRTC cleanup
  if (activeSenderPc) {
    activeSenderPc.close();
    activeSenderPc = null;
  }
  if (senderScanInterval) {
    clearInterval(senderScanInterval);
    senderScanInterval = null;
  }
  if (senderConnTimeout) {
    clearTimeout(senderConnTimeout);
    senderConnTimeout = null;
  }
  if (activeSenderStream) {
    activeSenderStream.getTracks().forEach((t) => t.stop());
    activeSenderStream = null;
  }
  if (webrtcSenderVideo) {
    webrtcSenderVideo.srcObject = null;
  }
  if (paneWebrtc) paneWebrtc.hidden = true;
  if (webrtcSenderStep1) webrtcSenderStep1.hidden = true;
  if (webrtcSenderStep2) webrtcSenderStep2.hidden = true;
  if (webrtcSenderStep3) webrtcSenderStep3.hidden = true;
  if (webrtcOfferQr) {
    const ctx = webrtcOfferQr.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, webrtcOfferQr.width, webrtcOfferQr.height);
  }
  if (webrtcSenderProgressFill) webrtcSenderProgressFill.style.width = "0%";
  if (webrtcSenderProgressText) webrtcSenderProgressText.textContent = "0 MB / 0 MB (0%)";
  if (webrtcSenderSpeedText) webrtcSenderSpeedText.textContent = "0 KB/s";

  updateFilePicker();
  setStatus(currentMode() === "snippet" ? "Paste or type some text to begin" : "Choose a file to begin");
}

/** Tap the code to fill the screen with it — a bigger physical code lets the
 *  receiver sit farther back or decode denser frames.
 *
 *  Fullscreen is a page STATE (body.qr-full — see style.css), never a fixed
 *  overlay and never a separate element: Safari 26 latches its chrome tint
 *  onto fixed layers, and an overlay element that merely loses a class is
 *  still there for the heuristic to track. A flow layout that reflows on
 *  exit leaves nothing behind. Tap again (or Esc) to shrink back. */
let scrollBeforeFullscreen = 0;
function setStageFullscreen(on: boolean): void {
  if (on === document.body.classList.contains("qr-full")) return;
  if (on) scrollBeforeFullscreen = window.scrollY;
  document.body.classList.toggle("qr-full", on);
  resizeDisplay?.();
  // Entering: the stage IS the page now, start at its top. Leaving: put the
  // user back on the exact spot they expanded from.
  window.scrollTo(0, on ? 0 : scrollBeforeFullscreen);
}

stage.addEventListener("click", () => {
  setStageFullscreen(!document.body.classList.contains("qr-full"));
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") setStageFullscreen(false);
});

/** Switching what we're sending kills any stream in flight and clears the stage. */
function applyMode(): void {
  generation++;
  selectedFile = null;
  setStageFullscreen(false);
  stage.hidden = true;
  showStreamPanels(false);

  if (DEMO) {
    modePicker.hidden = true;
    paneFile.hidden = true;
    paneSnippet.hidden = true;
    paneDemo.hidden = false;
    setStatus("Choose a demo payload to begin");
    return;
  }

  const mode = currentMode();
  paneDemo.hidden = true;
  paneFile.hidden = mode !== "file";
  paneSnippet.hidden = mode !== "snippet";
  // The heading used to say "Send a file" even with Text snippet selected.
  toolTitle.textContent = mode === "snippet" ? "Send text" : "Send a file";
  setStatus(mode === "snippet" ? "Paste or type some text to begin" : "Choose a file to begin");
  updateFilePicker();
  // A file left in the picker survives the switch, so re-arm it rather than
  // leaving a filename on screen next to "choose a file to begin".
  if (mode === "file" && cfgFile.files?.[0]) void selectFile();
}

/**
 * The one path from "user picked something" to a running stream.
 *
 * Kills any stream in flight, then packs the payload; a selection that lands
 * mid-pack (the generation guard) or fails to pack (throw → showError) leaves
 * the page idle rather than streaming something stale. Every way of choosing a
 * payload goes through here so the guard can't be subtly wrong in one copy.
 */
let currentTransferTech: "optical" | "radio" = "optical";
const transferTechInputs = document.querySelectorAll<HTMLInputElement>('input[name="transfer-tech"]');

async function startSelection(
  status: string,
  prepare: () => Promise<{ name: string; size: number; packed: PackedOpticalFile }>,
): Promise<void> {
  const selectionGeneration = ++generation;
  selectedFile = null;
  stage.hidden = true;

  if (currentTransferTech === "radio") {
    showError("High-Speed WebRTC mode coming soon!");
    return;
  }

  setStatus(status);
  try {
    const { name, size, packed } = await prepare();
    if (selectionGeneration !== generation) return;
    selectedFile = {
      name,
      size,
      payload: packed.container,
      compression: packed.compression,
      transmittedSize: packed.transmittedSize,
    };
    await startStream(true);
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
}

/** Demo payloads ship in public/, so they sit at the site root beside /send/. */
async function selectDemo(fileName: string): Promise<void> {
  await startSelection(`loading ${fileName}…`, async () => {
    const response = await fetch(`../${fileName}`);
    if (!response.ok) throw new Error(`could not load ${fileName} (${response.status})`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { name: fileName, size: bytes.length, packed: await packFile(fileName, "image/png", bytes) };
  });
}

import {
  createLocalPeerConnection,
  waitForIceGathering,
  compressSdp,
  decompressSdp,
  sendFileOverDataChannel,
} from "../shared/webrtc";
import { drawQrToCanvas } from "../shared/qr-raster";
import { scanQrFromVideo } from "../shared/qr-scanner";

const paneWebrtc = document.getElementById("pane-webrtc") as HTMLDivElement;
const webrtcSenderStep1 = document.getElementById("webrtc-sender-step1") as HTMLDivElement;
const webrtcSenderStep2 = document.getElementById("webrtc-sender-step2") as HTMLDivElement;
const webrtcSenderStep3 = document.getElementById("webrtc-sender-step3") as HTMLDivElement;
const webrtcOfferQr = document.getElementById("webrtc-offer-qr") as HTMLCanvasElement;
const webrtcScanAnswerBtn = document.getElementById("webrtc-scan-answer-btn") as HTMLButtonElement;
const webrtcSenderVideo = document.getElementById("webrtc-sender-video") as HTMLVideoElement;
const webrtcCancelScanBtn = document.getElementById("webrtc-cancel-scan-btn") as HTMLButtonElement;
const webrtcSenderStatus = document.getElementById("webrtc-sender-status") as HTMLParagraphElement;
const webrtcSenderProgressFill = document.getElementById("webrtc-sender-progress-fill") as HTMLDivElement;
const webrtcSenderProgressText = document.getElementById("webrtc-sender-progress-text") as HTMLSpanElement;
const webrtcSenderSpeedText = document.getElementById("webrtc-sender-speed-text") as HTMLSpanElement;

let activeSenderPc: RTCPeerConnection | null = null;
let activeSenderStream: MediaStream | null = null;
let senderScanInterval: ReturnType<typeof setInterval> | null = null;
let senderConnTimeout: ReturnType<typeof setTimeout> | null = null;

function showSenderHandshakeTimeoutError(file: File): void {
  if (senderConnTimeout) {
    clearTimeout(senderConnTimeout);
    senderConnTimeout = null;
  }
  showError("Connection timed out. Devices may not be on the same local network.");
  if (webrtcSenderStatus) {
    webrtcSenderStatus.innerHTML = `
      <span style="color: var(--red); font-weight: bold;">Connection Failed / Timed Out</span><br/>
      <button id="webrtc-sender-retry-btn" type="button" style="margin-top: 10px; padding: 8px 16px; border-radius: 8px; background: var(--line-bright); color: #fff; font-weight: bold; border: none; cursor: pointer;">Retry Handshake</button>
    `;
    const retryBtn = document.getElementById("webrtc-sender-retry-btn");
    if (retryBtn) {
      retryBtn.onclick = () => void startWebRtcSender(file);
    }
  }
}

async function startWebRtcSender(file: File): Promise<void> {
  if (activeSenderPc) {
    activeSenderPc.close();
    activeSenderPc = null;
  }
  if (senderScanInterval) {
    clearInterval(senderScanInterval);
    senderScanInterval = null;
  }
  if (senderConnTimeout) {
    clearTimeout(senderConnTimeout);
    senderConnTimeout = null;
  }

  paneFile.hidden = true;
  paneSnippet.hidden = true;
  stage.hidden = true;
  if (paneWebrtc) paneWebrtc.hidden = false;
  if (webrtcSenderStep1) webrtcSenderStep1.hidden = false;
  if (webrtcSenderStep2) webrtcSenderStep2.hidden = true;
  if (webrtcSenderStep3) webrtcSenderStep3.hidden = true;

  setStatus("Gathering local network candidates…");
  if (webrtcSenderStatus) webrtcSenderStatus.textContent = "Gathering local network candidates…";

  try {
    const pc = createLocalPeerConnection();
    activeSenderPc = pc;

    // WebRTC Lifecycle Event Logging
    pc.addEventListener("icegatheringstatechange", () => {
      console.log("[WebRTC Sender] ICE gathering state:", pc.iceGatheringState);
    });
    pc.addEventListener("connectionstatechange", () => {
      console.log("[WebRTC Sender] Connection state:", pc.connectionState);
      if (pc.connectionState === "connected") {
        if (senderConnTimeout) {
          clearTimeout(senderConnTimeout);
          senderConnTimeout = null;
        }
      } else if (pc.connectionState === "failed") {
        showSenderHandshakeTimeoutError(file);
      }
    });
    pc.addEventListener("iceconnectionstatechange", () => {
      console.log("[WebRTC Sender] ICE connection state:", pc.iceConnectionState);
      if (pc.iceConnectionState === "failed") {
        showSenderHandshakeTimeoutError(file);
      }
    });
    pc.addEventListener("signalingstatechange", () => {
      console.log("[WebRTC Sender] Signaling state:", pc.signalingState);
    });

    const channel = pc.createDataChannel("file-transfer");

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc);

    const compressedOffer = await compressSdp(pc.localDescription!.sdp, "OFFER");
    if (webrtcOfferQr) drawQrToCanvas(compressedOffer, webrtcOfferQr);

    setStatus("Displaying Offer QR Code");

    if (webrtcScanAnswerBtn) {
      webrtcScanAnswerBtn.onclick = async () => {
        if (webrtcSenderStep1) webrtcSenderStep1.hidden = true;
        if (webrtcSenderStep2) webrtcSenderStep2.hidden = false;
        setStatus("Scan Answer QR Code");

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment", width: { ideal: 960 }, height: { ideal: 720 } },
          });
          activeSenderStream = stream;
          if (webrtcSenderVideo) {
            webrtcSenderVideo.srcObject = stream;
            await webrtcSenderVideo.play().catch(() => undefined);
          }

          senderScanInterval = setInterval(async () => {
            if (!webrtcSenderVideo) return;
            const text = await scanQrFromVideo(webrtcSenderVideo);
            if (text && text.startsWith("WD_ANSWER:")) {
              if (senderScanInterval) clearInterval(senderScanInterval);
              stream.getTracks().forEach((t) => t.stop());
              activeSenderStream = null;

              try {
                const answerSdp = await decompressSdp(text, "ANSWER");
                await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
                if (webrtcSenderStep2) webrtcSenderStep2.hidden = true;
                if (webrtcSenderStep3) webrtcSenderStep3.hidden = false;

                if (webrtcSenderStatus) webrtcSenderStatus.textContent = "Connecting over local radio…";
                setStatus("Connecting over local radio…");

                // Start 10s connection timeout
                senderConnTimeout = setTimeout(() => {
                  if (pc.connectionState !== "connected" && pc.iceConnectionState !== "connected") {
                    showSenderHandshakeTimeoutError(file);
                  }
                }, 10000);
              } catch (err) {
                showError(`Failed to parse Answer QR code: ${err}`);
              }
            }
          }, 150);
        } catch (err) {
          showError(`Camera access failed: ${err}`);
        }
      };
    }

    if (webrtcCancelScanBtn) {
      webrtcCancelScanBtn.onclick = () => {
        if (senderScanInterval) clearInterval(senderScanInterval);
        if (activeSenderStream) {
          activeSenderStream.getTracks().forEach((t) => t.stop());
          activeSenderStream = null;
        }
        if (webrtcSenderStep2) webrtcSenderStep2.hidden = true;
        if (webrtcSenderStep1) webrtcSenderStep1.hidden = false;
        setStatus("Displaying Offer QR Code");
      };
    }

    channel.onopen = async () => {
      if (senderConnTimeout) {
        clearTimeout(senderConnTimeout);
        senderConnTimeout = null;
      }
      if (webrtcSenderStatus) {
        webrtcSenderStatus.textContent = `Connected! Transferring data (${file.name})…`;
      }
      setStatus(`Connected! Transferring data (${file.name})…`);
      const startTs = performance.now();

      try {
        await sendFileOverDataChannel(channel, file, (sentBytes, totalBytes) => {
          const pct = Math.round((sentBytes / totalBytes) * 100);
          if (webrtcSenderProgressFill) webrtcSenderProgressFill.style.width = `${pct}%`;
          const sentMb = (sentBytes / 1024 / 1024).toFixed(1);
          const totalMb = (totalBytes / 1024 / 1024).toFixed(1);
          if (webrtcSenderProgressText) {
            webrtcSenderProgressText.textContent = `${sentMb} / ${totalMb} MB (${pct}%)`;
          }

          const elapsedSec = (performance.now() - startTs) / 1000;
          const kbs = elapsedSec > 0 ? sentBytes / 1024 / elapsedSec : 0;
          if (webrtcSenderSpeedText) {
            webrtcSenderSpeedText.textContent =
              kbs > 1024 ? `${(kbs / 1024).toFixed(1)} MB/s` : `${kbs.toFixed(0)} KB/s`;
          }
        });

        if (webrtcSenderProgressFill) webrtcSenderProgressFill.style.width = "100%";
        if (webrtcSenderStatus) {
          webrtcSenderStatus.textContent = `✔ Transfer complete! ${file.name} sent over WebRTC.`;
        }
        setStatus(`✔ Transfer complete! ${file.name} sent over WebRTC.`);
      } catch (err) {
        showError(`WebRTC stream error: ${err}`);
      }
    };
  } catch (err) {
    showError(`Failed to generate WebRTC Offer: ${err}`);
  }
}

async function selectFile(): Promise<void> {
  const file = cfgFile.files?.[0];
  if (!file) return;

  if (currentTransferTech === "radio") {
    if (file.size === 0) {
      showError(`${file.name} is empty — there is nothing to send.`);
      return;
    }
    const radioLimit = getRadioMaxFileLimit();
    if (file.size > radioLimit.bytes) {
      showError(`${file.name} is ${formatBytes(file.size)}, over the High-Speed Radio ${radioLimit.label} limit.`);
      return;
    }
    await startWebRtcSender(file);
    updateFilePicker();
    return;
  }

  // 1465 B (QR v27) is the optimal scannable frame size for screen-to-camera scanning
  cfgBytes.value = "1465";

  await startSelection(`preparing ${file.name}…`, async () => {
    if (file.size === 0) {
      throw new Error(`${file.name} is empty — there is nothing to send.`);
    }
    const radioLimit = getRadioMaxFileLimit();
    if (file.size > OPTICAL_MAX_FILE_BYTES) {
      throw new Error(`File exceeds 16MB. High-speed radio mode required for files up to ${radioLimit.label}.`);
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`${file.name} is ${formatBytes(file.size)}, over the ${MAX_FILE_LABEL} limit.`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    return { name: file.name, size: file.size, packed: await packFile(file.name, file.type, bytes) };
  });
  updateFilePicker();
}

async function selectSnippet(): Promise<void> {
  await startSelection("preparing text snippet…", async () => {
    const packed = await packSnippet(snippetText.value);
    return { name: "Text snippet", size: packed.originalSize, packed };
  });
}

async function main() {
  initTheme();
  initAppPromoBanner();
  // Both bounds come from MAX_SNIPPET_BYTES so they can't drift apart. maxLength
  // counts UTF-16 units and the real check counts UTF-8 bytes, which are never
  // fewer — so this is a loose guard and packSnippet() remains authoritative.
  snippetText.maxLength = MAX_SNIPPET_BYTES;
  snippetLabel.textContent = `Text to send · up to ${MAX_SNIPPET_LABEL}`;

  document.querySelector('.mode-nav a[href="../send/"]')?.setAttribute("aria-current", "page");
  if (DEMO) {
    const current = document.querySelector('.mode-nav a[href="../send/"]');
    if (current) current.textContent = "Demo";
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-demo]")) {
      button.addEventListener("click", () => void selectDemo(button.dataset.demo!));
    }
  } else {
    cfgFile.addEventListener("change", () => void selectFile());
    // While a file is armed the picker label must NOT open the file dialog:
    // preventDefault cancels the label→input forwarding, and only the button
    // (or a keyboard activation of the hidden input, whose click bubbles up
    // through the label) stops the stream.
    paneFile.addEventListener("click", (event) => {
      if (!paneFile.classList.contains("has-file")) return;
      event.preventDefault();
      const target = event.target instanceof Element ? event.target : null;
      if (target && (target.closest(".file-picker-button") || target === cfgFile)) stopTransfer();
    });
    sendSnippetBtn.addEventListener("click", () => void selectSnippet());
    for (const input of modeInputs) input.addEventListener("change", applyMode);
  }
    if (webrtcSenderVideo) {
      bindTapToFocus(webrtcSenderVideo, () => activeSenderStream);
    }
  }
  for (const input of transferTechInputs) {
    input.addEventListener("change", () => {
      currentTransferTech = input.value as "optical" | "radio";
      stopTransfer();
    });
  }
  applyMode();
  window.addEventListener("resize", () => resizeDisplay?.());
  for (const el of [cfgFps, cfgBytes, cfgEcc, cfgSize]) {
    el.addEventListener("change", () => void startStream());
  }
  await requestScreenWakeLock();
}

/** Only on a fresh pick — a settings change restarts the stream too, and
 *  yanking the page down every time you nudge tx fps is worse than useless. */
function scrollStageIntoView() {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  requestAnimationFrame(() => {
    stage.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  });
}

async function startStream(revealStage = false) {
  const gen = ++generation;
  resizeDisplay = null;
  // Stale until this stream's first frame locks its version and refills them.
  showStreamPanels(false);
  if (!selectedFile) {
    setStatus(
      currentMode() === "snippet" ? "Paste or type some text to begin" : "Choose a file to begin",
    );
    return;
  }
  const { name, size: fileSize, payload, compression, transmittedSize } = selectedFile;
  if (gen !== generation) return; // superseded while fetching
  const txFps = Number(cfgFps.value);
  const frameBytes = Number(cfgBytes.value);
  const ecc = cfgEcc.value as "L" | "M" | "Q" | "H";
  const displayPx = Number(cfgSize.value);

  const sessionId = (Math.floor(Math.random() * 0xffff) + 1) & 0xffff;
  const blockLen = blockLength(frameBytes);
  // Keep selectedFile on this path — raising bytes/frame back up is the fix,
  // and dropping the pick would hide that.
  if (!fitsInOneStream(payload.length, frameBytes)) {
    // Name a setting that is actually in the dropdown, not the bare minimum.
    const offered = [...cfgBytes.options].map((option) => Number(option.value));
    const suggestion =
      smallestSufficientFrameSize(payload.length, offered) ?? minimumFrameBytes(payload.length);
    showError(
      `${formatBytes(payload.length)} needs ` +
        `${sourceBlockCount(payload.length, frameBytes).toLocaleString()} blocks at ` +
        `${frameBytes} bytes per frame, and a frame can only number ` +
        `${MAX_SOURCE_BLOCKS.toLocaleString()} of them. ` +
        `Raise bytes / frame to ${suggestion} or more.`,
    );
    return;
  }
  const encoder = new LTEncoder(payload, blockLen, sessionId);
  const header: FrameHeader = {
    sessionId,
    seq: 0,
    k: encoder.k,
    blockLen,
    totalLen: payload.length,
    payloadFnv: fnv1a(payload),
  };

  let version: number | undefined; // locked after the first frame
  let modules = 0;
  let scale = 1;
  const staging = document.createElement("canvas");
  const queue: ImageData[] = [];
  let nextSeq = 0;
  stage.hidden = false;

  const sizeCanvas = () => {
    const dpr = window.devicePixelRatio || 1;
    const total = modules + 2 * MARGIN;
    let cssBudget: number;
    if (document.body.classList.contains("qr-full")) {
      // Tap-to-fullscreen: the whole short viewport edge. The display-size
      // slider and page chrome are deliberately ignored — the point of the
      // mode is "as big as this device goes".
      cssBudget = Math.min(window.innerWidth, window.innerHeight);
    } else {
      const containerWidth =
        stage.parentElement?.getBoundingClientRect().width ?? window.innerWidth;
      const stageStyle = getComputedStyle(stage);
      const horizontalChrome =
        Number.parseFloat(stageStyle.paddingLeft) +
        Number.parseFloat(stageStyle.paddingRight) +
        Number.parseFloat(stageStyle.borderLeftWidth) +
        Number.parseFloat(stageStyle.borderRightWidth);
      cssBudget = fitQrDisplaySize(
        window.innerWidth,
        window.innerHeight,
        containerWidth,
        displayPx,
        horizontalChrome,
      );
    }
    scale = Math.max(1, Math.floor((cssBudget * dpr) / total));
    staging.width = total;
    staging.height = total;
    canvas.width = total * scale;
    canvas.height = total * scale;
    canvas.style.width = `${(total * scale) / dpr}px`;
    canvas.style.height = `${(total * scale) / dpr}px`;
  };

  const makeFrame = (): ImageData => {
    const bytes = packFrame({ ...header, seq: nextSeq }, encoder.encode(nextSeq));
    nextSeq++;
    const qr = QRCode.create([{ data: bytes, mode: "byte" } as unknown as QRCode.QRCodeSegment], {
      errorCorrectionLevel: ecc,
      version,
      maskPattern: 4,
    });
    if (version === undefined) {
      version = qr.version;
      modules = qr.modules.size;
      sizeCanvas();
      resizeDisplay = sizeCanvas;
      // Scroll only now: before sizeCanvas() the canvas is still 16×16, so the
      // scroll target would be the wrong height.
      if (revealStage) scrollStageIntoView();
      // The stream's parameters live at the bottom of Transfer settings, next
      // to the knobs that produced them; the status line stays for prose.
      spec("spec-fps").textContent = `${txFps} fps`;
      spec("spec-frame").textContent = `${frameBytes} bytes`;
      spec("spec-qr").textContent = `V${version} · ECC ${ecc}`;
      spec("spec-payload").textContent = `${name} · ${formatBytes(fileSize)}`;
      spec("spec-compression").textContent =
        compression === "gzip" ? `gzip → ${formatBytes(transmittedSize)}` : "none";
      spec("spec-k").textContent = `K = ${encoder.k}`;
      showStreamPanels(true);
      // The tail of the status line is the door to the share dialog. Built by
      // hand because setStatus is textContent-only — and the next setStatus
      // wiping the button out is exactly right.
      setStatus(`Streaming ${name} — `);
      const share = document.createElement("button");
      share.type = "button";
      share.className = "text-button";
      share.textContent = "Share receiver link";
      share.addEventListener("click", openShareDialog);
      specs.append(share);
    }
    const raster = rasterizeQr(qr.modules.size, qr.modules.data, MARGIN);
    return new ImageData(new Uint8ClampedArray(raster.pixels.buffer), raster.size, raster.size);
  };

  /**
   * Refill the lookahead, generating at most `max` frames per call.
   *
   * Called once up front to fill the queue, then once per tick() — the only
   * thing that drains it. Self-scheduling on `setTimeout(pump, 0)` instead cost
   * ~250 wake-ups a second doing nothing once the queue was full. Capping at
   * one frame per tick keeps the amortisation that gave us: a rAF callback
   * never pays for more than the single frame it just consumed.
   */
  let generatorFailed = false;
  const pump = (max = LOOKAHEAD) => {
    if (generatorFailed || gen !== generation) return;
    try {
      for (let n = 0; n < max && queue.length < LOOKAHEAD; n++) queue.push(makeFrame());
    } catch (err) {
      // e.g. frame bytes over capacity for the chosen ECC level
      generatorFailed = true;
      showError(err instanceof Error ? err.message : String(err));
    }
  };
  pump();

  const interval = 1000 / txFps;
  let nextAt = performance.now();
  const tick = (now: number) => {
    // generatorFailed means no frame will ever be produced again, so stop the
    // rAF loop rather than spinning on an empty queue until a settings change.
    if (gen !== generation || generatorFailed) return;
    requestAnimationFrame(tick);
    if (now < nextAt) return;
    const img = queue.shift();
    pump(1);
    if (!img) {
      nextAt = now + interval;
      return;
    }
    staging.getContext("2d")!.putImageData(img, 0, 0);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(staging, 0, 0, canvas.width, canvas.height);
    nextAt += interval;
    if (now - nextAt > 3 * interval) nextAt = now + interval; // fell behind — don't burst
  };
  requestAnimationFrame(tick);
}

void main();
