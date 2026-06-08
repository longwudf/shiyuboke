import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

const args = process.argv.slice(2);
const typeIndex = args.findIndex((arg) => arg === "--type" || arg.startsWith("--type="));
const templateType = typeIndex >= 0
  ? args[typeIndex].startsWith("--type=")
    ? args[typeIndex].split("=")[1]
    : args[typeIndex + 1]
  : "note";
if (typeIndex >= 0) {
  args.splice(typeIndex, args[typeIndex].startsWith("--type=") ? 1 : 2);
}
const title = args.join(" ").trim();

if (!title) {
  console.error("Usage: npm run new:post -- [--type note|tutorial|review|debug] 文章标题");
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
const templates: Record<string, string> = {
  note: `
## 背景

从这里开始写正文。

## 记录

## 小结
`,
  tutorial: `
## 目标

## 准备

## 步骤

## 常见问题

## 小结
`,
  review: `
## 项目背景

## 技术栈

## 关键实现

## 复盘
`,
  debug: `
## 现象

## 排查过程

## 根因

## 修复

## 预防
`
};
const body = templates[templateType] ?? templates.note;

const content = matter.stringify(body, {
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
