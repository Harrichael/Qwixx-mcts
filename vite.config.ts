import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

const sha = (() => {
  try {
    return execSync("git rev-parse --short=7 HEAD").toString().trim();
  } catch {
    return "dev";
  }
})();

export default defineConfig({
  base: "/Qwixx-mcts/",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`0.${sha}`),
  },
});
