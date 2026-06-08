import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const blogDir = path.join(root, "src", "content", "blog");
const imageDir = path.join(root, "public", "images");
const publicDir = path.join(root, "public");

const exists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const toPublicFile = (publicPath: string) =>
  path.resolve(publicDir, publicPath.replace(/^\/+/, ""));

const collectImages = async () => {
  const entries = await fs.readdir(imageDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(entry.name))
    .map((entry) => `/images/${entry.name}`);
};

const main = async () => {
  const entries = await fs.readdir(blogDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => entry.name);
  const used = new Set<string>();
  const errors: string[] = [];

  for (const file of files) {
    const source = await fs.readFile(path.join(blogDir, file), "utf8");
    const parsed = matter(source);
    const cover = parsed.data.cover;
    if (typeof cover === "string" && cover.trim()) used.add(cover);

    for (const match of parsed.content.matchAll(/!\[[^\]]*]\((\/[^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      used.add(match[1]);
    }
  }

  for (const publicPath of used) {
    const fullPath = toPublicFile(publicPath);
    if (!fullPath.startsWith(publicDir) || !(await exists(fullPath))) {
      errors.push(`missing image: ${publicPath}`);
    }
  }

  if (errors.length > 0) {
    console.error(`Image check failed with ${errors.length} issue(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  const images = await collectImages();
  const unused = images.filter((image) => !used.has(image));
  if (unused.length > 0) {
    console.warn(`Image check passed with ${unused.length} unused image(s):`);
    for (const image of unused) console.warn(`- ${image}`);
  }

  console.log(`Image check passed (${used.size} referenced image${used.size === 1 ? "" : "s"}).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
