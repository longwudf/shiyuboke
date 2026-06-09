---
title: "把 Astro 博客部署到 GitHub Pages"
description: "介绍 Astro 静态输出、base 路径和 GitHub Actions Pages 部署工作流的关键配置。"
date: 2026-05-10
updatedDate: 2026-05-21
tags: ["GitHub Pages", "CI", "部署"]
category: "部署"
cover: "/images/github-pages-deploy.svg"
draft: false
featured: false
---

## 静态输出

GitHub Pages 托管的是静态文件，因此 Astro 项目需要使用静态输出。默认情况下 Astro 就能生成静态产物，配置里显式写出 `output: "static"` 可以让部署目标更清楚。

```js
export default defineConfig({
  output: "static"
});
```

构建完成后，站点文件会出现在 `dist` 目录，GitHub Actions 会把这个目录上传为 Pages artifact。

## site 和 base

如果仓库是 `longwudf.github.io`，站点根路径就是 `https://longwudf.github.io`。如果仓库是项目仓库，例如 `boke`，访问路径通常是 `https://longwudf.github.io/boke`，这时需要配置 `base: "/boke"`。

路径配置会影响 CSS、脚本、RSS 和 sitemap 的链接生成。部署前一定要确认仓库名和 Pages 地址匹配。

## Actions 工作流

GitHub 官方的 Pages Action 可以完成构建、上传和部署。核心流程是：

1. 拉取代码。
2. 安装 Node 和依赖。
3. 执行 `npm run build`。
4. 上传 `dist`。
5. 部署到 GitHub Pages。

## 部署后的检查

第一次部署后建议检查首页、文章详情页、标签页、分类页、RSS 和 404 页面。如果使用项目仓库，还要特别确认刷新子页面不会出现资源路径错误。
