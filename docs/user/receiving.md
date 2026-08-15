# Receiving Files and Text

The WaveDrop receiver operates across standard mobile and desktop web browsers as well as the native Kotlin Android wrapper.

---

## 1. Optical Fountain Reception

### 1.1 Operation
1. Navigate to `/receive/` and click **Start camera**.
2. Align the camera viewfinder with the sender's animated QR display.
3. The receiver dynamically adjusts to the incoming stream. It handles session restarts and changes in sender block parameters automatically without requiring manual page reloads.

### 1.2 Reception Diagnostics
The interface displays live transfer telemetry:
- **FPS:** Camera capture rate vs WebAssembly decode throughput.
- **Goodput:** Decoded payload transfer rate (KB/s).
- **Frames Collected:** Total unique droplets received vs estimated required frames ($K \cdot 1.15$).
- **Source Blocks ($K$):** Total logical blocks composing the complete payload.

### 1.3 Completion and File Verification
Upon decoding all $K$ source blocks:
- The raw binary container is decompressed if GZIP was utilized.
- The payload's cryptographic SHA-256 hash is computed and validated against the container's embedded digest.
- Images, audio, and video formats render with an inline playback preview (video is served via HTTP 206 Partial Content caching).
- Text snippets display an interactive **Copy to Clipboard** button.
- Clicking **Clear WaveDrop cache** purges all staged binary media from browser storage.

---

## 2. Receiver Configuration Controls

| Setting | Default | Technical Role |
|---|---|---|
| **Capture Width** | 1280 px | Optimal balance between barcode module resolution and decode latency. 1920 px increases decode time; 960 px is suitable for legacy mobile chipsets. |
| **Capture FPS** | 60 FPS | Configures hardware camera capture frequency. (Demands exact 60 FPS on iOS to bypass default 30 FPS throttling). |
| **Decode Workers** | 2 | Number of parallel Web Workers running instances of `zxing-wasm`. 2–3 workers provide optimal throughput without causing CPU thermal throttling. |
