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
const publicDir = path.join(root, "public");
const imageDir = path.join(publicDir, "images", "blog");
const trashDir = path.join(root, ".trash", "posts");
const allowedImageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"]);
const managedGitPaths = ["src/content/blog", "public/images", "src/data", ".trash"];

const contentFiles = {
  site: path.join(root, "src", "data", "site.json"),
  projects: path.join(root, "src", "data", "projects.json"),
  friends: path.join(root, "src", "data", "friends.json"),
  resources: path.join(root, "src", "data", "resources.json"),
  about: path.join(root, "src", "data", "about.json"),
  now: path.join(root, "src", "data", "now.json")
} as const;

const shiyuBlog = {
  siteName: "诗余博客",
  repository: "longwudf/shiyuboke",
  repositoryUrl: "https://github.com/longwudf/shiyuboke",
  remoteUrl: "https://github.com/longwudf/shiyuboke.git",
  sshRemoteUrl: "git@github.com:longwudf/shiyuboke.git",
  pagesUrl: "https://longwudf.github.io/shiyuboke/",
  homepageUrl: "https://longwudf.github.io/shiyuboke/",
  actionsUrl: "https://github.com/longwudf/shiyuboke/actions",
  latestSuccessfulRunUrl: "https://github.com/longwudf/shiyuboke/actions/runs/27163867016",
  defaultBranch: "main",
  pagesStatus: "deployed",
  discussionsEnabled: true,
  giscus: {
    repo: "longwudf/shiyuboke",
    repoId: "R_kgDOShwURA",
    category: "Announcements",
    categoryId: "DIC_kwDOShwURM4C-xk0"
  }
} as const;

type ContentKey = keyof typeof contentFiles;

type PostPayload = {
  id?: string;
  slug?: string;
  title?: string;
  description?: string;
  date?: string;
  updatedDate?: string;
  category?: string;
  tags?: string[];
  series?: string;
  seriesOrder?: number | string | null;
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

const toPositiveInteger = (value: PostPayload["seriesOrder"]) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : Number.NaN;
};

const normalizePost = (payload: PostPayload, existingId?: string) => {
  const date = payload.date || today();
  const seriesOrder = toPositiveInteger(payload.seriesOrder);
  const slug = slugify(payload.slug || payload.title || "untitled");
  return {
    slug,
    title: payload.title?.trim() ?? "",
    description: payload.description?.trim() ?? "",
    date,
    updatedDate: payload.updatedDate || today(),
    category: payload.category?.trim() || "未分类",
    tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    series: payload.series?.trim() || "",
    seriesOrder,
    cover: payload.cover?.trim() ?? "",
    draft: Boolean(payload.draft),
    featured: Boolean(payload.featured),
    body: payload.body ?? "",
    ext: existingId?.toLowerCase().endsWith(".mdx") ? ".mdx" : ".md"
  };
};

const validatePost = (post: ReturnType<typeof normalizePost>) => {
  const errors: string[] = [];
  const normalizedTags = post.tags.map((tag) => tag.toLowerCase());
  if (!post.title) errors.push("title is required");
  if (!post.description) errors.push("description is required");
  if (!isValidDate(post.date)) errors.push("date must be valid");
  if (!isValidDate(post.updatedDate)) errors.push("updatedDate must be valid");
  if (new Date(post.updatedDate).valueOf() < new Date(post.date).valueOf()) errors.push("updatedDate cannot be earlier than date");
  if (!post.category) errors.push("category is required");
  if (!Array.isArray(post.tags)) errors.push("tags must be an array");
  if (new Set(normalizedTags).size !== normalizedTags.length) errors.push("tags must be unique");
  if (typeof post.draft !== "boolean") errors.push("draft must be boolean");
  if (typeof post.featured !== "boolean") errors.push("featured must be boolean");
  if (Number.isNaN(post.seriesOrder)) errors.push("seriesOrder must be a positive integer");
  if (post.seriesOrder !== undefined && !post.series) errors.push("series is required when seriesOrder is set");
  if (post.cover && !post.cover.startsWith("/")) errors.push("cover must start with /");
  if (errors.length) throw new Error(errors.join("; "));
};

const fileNameForPost = (post: ReturnType<typeof normalizePost>, existingId?: string) => {
  if (existingId && !datePrefix(existingId)) return `${post.slug}${post.ext}`;
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
    series: typeof parsed.data.series === "string" ? parsed.data.series : "",
    seriesOrder: Number.isInteger(parsed.data.seriesOrder) ? parsed.data.seriesOrder : undefined,
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
  const frontmatter: Record<string, unknown> = {
    title: post.title,
    description: post.description,
    date: post.date,
    updatedDate: post.updatedDate,
    category: post.category,
    tags: post.tags,
    cover: post.cover,
    draft: post.draft,
    featured: post.featured
  };

  if (post.series) frontmatter.series = post.series;
  if (post.seriesOrder !== undefined) frontmatter.seriesOrder = post.seriesOrder;

  const content = matter.stringify(`${post.body.trim()}\n`, frontmatter);

  if (!existingId && existsSync(targetPath)) throw new Error(`Post already exists: ${targetName}`);
  if (existingId && targetName !== existingId && existsSync(targetPath)) throw new Error(`Target post already exists: ${targetName}`);

  await fs.writeFile(targetPath, content, "utf8");
  if (currentPath && targetPath !== currentPath) await fs.unlink(currentPath);
  return readPost(targetName);
};

const safeContentKey = (key: string): ContentKey => {
  if (!(key in contentFiles)) throw new Error("Unknown content key");
  return key as ContentKey;
};

const contentPath = (key: ContentKey) => assertWithin(contentFiles[key], path.join(root, "src", "data"));

const readJsonContent = async (key: ContentKey) => {
  const source = await fs.readFile(contentPath(key), "utf8");
  return JSON.parse(source) as unknown;
};

const writeJsonContent = async (key: ContentKey, value: unknown) => {
  if (typeof value !== "object" || value === null) throw new Error("Content payload must be an object or array");
  await fs.writeFile(contentPath(key), `${JSON.stringify(value, null, 2)}\n`, "utf8");
  return readJsonContent(key);
};

const stringValue = (value: unknown, fallback: string) => (typeof value === "string" && value.trim() ? value.trim() : fallback);

const getManagerContext = async () => {
  try {
    const site = await readJsonContent("site") as {
      brand?: { name?: unknown };
      deployment?: Record<string, unknown>;
      comments?: { giscus?: Record<string, unknown> };
    };
    const deployment = site.deployment ?? {};
    const giscus = site.comments?.giscus ?? {};

    return {
      siteName: stringValue(site.brand?.name, shiyuBlog.siteName),
      repository: stringValue(deployment.repository, shiyuBlog.repository),
      repositoryUrl: stringValue(deployment.repositoryUrl, shiyuBlog.repositoryUrl),
      remoteUrl: stringValue(deployment.remoteUrl, shiyuBlog.remoteUrl),
      sshRemoteUrl: stringValue(deployment.sshRemoteUrl, shiyuBlog.sshRemoteUrl),
      pagesUrl: stringValue(deployment.pagesUrl, shiyuBlog.pagesUrl),
      homepageUrl: stringValue(deployment.homepageUrl, shiyuBlog.homepageUrl),
      actionsUrl: stringValue(deployment.actionsUrl, shiyuBlog.actionsUrl),
      latestSuccessfulRunUrl: stringValue(deployment.latestSuccessfulRunUrl, shiyuBlog.latestSuccessfulRunUrl),
      defaultBranch: stringValue(deployment.defaultBranch, shiyuBlog.defaultBranch),
      pagesStatus: stringValue(deployment.pagesStatus, shiyuBlog.pagesStatus),
      discussionsEnabled: typeof deployment.discussionsEnabled === "boolean" ? deployment.discussionsEnabled : shiyuBlog.discussionsEnabled,
      giscus: {
        repo: stringValue(giscus.repo, shiyuBlog.giscus.repo),
        repoId: stringValue(giscus.repoId, shiyuBlog.giscus.repoId),
        category: stringValue(giscus.category, shiyuBlog.giscus.category),
        categoryId: stringValue(giscus.categoryId, shiyuBlog.giscus.categoryId)
      }
    };
  } catch {
    return shiyuBlog;
  }
};

const resolveCommand = (command: string, args: string[]) => {
  if (command !== "npm") return { executable: command, args };

  const npmExecPath =
    process.env.npm_execpath ||
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  if (!existsSync(npmExecPath)) throw new Error("Unable to locate npm CLI");

  return {
    executable: process.execPath,
    args: [npmExecPath, ...args]
  };
};

const runCommand = async (command: string, args: string[]) => {
  const resolved = resolveCommand(command, args);
  const result = await execFileAsync(resolved.executable, resolved.args, { cwd: root, windowsHide: true, maxBuffer: 1024 * 1024 * 8 });
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
  };
};

const runCommandJson = async (command: string, args: string[]) => {
  try {
    const result = await runCommand(command, args);
    return { ok: true, ...result };
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    return {
      ok: false,
      error: `${err.message}\n${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim(),
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? ""
    };
  }
};

const isGitRepo = async () => {
  const result = await runCommandJson("git", ["rev-parse", "--is-inside-work-tree"]);
  return result.ok && result.stdout.trim() === "true";
};

const normalizeRemote = (remote: string) =>
  remote
    .trim()
    .replace(/^git@github\.com:/, "https://github.com/")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");

const remoteMatchesShiyuBlog = (remote: string, context: { remoteUrl: string; sshRemoteUrl: string }) =>
  [context.remoteUrl, context.sshRemoteUrl].map(normalizeRemote).includes(normalizeRemote(remote));

const parseAheadBehind = (value: string) => {
  const [ahead = "0", behind = "0"] = value.trim().split(/\s+/);
  return {
    ahead: Number.parseInt(ahead, 10) || 0,
    behind: Number.parseInt(behind, 10) || 0
  };
};

const getGitStatus = async () => {
  const managerContext = await getManagerContext();
  const repo = await isGitRepo();
  if (!repo) {
    return {
      isRepo: false,
      branch: managerContext.defaultBranch,
      remote: "",
      hasRemote: false,
      expectedRemote: managerContext.remoteUrl,
      sshRemote: managerContext.sshRemoteUrl,
      remoteMatches: false,
      changes: [],
      clean: true,
      ahead: 0,
      behind: 0,
      upstream: "",
      hasUpstream: false,
      needsSetup: true
    };
  }

  const [branchResult, remoteResult, statusResult] = await Promise.all([
    runCommandJson("git", ["rev-parse", "--abbrev-ref", "HEAD"]),
    runCommandJson("git", ["remote", "get-url", "origin"]),
    runCommandJson("git", ["status", "--porcelain"])
  ]);
  const changes = statusResult.stdout.split(/\r?\n/).filter(Boolean);
  const remote = remoteResult.ok ? remoteResult.stdout.trim() : "";
  const branch = branchResult.ok ? branchResult.stdout.trim() : "";
  const upstreamResult = await runCommandJson("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const upstream = upstreamResult.ok ? upstreamResult.stdout.trim() : "";
  const comparisonRef = upstream || (branch ? `origin/${branch}` : "");
  const syncResult = comparisonRef
    ? await runCommandJson("git", ["rev-list", "--left-right", "--count", `HEAD...${comparisonRef}`])
    : { ok: false, stdout: "" };
  const sync = syncResult.ok ? parseAheadBehind(syncResult.stdout) : { ahead: 0, behind: 0 };

  return {
    isRepo: true,
    branch,
    remote,
    hasRemote: Boolean(remote),
    expectedRemote: managerContext.remoteUrl,
    sshRemote: managerContext.sshRemoteUrl,
    remoteMatches: remoteMatchesShiyuBlog(remote, managerContext),
    changes,
    clean: changes.length === 0,
    ahead: sync.ahead,
    behind: sync.behind,
    upstream,
    hasUpstream: Boolean(upstream),
    needsSetup: !remote
  };
};

const listImages = async () => {
  const base = path.join(publicDir, "images");
  const results: Array<{ name: string; path: string; size: number; modified: string }> = [];

  const walk = async (directory: string) => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = assertWithin(path.join(directory, entry.name), base);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (!allowedImageExts.has(path.extname(entry.name).toLowerCase())) continue;
      const stat = await fs.stat(fullPath);
      const publicPath = `/${path.relative(publicDir, fullPath).replace(/\\/g, "/")}`;
      results.push({
        name: entry.name,
        path: publicPath,
        size: stat.size,
        modified: stat.mtime.toISOString()
      });
    }
  };

  if (existsSync(base)) await walk(base);
  return results.sort((a, b) => b.modified.localeCompare(a.modified));
};

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

app.use(express.json({ limit: "4mb" }));
app.use("/images", express.static(path.join(publicDir, "images")));

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

app.get("/api/content/:key", async (request, response) => {
  try {
    const key = safeContentKey(request.params.key);
    response.json({ key, content: await readJsonContent(key) });
  } catch (error) {
    response.status(404).json({ error: (error as Error).message });
  }
});

app.put("/api/content/:key", async (request, response) => {
  try {
    const key = safeContentKey(request.params.key);
    response.json({ key, content: await writeJsonContent(key, request.body) });
  } catch (error) {
    response.status(400).json({ error: (error as Error).message });
  }
});

app.get("/api/images", async (_request, response) => {
  try {
    response.json({ images: await listImages() });
  } catch (error) {
    response.status(500).json({ error: (error as Error).message });
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

app.post("/api/checks/:name", async (request, response) => {
  const checks = {
    posts: ["npm", ["run", "check:posts"]],
    images: ["npm", ["run", "check:images"]],
    astro: ["npm", ["run", "check"]],
    build: ["npm", ["run", "build"]]
  } as const;
  const name = request.params.name as keyof typeof checks;
  const check = checks[name];
  if (!check) {
    response.status(404).json({ error: "Unknown check" });
    return;
  }

  const result = await runCommandJson(check[0], [...check[1]]);
  response.status(result.ok ? 200 : 500).json({ name, ...result });
});

app.get("/api/manager/context", async (_request, response) => {
  response.json(await getManagerContext());
});

app.get("/api/git/status", async (_request, response) => {
  try {
    response.json(await getGitStatus());
  } catch (error) {
    response.status(500).json({ error: (error as Error).message });
  }
});

app.post("/api/git/init", async (request, response) => {
  try {
    const managerContext = await getManagerContext();
    const branch = String(request.body?.branch || managerContext.defaultBranch).trim() || managerContext.defaultBranch;
    const remoteUrl = String(request.body?.remoteUrl || managerContext.remoteUrl).trim();
    if (!/^[A-Za-z0-9._/-]+$/.test(branch)) throw new Error("Invalid branch name");
    if (!remoteUrl) throw new Error("remoteUrl is required");

    if (!(await isGitRepo())) await runCommand("git", ["init"]);
    await runCommand("git", ["branch", "-M", branch]);
    const remote = await runCommandJson("git", ["remote", "get-url", "origin"]);
    await runCommand("git", remote.ok ? ["remote", "set-url", "origin", remoteUrl] : ["remote", "add", "origin", remoteUrl]);
    response.json({ message: `Git 仓库已初始化，origin 已指向 ${managerContext.repository}。`, status: await getGitStatus() });
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    response.status(400).json({ error: `${err.message}\n${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim() });
  }
});

app.post("/api/git/commit", async (request, response) => {
  try {
    if (!(await isGitRepo())) throw new Error("当前目录还不是 Git 仓库，请先初始化。");
    const firstCommit = Boolean(request.body?.firstCommit);
    const message = String(request.body?.message || (firstCommit ? "Initial site content" : "Update site content")).trim();
    if (!message) throw new Error("Commit message is required");

    await runCommand("git", firstCommit ? ["add", "."] : ["add", ...managedGitPaths]);
    const staged = await runCommand("git", ["diff", "--cached", "--name-only"]);
    if (!staged.stdout.trim()) {
      response.json({ message: "没有可提交的托管内容变更。", output: "" });
      return;
    }

    const commit = await runCommand("git", ["commit", "-m", message]);
    response.json({ message: "已创建提交。", output: commit.output });
  } catch (error) {
    const err = error as Error & { stdout?: string; stderr?: string };
    response.status(500).json({ error: `${err.message}\n${err.stdout ?? ""}\n${err.stderr ?? ""}`.trim() });
  }
});

app.post("/api/git/push", async (_request, response) => {
  try {
    const managerContext = await getManagerContext();
    const status = await getGitStatus();
    if (!status.isRepo) throw new Error("当前目录还不是 Git 仓库，请先初始化。");
    if (!status.hasRemote) throw new Error("未设置 origin remote。");
    const branch = status.branch || managerContext.defaultBranch;
    const upstream = await runCommandJson("git", ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
    const push = await runCommand("git", upstream.ok ? ["push"] : ["push", "-u", "origin", branch]);
    response.json({ message: "已推送到 GitHub。GitHub Actions 会继续构建并部署 GitHub Pages。", output: push.output });
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
const httpServer = app.listen(port, "127.0.0.1", () => {
  console.log(`Article manager running at http://127.0.0.1:${port}`);
});
const keepAlive = setInterval(() => undefined, 60_000);
httpServer.on("close", () => clearInterval(keepAlive));
