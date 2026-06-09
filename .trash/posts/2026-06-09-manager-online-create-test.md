---
title: 管理器线上发布测试：新增文章
description: 这是一篇用于验证诗余博客本地管理器新增文章、提交推送和 GitHub Pages 部署链路的测试文章。
date: '2026-06-09'
updatedDate: '2026-06-09'
category: 测试
tags:
  - 测试
  - 管理器
  - GitHub Pages
cover: /images/security-watch-cover.svg
draft: false
featured: false
series: 管理器测试
seriesOrder: 1
---
## 测试目标

这篇文章用于验证新增文章可以通过本地管理器写入源文件，并在推送后由 GitHub Actions 部署到 GitHub Pages。

## 验收点

- 文章出现在文章列表。
- 文章详情页可访问。
- Giscus 评论脚本仍然随文章页渲染。
