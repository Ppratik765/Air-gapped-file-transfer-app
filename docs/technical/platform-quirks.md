# Platform Quirks and Hardened Workarounds

This document outlines key platform-specific behaviors, browser engine differences, and hardware limitations encountered during development, along with their implemented architectural workarounds.

---

## 1. Web Camera and Video Pipeline

### 1.1 iOS Frame Rate Clamping
- **Behavior:** When requesting `getUserMedia({ video: { frameRate: { ideal: 60 } } })`, iOS WebKit silently delivers 30 FPS.
- **Workaround:** Demand `{ exact: 60 }` constraint at 1280px capture width, and catch errors to fall back gracefully to `{ ideal: 60 }`. Always read back `track.getSettings().frameRate` to confirm true stream throughput.

### 1.2 Constraint Rejection During Active Transfer
- **Behavior:** Mobile Safari occasionally throws runtime exceptions when invoking `applyConstraints()` on active streams (e.g., dynamic focus or resolution adjustment).
- **Workaround:** Wrap runtime constraint modifications in non-fatal promise handlers. If the hardware rejects live changes, the receiver preserves the running stream rather than interrupting an in-progress transfer.

### 1.3 Capability Probing over User-Agent Sniffing
- **Behavior:** UA strings on mobile browsers are notoriously spoofed or inaccurate.
- **Workaround:** Capabilities are probed directly via `MediaStreamTrack.getCapabilities()`. Chrome on Android exposes `torch`, `focusMode`, and `frameRate.max`; iOS exposes none. Unreachable frame rate options are dynamically disabled in the UI. Note: The flashlight (`torch`) is deliberately disabled by policy during optical scanning to prevent screen reflection and glare on the sender's display.

---

## 2. In-Browser Media Playback and Range Requests

### 2.1 iOS Safari `blob:` URL Playback Failure
- **Behavior:** iOS AVFoundation refuses to seek or play video and audio loaded from standard `blob:` URLs, demanding standard HTTP Range header semantics (`bytes=start-end`).
- **Workaround:** Decoded binary media is staged into the browser's Cache API. A dedicated Workbox Service Worker route (`rangeRequests`) intercepts calls to `https://.../received-media` and responds with HTTP 206 Partial Content slices. A fallback listener ensures that if the Service Worker is unavailable, standard `blob:` URLs are used.

---

## 3. Safari 26 UI Chrome and Liquid Glass Tinting

### 3.1 CSS Sampling Latches
- **Behavior:** Safari 26 samples viewport background colors to dynamically tint navigation bars and safe-area insets. Fixed-position elements (e.g., fullscreen overlays) cause Safari to latch incorrect contrast samples even after dismissal.
- **Workaround:** Fullscreen QR display avoids `position: fixed` overlays entirely. Instead, the UI applies a `body.qr-full` state class that hides non-essential DOM nodes in normal flow, ensuring the layout tree repaints cleanly upon exit without leaving artifacts in the browser chrome.

---

## 4. Native Android Subsystem Quirks

### 4.1 CameraX and ML-Kit Backpressure
- **Behavior:** High-density animated QR codes delivered at 60 FPS can saturate ML-Kit's barcode analyzer on mid-tier Android devices, causing memory pressure and frame queue lag.
- **Workaround:** `ImageAnalysis.Builder` is configured with `STRATEGY_KEEP_ONLY_LATEST`. Older unanalyzed camera frames are dropped immediately at the native layer, allowing the analyzer to process only the latest optical frame.

### 4.2 Wi-Fi Direct (P2P) Permission Matrix
- **Behavior:** Android 13+ (API level 33+) requires the `NEARBY_WIFI_DEVICES` permission with `neverForLocation` flags, whereas earlier Android releases mandate `ACCESS_FINE_LOCATION` to perform Wi-Fi Direct peer discovery.
- **Workaround:** `MainActivity.kt` dynamically evaluates the SDK version at runtime and requests the exact version-specific permission array before invoking `WifiP2pManager.discoverPeers()`.
