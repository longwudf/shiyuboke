import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const root = process.cwd();
const blogDir = path.join(root, "src", "content", "blog");
const publicDir = path.join(root, "public");

type PostData = {
  title?: unknown;
  description?: unknown;
  date?: unknown;
  updatedDate?: unknown;
  tags?: unknown;
  category?: unknown;
  cover?: unknown;
  draft?: unknown;
  featured?: unknown;
};

const isValidDate = (value: unknown) => {
  if (typeof value !== "string" && !(value instanceof Date)) return false;
  const date = new Date(value);
  return Number.isFinite(date.valueOf());
};

const stripDatePrefix = (slug: string) => slug.replace(/^\d{4}-\d{2}-\d{2}-/, "");

const exists = async (filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const validatePost = async (fileName: string, data: PostData) => {
  const errors: string[] = [];
  const requiredFields = [
    "title",
    "description",
    "date",
    "updatedDate",
    "category",
    "tags",
    "cover",
    "draft",
    "featured"
  ];

  for (const field of requiredFields) {
    if (!(field in data)) errors.push(`missing frontmatter field: ${field}`);
  }

  if (typeof data.title !== "string" || data.title.trim() === "") errors.push("title is required");
  if (typeof data.description !== "string" || data.description.trim() === "") errors.push("description is required");
  if (!isValidDate(data.date)) errors.push("date must be a valid date");
  if (!isValidDate(data.updatedDate)) errors.push("updatedDate must be a valid date");
  if (!Array.isArray(data.tags)) errors.push("tags must be an array");
  if (typeof data.category !== "string" || data.category.trim() === "") errors.push("category is required");
  if (typeof data.draft !== "boolean") errors.push("draft must be boolean");
  if (typeof data.featured !== "boolean") errors.push("featured must be boolean");

  if (typeof data.cover === "string" && data.cover.trim()) {
    if (!data.cover.startsWith("/")) {
      errors.push("cover must be an absolute public path starting with /");
    } else {
      const coverPath = path.join(publicDir, data.cover.replace(/^\/+/, ""));
      if (!coverPath.startsWith(publicDir) || !(await exists(coverPath))) {
        errors.push(`cover image does not exist: ${data.cover}`);
      }
    }
  } else if (typeof data.cover !== "string") {
    errors.push("cover must be a string");
  }

  return errors.map((error) => `${fileName}: ${error}`);
};

const main = async () => {
  const entries = await fs.readdir(blogDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => entry.name);

  const errors: string[] = [];
  const slugs = new Map<string, string>();

  for (const file of files) {
    const fullPath = path.join(blogDir, file);
    const source = await fs.readFile(fullPath, "utf8");
    const parsed = matter(source);
    errors.push(...(await validatePost(file, parsed.data)));

    const slug = stripDatePrefix(file.replace(/\.(md|mdx)$/i, ""));
    const existing = slugs.get(slug);
    if (existing) {
      errors.push(`${file}: duplicate slug with ${existing}`);
    }
    slugs.set(slug, file);
  }

  if (errors.length > 0) {
    console.error(`Post check failed with ${errors.length} issue(s):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`Post check passed (${files.length} post${files.length === 1 ? "" : "s"}).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
