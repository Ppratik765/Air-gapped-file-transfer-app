import { test } from "node:test";
import assert from "node:assert/strict";
import { compressSdp, decompressSdp, trimSdp } from "../shared/webrtc.ts";

test("trimSdp removes non-essential SDP lines", () => {
  const raw = "v=0\r\na=extmap:1 uri\r\na=fmtp:126\r\na=msid-semantic: WMS\r\na=max-message-size:262144\r\nc=IN IP4 127.0.0.1\r\n";
  const trimmed = trimSdp(raw);
  assert.equal(trimmed, "v=0\r\nc=IN IP4 127.0.0.1\r\n");
});

test("SDP Offer compression and decompression roundtrips correctly", async () => {
  const dummySdp = "v=0\r\no=- 1234567890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE data\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 192.168.1.5\r\na=candidate:1 1 UDP 2122260223 192.168.1.5 54321 typ host";
  
  const compressed = await compressSdp(dummySdp, "OFFER");
  assert.ok(compressed.startsWith("WD_OFFER:"));
  
  const restored = await decompressSdp(compressed, "OFFER");
  assert.equal(restored, trimSdp(dummySdp));
});

test("SDP Answer compression and decompression roundtrips correctly", async () => {
  const dummyAnswer = "v=0\r\no=- 9876543210 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE data\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 192.168.1.8\r\na=candidate:1 1 UDP 2122260223 192.168.1.8 54322 typ host\r\n";
  
  const compressed = await compressSdp(dummyAnswer, "ANSWER");
  assert.ok(compressed.startsWith("WD_ANSWER:"));
  
  const restored = await decompressSdp(compressed, "ANSWER");
  assert.equal(restored, trimSdp(dummyAnswer));
});

test("decompressSdp rejects wrong prefix", async () => {
  const dummyPayload = "WD_OFFER:SGVsbG8=";
  await assert.rejects(
    async () => {
      await decompressSdp(dummyPayload, "ANSWER");
    },
    /Invalid signaling code format/,
  );
});
