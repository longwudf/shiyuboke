import type { CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

export const sortPosts = (posts: BlogPost[]) =>
  posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

export const filterPublished = (posts: BlogPost[]) =>
  posts.filter((post) => !post.data.draft);

export const getReadingTime = (body = "") => {
  const words = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<[^>]+>/g, "")
    .trim()
    .split(/\s+/u)
    .filter(Boolean).length;
  const cjkChars = (body.match(/[\u4e00-\u9fff]/gu) ?? []).length;
  const minutes = Math.max(1, Math.ceil(Math.max(words, cjkChars / 350)));
  return `${minutes} 分钟阅读`;
};

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);

export const uniqueValues = (values: string[]) =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-CN"));
