import type { Plugin } from "vite";

export function generateVersion(version: string): Plugin {
  return {
    name: "generate-version",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version }),
      });
    },
  };
}
