import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const distDir = path.join(root, "dist");
const blogDir = path.join(root, "src", "content", "blog");
const projectsFile = path.join(root, "src", "data", "projects.json");

type Project = {
  slug?: unknown;
  links?: Array<{
    href?: unknown;
  }>;
};

const exists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const assertExists = async (filePath: string, label: string, errors: string[]) => {
  if (!(await exists(filePath))) errors.push(`missing ${label}: ${path.relative(root, filePath)}`);
};

const routeToIndex = (href: string) => {
  const clean = href.replace(/^\/+/, "").replace(/\/$/, "");
  if (!clean) return path.join(distDir, "index.html");
  if (path.extname(clean)) return path.join(distDir, clean);
  return path.join(distDir, clean, "index.html");
};

const main = async () => {
  const errors: string[] = [];
  await assertExists(path.join(distDir, "index.html"), "home page", errors);
  await assertExists(path.join(distDir, "404.html"), "404 page", errors);
  await assertExists(path.join(distDir, "rss.xml"), "RSS feed", errors);
  await assertExists(path.join(distDir, "sitemap-index.xml"), "sitemap index", errors);
  await assertExists(path.join(distDir, "search-index.json"), "search index", errors);
  await assertExists(path.join(distDir, "robots.txt"), "robots.txt", errors);
  await assertExists(path.join(distDir, "friends", "index.html"), "friends page", errors);
  await assertExists(path.join(distDir, "now", "index.html"), "now page", errors);
  await assertExists(path.join(distDir, "resources", "index.html"), "resources page", errors);
  await assertExists(path.join(distDir, "random", "index.html"), "random page", errors);
  await assertExists(path.join(distDir, "projects", "index.html"), "projects page", errors);

  const entries = await fs.readdir(blogDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => entry.name);
  const publishedSlugs: string[] = [];
  const covers: string[] = [];

  for (const file of files) {
    const source = await fs.readFile(path.join(blogDir, file), "utf8");
    const parsed = matter(source);
    if (parsed.data.draft === true) continue;
    const slug = file.replace(/\.(md|mdx)$/i, "");
    publishedSlugs.push(slug);
    if (typeof parsed.data.cover === "string" && parsed.data.cover.trim()) {
      covers.push(parsed.data.cover);
    }
  }

  for (const slug of publishedSlugs) {
    await assertExists(path.join(distDir, "blog", slug, "index.html"), `article route ${slug}`, errors);
  }

  const projectsRaw = await fs.readFile(projectsFile, "utf8");
  const projects = JSON.parse(projectsRaw) as Project[];
  for (const project of projects) {
    if (typeof project.slug !== "string" || !project.slug.trim()) {
      errors.push("project entry missing slug");
      continue;
    }
    await assertExists(path.join(distDir, "projects", project.slug, "index.html"), `project route ${project.slug}`, errors);

    for (const link of project.links ?? []) {
      if (typeof link.href !== "string") continue;
      if (link.href.startsWith("/") && !link.href.startsWith("//")) {
        await assertExists(routeToIndex(link.href), `project link ${link.href}`, errors);
      }
    }
  }

  if (await exists(path.join(distDir, "search-index.json"))) {
    const rawIndex = await fs.readFile(path.join(distDir, "search-index.json"), "utf8");
    const index = JSON.parse(rawIndex) as unknown[];
    if (index.length !== publishedSlugs.length) {
      errors.push(`search index contains ${index.length} item(s), expected ${publishedSlugs.length}`);
    }
  }

  for (const cover of covers) {
    await assertExists(path.join(distDir, cover.replace(/^\/+/, "")), `cover image ${cover}`, errors);
  }

  if (await exists(path.join(distDir, "friends", "index.html"))) {
    const friendsHtml = await fs.readFile(path.join(distDir, "friends", "index.html"), "utf8");
    if (!friendsHtml.includes("https://wooxin.github.io")) {
      errors.push("friends page does not include https://wooxin.github.io");
    }
  }

  if (errors.length > 0) {
    console.error(`Site check failed with ${errors.length} issue(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Site check passed (${publishedSlugs.length} article route${publishedSlugs.length === 1 ? "" : "s"}).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
