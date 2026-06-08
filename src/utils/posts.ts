import type { CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

export const sortPosts = (posts: BlogPost[]) =>
  posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

export const filterPublished = (posts: BlogPost[]) =>
  posts.filter((post) => import.meta.env.DEV || !post.data.draft);

const numberFormatter = new Intl.NumberFormat("zh-CN");

export const getReadingStats = (body = "") => {
  const codeBlocks = body.match(/```[\s\S]*?```/g)?.length ?? 0;
  const text = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/^\s*(import|export)\s.+$/gm, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[#>*_`[\]{}()|~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const cjkChars = (text.match(/[\u3400-\u9fff]/gu) ?? []).length;
  const latinWords = (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) ?? []).length;
  const words = cjkChars + latinWords;
  const minutes = Math.max(1, Math.ceil(cjkChars / 350 + latinWords / 220 + codeBlocks * 0.35));
  const label = `约 ${minutes} 分钟 · ${numberFormatter.format(words)} 字`;

  return {
    minutes,
    words,
    cjkChars,
    latinWords,
    codeBlocks,
    label,
    detail: codeBlocks > 0 ? `${label} · ${codeBlocks} 段代码` : label
  };
};

export const getReadingTime = (body = "") => getReadingStats(body).label;

export const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);

export const uniqueValues = (values: string[]) =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "zh-CN"));
