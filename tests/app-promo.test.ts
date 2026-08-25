import test from "node:test";
import assert from "node:assert/strict";
import { compareVersions, RELEASE_APK_URL } from "../shared/app-promo";

test("RELEASE_APK_URL points to GitHub release v1.0.0", () => {
  assert.equal(
    RELEASE_APK_URL,
    "https://github.com/Ppratik765/Air-gapped-file-transfer-app/releases/download/v1.0.0/WaveDrop.apk",
  );
});

test("compareVersions compares semver versions correctly", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0"), 0);
  assert.equal(compareVersions("1.0.1", "1.0.0"), 1);
  assert.equal(compareVersions("1.1.0", "1.0.9"), 1);
  assert.equal(compareVersions("2.0.0", "1.9.9"), 1);
  assert.equal(compareVersions("0.9.0", "1.0.0"), -1);
  assert.equal(compareVersions("1.0.0", "1.0.1"), -1);
  assert.equal(compareVersions("1.0", "1.0.0"), 0);
});
