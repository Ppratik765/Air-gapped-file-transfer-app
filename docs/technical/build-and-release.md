# Build and Release Pipeline

WaveDrop provides a unified build pipeline supporting browser deployments, progressive web apps (PWA), standalone zero-dependency HTML files, and native Android APK packages.

---

## 1. Build Commands and Scripts

All build routines are orchestrated via `npm` scripts defined in `package.json`:

```bash
npm run dev               # Starts local HTTPS development server with Hot Module Replacement
npm run serve             # Builds production bundle and runs preview server
npm run demo              # Dev server with VITE_DEMO=1 (locks sender to bundled test payloads)
npm test                  # Executes unit tests and golden wire-format vector assertions
npm run build             # Typechecks application and compiles hosted web site to dist/
npm run build:standalone  # Generates zero-dependency single-file HTML distributions in dist-standalone/
npm run build:android     # Compiles web assets and synchronizes them to android/app/src/main/assets/www/
npm run build:all         # Executes standard build and standalone builds in sequence
npm run icons             # Regenerates public/ icon sets from SVG source (requires librsvg)
```

---

## 2. Compilation Targets

### 2.1 Hosted Progressive Web App (`dist/`)
- Invokes `tsc` for TypeScript type verification across application and Node configurations.
- Rollup compiles entry points (`index.html`, `send/index.html`, `receive/index.html`).
- `vite-plugin-pwa` bundles the Service Worker with Workbox precaching, caching all JavaScript, CSS, HTML, and the 940 KB `zxing_reader.wasm` WebAssembly binary.
- Configured with `base: "./"`, enabling deployment under arbitrary root domains or subdirectory paths.

### 2.2 Standalone Single-File Distributions (`dist-standalone/`)
- Compiles `wavedrop-sender.html` (~55 KB) and `wavedrop-receiver.html` (~1.3 MB).
- `vite-plugin-singlefile` inlines all stylesheets, scripts, and media.
- Custom build plugins (`inline-zxing-wasm.ts`, `use-inline-variants.ts`) encode the WebAssembly decoder binary directly into the receiver page as a Base64 `data:` URI, creating an entirely self-contained HTML file runnable with no external network connectivity.

### 2.3 Native Android Application (`android/`)
- `npm run build:android` compiles the production web bundle and executes `node ./build-android-assets.js`.
- Web assets are copied to `android/app/src/main/assets/www/`.
- The Android project compiles via Gradle:
  ```bash
  cd android
  ./gradlew assembleDebug      # Generates debug APK: app/build/outputs/apk/debug/app-debug.apk
  ./gradlew assembleRelease    # Generates release APK: app/build/outputs/apk/release/app-release-unsigned.apk
  ```

---

## 3. Continuous Integration and Automation (`.github/workflows/`)

- **`ci.yml`**: Runs on all pull requests and pushes to `main`. Executes test suites, validates wire-format vectors, checks TypeScript constraints, and asserts that the `receive` bundle size remains within strict size budgets.
- **`pages.yml`**: Automates deployment of `dist/` to GitHub Pages upon merges into `main`.
- **`release.yml`**: Triggers on version tags (`v*`). Builds all distributions, packages `wavedrop-<version>-site.zip`, attaches standalone HTML binaries and APKs, and generates `SHA256SUMS.txt`.

---

## 4. Release Process

1. Create a release branch: `git checkout -b release/vX.Y.Z`.
2. Update application version: `npm version X.Y.Z --no-git-tag-version`.
3. Commit release preparations and open a pull request.
4. Merge to `main` and create a signed Git tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
5. GitHub Actions builds, tests, and publishes all release artifacts automatically.
