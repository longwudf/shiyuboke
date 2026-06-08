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
  series?: unknown;
  seriesOrder?: unknown;
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
  const warnings: string[] = [];
  const requiredFields = [
    "title",
    "description",
    "date",
    "category",
    "tags"
  ];

  for (const field of requiredFields) {
    if (!(field in data)) errors.push(`missing frontmatter field: ${field}`);
  }

  if (typeof data.title !== "string" || data.title.trim() === "") errors.push("title is required");
  if (typeof data.description !== "string" || data.description.trim() === "") errors.push("description is required");
  if (!isValidDate(data.date)) errors.push("date must be a valid date");
  if (data.updatedDate !== undefined && !isValidDate(data.updatedDate)) errors.push("updatedDate must be a valid date");
  if (Array.isArray(data.tags)) {
    const invalidTags = data.tags.filter((tag) => typeof tag !== "string" || tag.trim() === "");
    if (invalidTags.length > 0) errors.push("tags must only contain non-empty strings");
    const normalizedTags = data.tags.map((tag) => String(tag).trim().toLowerCase());
    if (new Set(normalizedTags).size !== normalizedTags.length) errors.push("tags must be unique");
    if (data.tags.length === 0) warnings.push("published posts should have at least one tag");
  } else {
    errors.push("tags must be an array");
  }
  if (typeof data.category !== "string" || data.category.trim() === "") errors.push("category is required");
  if (data.draft !== undefined && typeof data.draft !== "boolean") errors.push("draft must be boolean");
  if (data.featured !== undefined && typeof data.featured !== "boolean") errors.push("featured must be boolean");
  if (data.series !== undefined && (typeof data.series !== "string" || data.series.trim() === "")) {
    errors.push("series must be a non-empty string when provided");
  }
  if (data.seriesOrder !== undefined && (!Number.isInteger(data.seriesOrder) || Number(data.seriesOrder) < 1)) {
    errors.push("seriesOrder must be a positive integer when provided");
  }
  if (data.seriesOrder !== undefined && data.series === undefined) {
    warnings.push("seriesOrder is ignored without series");
  }

  if (isValidDate(data.date) && isValidDate(data.updatedDate)) {
    const date = new Date(data.date as string | Date);
    const updatedDate = new Date(data.updatedDate as string | Date);
    if (updatedDate.valueOf() < date.valueOf()) errors.push("updatedDate cannot be earlier than date");
  }

  if (typeof data.title === "string" && data.title.length > 80) warnings.push("title is longer than 80 characters");
  if (typeof data.description === "string") {
    if (data.description.length < 40) warnings.push("description is shorter than 40 characters");
    if (data.description.length > 160) warnings.push("description is longer than 160 characters");
  }

  if (typeof data.cover === "string" && data.cover.trim()) {
    if (!data.cover.startsWith("/")) {
      errors.push("cover must be an absolute public path starting with /");
    } else {
      const coverPath = path.resolve(publicDir, data.cover.replace(/^\/+/, ""));
      if (!coverPath.startsWith(publicDir) || !(await exists(coverPath))) {
        errors.push(`cover image does not exist: ${data.cover}`);
      }
    }
  } else if (data.cover !== undefined && typeof data.cover !== "string") {
    errors.push("cover must be a string");
  } else if (data.draft !== true) {
    warnings.push("published posts should include a cover image");
  }

  return {
    errors: errors.map((error) => `${fileName}: ${error}`),
    warnings: warnings.map((warning) => `${fileName}: ${warning}`)
  };
};

const main = async () => {
  const entries = await fs.readdir(blogDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
    .map((entry) => entry.name);

  const errors: string[] = [];
  const warnings: string[] = [];
  const slugs = new Map<string, string>();

  for (const file of files) {
    const fullPath = path.join(blogDir, file);
    const source = await fs.readFile(fullPath, "utf8");
    const parsed = matter(source);
    const result = await validatePost(file, parsed.data);
    errors.push(...result.errors);
    warnings.push(...result.warnings);

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

  if (warnings.length > 0) {
    console.warn(`Post check passed with ${warnings.length} warning(s):`);
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  console.log(`Post check passed (${files.length} post${files.length === 1 ? "" : "s"}).`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
