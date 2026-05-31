import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";

const repoName = "boke";
const isUserSite = repoName === "longwudf.github.io";

export default defineConfig({
  site: "https://longwudf.github.io",
  base: isUserSite ? "/" : `/${repoName}`,
  output: "static",
  integrations: [
    mdx(),
    sitemap(),
    tailwind({
      applyBaseStyles: false
    })
  ],
  markdown: {
    shikiConfig: {
      theme: "github-dark",
      wrap: true
    }
  }
});
