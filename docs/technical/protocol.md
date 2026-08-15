# Protocol Specification

WaveDrop operates over physical air-gaps using two distinct transmission paradigms:
1. **Unidirectional Optical Fountain Coding (Simplex Light-Stream)**
2. **Serverless Optical WebRTC Handshake (Bidirectional High-Speed DataChannel)**

---

## 1. Unidirectional Optical Fountain Coding

### 1.1 The Simplex Erasure Channel Problem
In an optical screen-to-camera transmission link, there is no physical or logical reverse feedback channel. The transmitting screen cannot receive acknowledgments (ACK/NACK) and cannot determine which visual frames were captured or dropped due to motion blur, frame rate desynchronization, rolling shutter artifacts, or lighting glare.

Sequential block transmission over a simplex channel degrades rapidly: dropping a single frame forces the receiver to wait an entire transmission cycle, leading to high latency and poor channel utilization.

### 1.2 Luby Transform (LT) Rateless Coding
To overcome simplex erasure limitations, WaveDrop implements Luby Transform rateless erasure codes. The source payload of size $M$ bytes is partitioned into $K$ source blocks of length $L$ bytes ($K = \lceil M / L \rceil$).

Rather than transmitting source blocks directly, the encoder generates an infinite stream of encoded droplets. Each droplet $F_s$ (where $s$ is the droplet sequence number) is the bitwise exclusive-OR (XOR) sum of a subset of $d$ source blocks:

$$F_s = \bigoplus_{i \in S_s} B_i$$

where $d = |S_s|$ is the degree of the droplet drawn from a **Robust Soliton Distribution** $\mu(d) + \tau(d)$.

### 1.3 Robust Soliton Degree Distribution
The degree distribution is designed to ensure that:
1. The receiver receives at least one degree-1 droplet (raw block) early to initiate the decoding process.
2. A ripple of degree-1 droplets is maintained throughout the decoding process as subsequent symbols are resolved.

The ideal soliton distribution $\rho(d)$ is defined as:
$$\rho(1) = \frac{1}{K}$$
$$\rho(d) = \frac{1}{d(d-1)} \quad \text{for } d = 2, 3, \dots, K$$

To prevent the decoding ripple from prematurely exhausting, the robust adjustment $\tau(d)$ is added:
$$\tau(d) = \begin{cases} \frac{R}{d \cdot K} & \text{for } d = 1, 2, \dots, \frac{K}{R} - 1 \\ \frac{R \ln(R/\delta)}{K} & \text{for } d = \frac{K}{R} \\ 0 & \text{for } d > \frac{K}{R} \end{cases}$$

where $R = c \cdot \ln(K/\delta)\sqrt{K}$, with tuning parameters $c = 0.1$ and $\delta = 0.5$.

The cumulative distribution function (CDF) is normalized:
$$\beta = \sum_{d=1}^K (\rho(d) + \tau(d))$$
$$\mu(d) = \frac{\rho(d) + \tau(d)}{\beta}$$

### 1.4 Bit-Exact Cross-Platform Logarithm (`dlog`)
JavaScript runtimes (V8, JavaScriptCore, SpiderMonkey) use architecture-dependent polynomial approximations for `Math.log`, causing slight float divergence in the least significant mantissa bits. If the sender (e.g., V8 on Chrome) and receiver (e.g., JavaScriptCore on iOS Safari) compute differing CDF thresholds, the PRNG selects different block subsets for sequence number $s$, resulting in silent, total decoding failure.

WaveDrop implements `dlog`, a bit-exact floating-point natural logarithm implementation adhering strictly to IEEE-754 binary64 arithmetic across all host architectures.

### 1.5 Peeling Decoder Algorithm
The receiver executes a sparse bipartite graph peeling decoder:
1. When a droplet with degree $d=1$ arrives, its source block is immediately decoded: $B_i = F_s$.
2. The known block $B_i$ is XORed into all buffered droplets that contain $B_i$ in their neighbor set $S$, reducing their effective degree by 1.
3. Any droplet whose degree drops to 1 is moved into the processing queue.
4. Steps 1–3 cascade until all $K$ blocks are resolved. The receiver reconstructs the original file once $N \approx K \cdot (1 + \epsilon)$ unique frames are collected (where $\epsilon \approx 0.15$).

---

## 2. Wire-Format Specification

### 2.1 20-Byte Frame Header
Each QR frame payload begins with a 20-byte binary header packed in network byte order (Big-Endian):

```text
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                          Session ID                           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        Sequence Number                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Block Count          |          Block Length         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         Total Length                          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                         Payload Hash                          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                     Payload Data (XOR sum)                    |
|                             ...                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

- **Session ID (`uint32`)**: Random identifier uniquely identifying the transmission stream.
- **Sequence Number (`uint32`)**: Monotonically increasing index determining the deterministic PRNG seed for subset selection.
- **Block Count $K$ (`uint16`)**: Total source blocks composing the payload.
- **Block Length $L$ (`uint16`)**: Byte length of each source block.
- **Total Length (`uint32`)**: Byte length of the unpadded payload container.
- **Payload Hash (`uint32`)**: CRC32/Adler integrity check across the container headers.

### 2.2 Container Format & SHA-256 Verification
The raw reconstructed payload contains an inner container structured as:
1. `flags (uint8)` — Indicates compression type (`0x01` for Deflate/GZIP).
2. `filename_length (uint16)` & `filename (UTF-8 bytes)`.
3. `mime_type_length (uint16)` & `mime_type (UTF-8 bytes)`.
4. `sha256_digest (32 bytes)` — Complete SHA-256 cryptographic hash of the original uncompressed file.
5. `payload_bytes` — The file data.

The receiver computes the SHA-256 checksum across the decoded bytes and compares it against the container header before presenting the download button.

---

## 3. Serverless Optical WebRTC Signaling

For high-throughput requirements (files up to 512 MB), WaveDrop provides a hybrid Optical-to-WebRTC mode that eliminates the need for signaling servers (STUN/TURN/WebSocket):

```text
[Sender Device]                                      [Receiver Device]
       |                                                     |
       |  1. Generate WebRTC Offer + Local Host ICE          |
       |  2. Prune & Deflate SDP -> QR Matrix                |
       |================ (Visual Scan) =====================>|
       |                                                     |  3. Parse Offer SDP
       |                                                     |  4. Generate WebRTC Answer
       |                                                     |  5. Prune & Deflate SDP -> QR
       |<=============== (Visual Scan) ======================|
       |                                                     |
       |  6. Parse Answer SDP                                |
       |  7. Establish Direct P2P RTCDataChannel             |
       |====================================================>|
       |  8. High-Speed Binary Streaming (10 - 50 MB/s)      |
```

### 3.1 SDP Dictionary Pruning (`trimSdp`)
Standard WebRTC Session Description Protocol (SDP) text contains redundant media lines, candidate types, and verbose formatting totaling 1–2 KB, which is too dense for quick optical scanning. WaveDrop strips all non-essential SDP fields:
- Retains exclusively `host` candidate lines (`typ host`).
- Removes audio/video media descriptions, retaining only `m=application` DataChannel declarations.
- Strips trailing ICE attributes unsupported in direct local networks.

### 3.2 Deflate Compression and Base64 QR Encoding
The pruned SDP string is compressed via raw Deflate (`pako` / `CompressionStream`) and encoded with a standard URI-safe identifier prefix (`wd1:o:` for Offers, `wd1:a:` for Answers). The resulting payload fits into a standard Version 10–14 QR code, scanned instantaneously by the opposite device.
