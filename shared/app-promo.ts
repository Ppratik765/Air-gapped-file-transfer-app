/**
 * Detection & initialization for the Native App Promotion Banner.
 *
 * Displays a top banner to mobile web users who are NOT running inside the
 * native Android WebView app, inviting them to download the native APK for
 * faster scanning and larger file transfers.
 *
 * The banner appears every time the user opens or reloads the site.
 */

export const RELEASE_APK_URL =
  "https://github.com/Ppratik765/Air-gapped-file-transfer-app/releases/download/v1.0.0/WaveDrop.apk";

export function isMobileDevice(): boolean {
  return /Mobi|Android/i.test(navigator.userAgent);
}

export function isInsideNativeApp(): boolean {
  return (window as unknown as { AndroidNativeCamera?: unknown }).AndroidNativeCamera !== undefined;
}

export function getAppVersion(): string {
  const meta = document.querySelector('meta[name="app-version"]');
  return meta ? meta.getAttribute("content") || "0.0.0" : "0.0.0";
}

// Compare two semver strings: returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
export function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export function initAppPromoBanner(): void {
  const banner = document.getElementById("app-promo-banner");
  if (!banner) return;
  
  const textElement = banner.querySelector(".app-promo-text");
  const apkBtn = document.getElementById("download-apk-btn") as HTMLAnchorElement | null;
  const dismissBtn = document.getElementById("dismiss-promo-btn");

  const currentVersion = getAppVersion();

  // Clear any legacy localStorage key to ensure fresh reloads show the banner
  try {
    localStorage.removeItem("wavedrop_promo_dismissed");
  } catch {}

  // Check if current page load is a reload
  const isReload =
    (typeof performance !== "undefined" &&
      typeof performance.getEntriesByType === "function" &&
      (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined)?.type === "reload") ||
    (typeof performance !== "undefined" && (performance as unknown as { navigation?: { type?: number } }).navigation?.type === 1);

  if (isReload) {
    try {
      sessionStorage.removeItem("wavedrop_promo_dismissed");
    } catch {}
  }

  // If user previously dismissed the promo banner in this navigation session, keep it hidden
  try {
    if (sessionStorage.getItem("wavedrop_promo_dismissed") === "true") {
      banner.style.display = "none";
      return;
    }
  } catch {}

  if (isInsideNativeApp()) {
    // Native app update check (offline safe)
    banner.style.display = "none";
    
    // Attempt to fetch version.json silently from the live site
    fetch('https://wavedrop.vercel.app/version.json', { cache: 'no-store' })
      .then(res => {
        if (!res.ok) return null;
        return res.json();
      })
      .then(data => {
        if (data && data.version && compareVersions(data.version, currentVersion) > 0) {
          if (textElement) {
            textElement.textContent = `A new version of WaveDrop (${data.version}) is available!`;
          }
          if (apkBtn) {
            apkBtn.textContent = "Download Update";
            apkBtn.href = RELEASE_APK_URL; 
            apkBtn.setAttribute("download", "WaveDrop.apk");
            apkBtn.onclick = (e) => {
              e.preventDefault();
              window.location.href = RELEASE_APK_URL;
            };
          }
          banner.style.display = "block";
        }
      })
      .catch(() => {
        // Silently fail if offline (air-gapped transfer mode)
      });

  } else if (isMobileDevice()) {
    // Web app logic: show banner on mobile web
    if (textElement) {
      textElement.textContent = "Download the Native App for faster scanning and large file support!";
    }
    if (apkBtn) {
      apkBtn.textContent = "Download APK";
      apkBtn.href = RELEASE_APK_URL;
      apkBtn.setAttribute("download", "WaveDrop.apk");
      apkBtn.onclick = () => {
        try {
          sessionStorage.setItem("wavedrop_promo_dismissed", "true");
        } catch {}
        banner.style.display = "none";
        window.location.href = RELEASE_APK_URL;
      };
    }
    banner.style.display = "block";

  } else {
    // Desktop or non-mobile
    banner.style.display = "none";
  }

  if (dismissBtn) {
    dismissBtn.onclick = () => {
      try {
        sessionStorage.setItem("wavedrop_promo_dismissed", "true");
      } catch {}
      banner.style.display = "none";
    };
  }
}
