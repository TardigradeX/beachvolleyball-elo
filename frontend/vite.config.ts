import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  plugins: [svelte()],
  assetsInclude: ["**/*.bmp"],
  build: {
    outDir: "dist",
    target: "esnext",
  },
});
