import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { sveltekit } from "@sveltejs/kit/vite";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  envPrefix: ["PUBLIC_"],
  plugins: [
    UnoCSS({
      // HACK: temp fix for vite 8 compat
      mode: "per-module",
    }),
    sveltekit({ preprocess: vitePreprocess(), adapter: adapter() }),
  ],
});
