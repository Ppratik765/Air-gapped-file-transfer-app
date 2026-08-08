/**
 * Detection & initialization for the Native App Promotion Banner.
 *
 * Displays a top banner to mobile web users who are NOT running inside the
 * native Android WebView app, inviting them to download the native APK for
 * faster scanning and larger file transfers.
 */

export function isMobileDevice(): boolean {
  return /Mobi|Android/i.test(navigator.userAgent);
}

export function isInsideNativeApp(): boolean {
  return (window as unknown as { AndroidNativeCamera?: unknown }).AndroidNativeCamera !== undefined;
}

export function initAppPromoBanner(): void {
  const banner = document.getElementById("app-promo-banner");
  if (!banner) return;

  const dismissed = sessionStorage.getItem("wavedrop-dismiss-promo") === "true";
  const shouldShow = isMobileDevice() && !isInsideNativeApp() && !dismissed;

  if (shouldShow) {
    banner.style.display = "block";
  } else {
    banner.style.display = "none";
  }

  const dismissBtn = document.getElementById("dismiss-promo-btn");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      banner.style.display = "none";
      sessionStorage.setItem("wavedrop-dismiss-promo", "true");
    });
  }
}
