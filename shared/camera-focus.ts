/**
 * Interactive Tap-to-Focus handler for WebRTC / MediaStreamTrack video preview elements.
 * Works across all camera instances (Optical receiver, WebRTC sender answer scanner, WebRTC receiver offer scanner).
 */
import { applyAdvancedConstraint, probeCameraCapabilities } from "./platform";

export function bindTapToFocus(
  videoElement: HTMLVideoElement,
  getStream: () => MediaStream | null,
): () => void {
  const container = videoElement.parentElement;
  if (!container) return () => {};

  // Ensure container can anchor absolute reticle positioning
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }

  let focusTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleClick = async (event: MouseEvent) => {
    const rect = videoElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Calculate relative tap position within video element (0.0 to 1.0)
    const clientX = event.clientX - rect.left;
    const clientY = event.clientY - rect.top;
    const normX = Math.min(Math.max(clientX / rect.width, 0), 1);
    const normY = Math.min(Math.max(clientY / rect.height, 0), 1);

    // 1. Render glowing amber focus reticle visual animation
    showFocusReticle(container, clientX, clientY);

    // 2. Programmatic MediaStreamTrack focus adjustment
    const stream = getStream();
    const track = stream?.getVideoTracks()[0];
    if (!track) return;

    const caps = probeCameraCapabilities(track);

    // Native app bridge support if present
    const nativeCam = (
      window as unknown as {
        AndroidNativeCamera?: { triggerFocus?: (x: number, y: number) => void };
      }
    ).AndroidNativeCamera;
    if (nativeCam && typeof nativeCam.triggerFocus === "function") {
      try {
        nativeCam.triggerFocus(normX, normY);
      } catch {
        // Fall back cleanly to WebRTC track API
      }
    }

    try {
      if (caps.continuousFocus) {
        // Attempt point-of-interest single-shot focus
        const poiConstraint: Record<string, unknown> = {
          focusMode: "single-shot",
          pointsOfInterest: [{ x: normX, y: normY }],
        };
        const success = await applyAdvancedConstraint(track, poiConstraint as MediaTrackConstraintSet);
        if (!success) {
          await applyAdvancedConstraint(track, { focusMode: "single-shot" });
        }

        // Return to continuous autofocus after 2s so lens doesn't stay locked
        if (focusTimeout) clearTimeout(focusTimeout);
        focusTimeout = setTimeout(() => {
          void applyAdvancedConstraint(track, { focusMode: "continuous" });
        }, 2000);
      }
    } catch {
      // Browsers like iOS Safari handle focus via hardware automatically
    }
  };

  videoElement.addEventListener("click", handleClick);
  return () => {
    videoElement.removeEventListener("click", handleClick);
    if (focusTimeout) clearTimeout(focusTimeout);
  };
}

function showFocusReticle(container: HTMLElement, x: number, y: number): void {
  const oldReticle = container.querySelector(".camera-focus-reticle");
  if (oldReticle) oldReticle.remove();

  const reticle = document.createElement("div");
  reticle.className = "camera-focus-reticle";
  reticle.style.left = `${x}px`;
  reticle.style.top = `${y}px`;

  container.appendChild(reticle);

  requestAnimationFrame(() => {
    reticle.classList.add("active");
  });

  setTimeout(() => {
    reticle.remove();
  }, 1000);
}
