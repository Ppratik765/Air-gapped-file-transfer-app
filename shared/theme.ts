import gsap from "gsap";

export type Theme = "light" | "dark";

const STORAGE_KEY = "wavedrop-theme";

export function getPreferredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return "light";
}

export function applyTheme(theme: Theme, animate = false): void {
  const root = document.documentElement;
  const currentTheme = root.getAttribute("data-theme") as Theme;
  if (currentTheme === theme && !animate) return;

  if (animate) {
    // GSAP smooth theme transition animation
    gsap.to(root, {
      duration: 0.45,
      ease: "power2.out",
      onStart: () => {
        root.setAttribute("data-theme", theme);
      },
    });

    const toggleBtn = document.getElementById("theme-toggle");
    if (toggleBtn) {
      gsap.fromTo(
        toggleBtn,
        { rotate: -30, scale: 0.85 },
        { rotate: 0, scale: 1, duration: 0.4, ease: "back.out(1.7)" }
      );
    }
  } else {
    root.setAttribute("data-theme", theme);
  }

  localStorage.setItem(STORAGE_KEY, theme);
  updateToggleUI(theme);
}

export function updateToggleUI(theme: Theme): void {
  const toggleBtn = document.getElementById("theme-toggle");
  if (!toggleBtn) return;
  const label = toggleBtn.querySelector(".theme-label");
  const iconContainer = toggleBtn.querySelector(".theme-icon-container");

  if (label) {
    label.textContent = theme === "dark" ? "Dark" : "Light";
  }

  if (iconContainer) {
    if (theme === "dark") {
      iconContainer.innerHTML = `<svg class="theme-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    } else {
      iconContainer.innerHTML = `<svg class="theme-toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
    }
  }
}

export function toggleTheme(): Theme {
  const current = getPreferredTheme();
  const next: Theme = current === "light" ? "dark" : "light";
  applyTheme(next, true);
  return next;
}

export function initTheme(): void {
  const theme = getPreferredTheme();
  applyTheme(theme, false);

  const toggleBtn = document.getElementById("theme-toggle");
  if (toggleBtn) {
    toggleBtn.addEventListener("click", () => toggleTheme());
  }
}
