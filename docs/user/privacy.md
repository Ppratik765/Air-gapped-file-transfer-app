# Privacy and Security Model

WaveDrop is engineered with a strict local-first, zero-telemetry architectural posture.

---

## 1. Zero Network Exfiltration

- In **Optical Stream Mode**, data transmission occurs exclusively via visible electromagnetic radiation (light emitted from screen to camera lens). No radio interfaces (Wi-Fi, Bluetooth, NFC, Cellular) are accessed or required.
- The web application contains zero third-party tracking scripts, analytics SDKs, external font requests, or remote telemetry endpoints.
- After the initial visit (or when using standalone/native builds), all logic runs completely offline.

---

## 2. Channel Visibility vs Encryption

- **Optical Channel Security:** The optical stream is **not encrypted** by default. Any camera or observer with visual line-of-sight to the transmitting screen can capture and decode the payload. WaveDrop provides physical network isolation (air-gapping), not visual confidentiality.
- **WebRTC DataChannel Security:** When utilizing WebRTC Direct mode, all binary transmission through the `RTCDataChannel` is cryptographically secured via Datagram Transport Layer Security (DTLS-SRTP) using ephemeral key pairs generated directly on each device.

---

## 3. Cryptographic Data Integrity

- Every transmitted container carries a 32-byte SHA-256 cryptographic digest computed prior to transmission.
- Upon decoding the fountain droplet cascade, the receiver computes the SHA-256 hash of the reconstructed payload and verifies it against the header. Any bit corruption or frame mismatch causes an immediate integrity alert, preventing the execution or storage of compromised files.

---

## 4. Local Storage and Data Persistence

- **Text Snippets:** Stored entirely in volatile JavaScript memory; destroyed immediately upon closing or refreshing the browser tab.
- **Transferred Files:** Saved directly to the user's local file system only when explicitly requested.
- **Media Cache API:** Received video/audio files are temporarily staged in the browser's Cache API solely to support Range requests (`bytes=start-end`) for in-page playback. Tapping **Clear WaveDrop cache** immediately purges all stored media from disk.
