import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { sveltekit } from "@sveltejs/kit/vite";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vite";

const base = (process.env.BASE_PATH ?? "") as "" | `/${string}`;

export default defineConfig({
  envPrefix: ["PUBLIC_"],
  plugins: [
    UnoCSS({
      // HACK: temp fix for vite 8 compat and causing flash of unstylized content
      mode: "per-module",
    }),
    sveltekit({
      preprocess: vitePreprocess(),
      adapter: adapter({ fallback: "404.html" }),
      paths: { base },
      prerender: {
        handleHttpError: ({ message, status }) => {
          if (status === 404) return;
          throw new Error(message);
        },
      },
    }),
  ],
});
