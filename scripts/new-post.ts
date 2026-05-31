import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const title = process.argv.slice(2).join(" ").trim();

if (!title) {
  console.error("Usage: npm run new:post -- 文章标题");
  process.exit(1);
}

const root = process.cwd();
const blogDir = path.join(root, "src", "content", "blog");

const today = new Date().toISOString().slice(0, 10);
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "untitled";

const fileName = `${today}-${slugify(title)}.md`;
const filePath = path.join(blogDir, fileName);

const content = matter.stringify("\n从这里开始写正文。\n", {
  title,
  description: "请填写文章描述",
  date: today,
  updatedDate: today,
  category: "未分类",
  tags: [],
  cover: "",
  draft: true,
  featured: false
});

try {
  await fs.mkdir(blogDir, { recursive: true });
  await fs.writeFile(filePath, content, { flag: "wx" });
  console.log(`Created ${path.relative(root, filePath)}`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code === "EEXIST") {
    console.error(`Post already exists: ${path.relative(root, filePath)}`);
    process.exit(1);
  }
  throw error;
}
