import express from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import matter from "gray-matter";
import { createServer as createViteServer } from "vite";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const blogDir = path.join(root, "src", "content", "blog");
const imageDir = path.join(root, "public", "images", "blog");
const trashDir = path.join(root, ".trash", "posts");
const allowedImageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);

type PostPayload = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  date?: string;
  updatedDate?: string;
  category?: string;
  tags?: string[];
  cover?: string;
  draft?: boolean;
  featured?: boolean;
  body?: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";

const stripDatePrefix = (slug: string) => slug.replace(/^\d{4}-\d{2}-\d{2}-/, "");
const datePrefix = (fileName: string) => fileName.match(/^(\d{4}-\d{2}-\d{2})-/)?.[1];

const ensureDir = async () => {
  await fs.mkdir(blogDir, { recursive: true });
  await fs.mkdir(imageDir, { recursive: true });
  await fs.mkdir(trashDir, { recursive: true });
};

const assertWithin = (target: string, base: string) => {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error("Unsafe path access blocked");
  }
  return resolvedTarget;
};

const assertSafeId = (id: string) => {
  if (!/^[^\\/]+\.(md|mdx)$/i.test(id) || id.includes("..")) {
    throw new Error("Invalid post id");
  }
  return id;
};

const postPath = (id: string) => assertWithin(path.join(blogDir, assertSafeId(id)), blogDir);

const isValidDate = (value: unknown) => {
  if (typeof value !== "string") return false;
  return Number.isFinite(new Date(value).valueOf());
};

const normalizePost = (payload: PostPayload, existingId?: string) => {
  const date = payload.date || today();
  const slug = slugify(payload.slug || payload.title || "untitled");
  return {
    slug,
    title: payload.title?.trim() ?? "",
    description: payload.description?.trim() ?? "",
    date,
    updatedDate: today(),
    category: payload.category?.trim() || "未分类",
    tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    cover: payload.cover?.trim() ?? "",
    draft: Boolean(payload.draft),
    featured: Boolean(payload.featured),
    body: payload.body ?? "",
    ext: existingId?.toLowerCase().endsWith(".mdx") ? ".mdx" : ".md"
  };
};

const validatePost = (post: ReturnType<typeof normalizePost>) => {
  const errors: string[] = [];
  if (!post.title) errors.push("title is required");
  if (!post.description) errors.push("description is required");
  if (!isValidDate(post.date)) errors.push("date must be valid");
  if (!isValidDate(post.updatedDate)) errors.push("updatedDate must be valid");
  if (!post.category) errors.push("category is required");
  if (!Array.isArray(post.tags)) errors.push("tags must be an array");
  if (typeof post.draft !== "boolean") errors.push("draft must be boolean");
  if (typeof post.featured !== "boolean") errors.push("featured must be boolean");
  if (errors.length) throw new Error(errors.join("; "));
};

const fileNameForPost = (post: ReturnType<typeof normalizePost>, existingId?: string) => {
  const prefix = datePrefix(existingId ?? "") || post.date.slice(0, 10);
  return `${prefix}-${post.slug}${post.ext}`;
};

const uniquePath = async (directory: string, fileName: string) => {
  const parsed = path.parse(fileName);
  let candidate = assertWithin(path.join(directory, fileName), directory);
  if (!existsSync(candidate)) return candidate;
  candidate = assertWithin(path.join(directory, `${parsed.name}-${Date.now()}${parsed.ext}`), directory);
  return candidate;
};

const readPost = async (id: string) => {
  const source = await fs.readFile(postPath(id), "utf8");
  const parsed = matter(source);
  const slug = stripDatePrefix(id.replace(/\.(md|mdx)$/i, ""));
  return {
    id,
    slug,
    fileName: id,
    title: parsed.data.title ?? "",
    description: parsed.data.description ?? "",
    date: parsed.data.date ? new Date(parsed.data.date).toISOString().slice(0, 10) : "",
    updatedDate: parsed.data.updatedDate ? new Date(parsed.data.updatedDate).toISOString().slice(0, 10) : "",
    category: parsed.data.category ?? "未分类",
    tags: Array.isArray(parsed.data.tags) ? parsed.data.tags : [],
    cover: parsed.data.cover ?? "",
    draft: Boolean(parsed.data.draft),
    featured: Boolean(parsed.data.featured),
    body: parsed.content.trimStart()
  };
};

const writePost = async (payload: PostPayload, existingId?: string) => {
  const post = normalizePost(payload, existingId);
  validatePost(post);

  const targetName = fileNameForPost(post, existingId);
  const targetPath = postPath(targetName);
  const currentPath = existingId ? postPath(existingId) : undefined;
  const content = matter.stringify(`${post.body.trim()}\n`, {
    title: post.title,
    description: post.description,
    date: post.date,
    updatedDate: post.updatedDate,
    category: post.category,
    tags: post.tags,
    cover: post.cover,
    draft: post.draft,
    featured: post.featured
  });

  if (!existingId && existsSync(targetPath)) throw new Error(`Post already exists: ${targetName}`);
  if (existingId && targetName !== existingId && existsSync(targetPath)) throw new Error(`Target post already exists: ${targetName}`);

  await fs.writeFile(targetPath, content, "utf8");
  if (currentPath && targetPath !== currentPath) await fs.unlink(currentPath);
  return readPost(targetName);
};

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(express.json({ limit: "2mb" }));

app.get("/api/posts", async (_request, response) => {
  try {
    await ensureDir();
    const entries = await fs.readdir(blogDir, { withFileTypes: true });
    const posts = await Promise.all(
      entries
        .filter((entry) => entry.isFile() && /\.(md|mdx)$/i.test(entry.name))
        .map((entry) => readPost(entry.name))
    );
    posts.sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
    response.json({ posts });
  } catch (error) {
    response.status(500).json({ error: (error as Error).message });
  }
});

app.get("/api/posts/:id", async (request, response) => {
  try {
    response.json(await readPost(request.params.id));
  } catch (error) {
    response.status(404).json({ error: (error as Error).message });
  }
});

app.post("/api/posts", async (request, response) => {
  try {
    await ensureDir();
    const saved = await writePost({ ...request.body, draft: true, featured: Boolean(request.body.featured) });
    response.status(201).json(saved);
  } catch (error) {
    response.status(400).json({ error: (error as Error).message });
  }
});

app.put("/api/posts/:id", async (request, response) => {
  try {
    const saved = await writePost(request.body, request.params.id);
    response.json(saved);
  } catch (error) {
    response.status(400).json({ error: (error as Error).message });
  }
});

app.delete("/api/posts/:id", async (request, response) => {
  try {
    await ensureDir();
    const source = postPath(request.params.id);
    const target = await uniquePath(trashDir, request.params.id);
    await fs.rename(source, target);
    response.json({ ok: true });
  } catch (error) {
    response.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/posts/:id/publish", async (request, response) => {
  try {
    const post = await readPost(request.params.id);
    response.json(await writePost({ ...post, draft: false }, request.params.id));
  } catch (error) {
    response.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/posts/:id/unpublish", async (request, response) => {
  try {
    const post = await readPost(request.params.id);
    response.json(await writePost({ ...post, draft: true }, request.params.id));
  } catch (error) {
    response.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/images", upload.single("image"), async (request, response) => {
  try {
    await ensureDir();
    if (!request.file) throw new Error("No image uploaded");
    const ext = path.extname(request.file.originalname).toLowerCase();
    if (!allowedImageExts.has(ext)) throw new Error("Unsupported image type");
    const safeBase = slugify(path.basename(request.file.originalname, ext));
    const target = await uniquePath(imageDir, `${safeBase}${ext}`);
    await fs.writeFile(target, request.file.buffer);
    response.json({ path: `/images/blog/${path.basename(target)}` });
  } catch (error) {
    response.status(400).json({ error: (error as Error).message });
  }
});

app.post("/api/git/push", async (_request, response) => {
  try {
    const status = await execFileAsync("git", ["status", "--porcelain"], { cwd: root });
    if (!status.stdout.trim()) {
      response.json({ message: "当前没有可提交的文章变更。", output: "" });
      return;
    }
    await execFileAsync("git", ["add", "src/content/blog", "public/images/blog", ".trash"], { cwd: root });
    const staged = await execFileAsync("git", ["diff", "--cached", "--name-only"], { cwd: root });
    if (!staged.stdout.trim()) {
      response.json({ message: "没有文章、图片或回收站变更需要提交。", output: status.stdout });
      return;
    }
    const commit = await execFileAsync("git", ["commit", "-m", "Update blog posts"], { cwd: root });
    const push = await execFileAsync("git", ["push"], { cwd: root });
    response.json({ message: "已提交并推送。", output: `${commit.stdout}\n${push.stdout}` });
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    response.status(500).json({ error: `${err.message}\n${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim() });
  }
});

const vite = await createViteServer({
  configFile: path.join(root, "tools", "article-manager", "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "spa"
});

app.use(vite.middlewares);

const port = Number(process.env.MANAGER_PORT ?? 5174);
app.listen(port, "127.0.0.1", () => {
  console.log(`Article manager running at http://127.0.0.1:${port}`);
});
