---
title: 用 Astro 搭建静态技术博客
description: 从内容集合、布局组件到静态构建，梳理一个 Astro 博客的核心搭建路径。
date: '2026-05-20'
updatedDate: '2026-05-24'
category: Astro
tags:
  - Astro
  - 静态站点
  - Markdown
cover: /images/astro-static-blog.svg
draft: true
featured: true
---
## 为什么选择 Astro

Astro 很适合技术博客这类内容优先的网站。页面默认输出为静态 HTML，交互脚本按需加载，既保留了组件化开发体验，也避免了把整站变成不必要的客户端应用。

对博客来说，最重要的是三件事：内容管理清晰、构建产物稳定、部署流程简单。Astro 的内容集合可以为 Markdown 和 MDX 提供 frontmatter 校验，让文章元数据在构建阶段就被检查出来。

## 内容集合

博客文章放在 `src/content/blog`，每篇文章使用 frontmatter 描述标题、摘要、日期、分类、标签和是否精选。这样首页、列表页、标签页和 RSS 都能复用同一份结构化数据。

```ts
const posts = await getCollection("blog", ({ data }) => !data.draft);
```

过滤草稿应当发生在查询层，而不是等页面渲染时再判断。这样草稿不会进入任何静态路由、RSS 或 sitemap。

## 页面布局

一个稳定的博客通常需要两层布局：基础布局负责头部、页脚、SEO 和主题色；文章布局负责标题区、元信息、标签、目录和上一篇下一篇导航。

这种拆分能让普通页面保持轻量，也让文章详情页拥有更完整的阅读体验。

## 小结

Astro 的优势不是把事情变复杂，而是把静态内容站点的常见需求收束到一个很直接的开发模型里。对长期写作的人来说，这种稳定感非常重要。
