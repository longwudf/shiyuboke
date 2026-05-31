import { getCollection } from "astro:content";
import { filterPublished, formatDate, getReadingTime, sortPosts } from "@/utils/posts";
import { withBase } from "@/utils/url";

const normalizeText = (value: string) =>
  value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[#>*_`[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export async function GET() {
  const posts = sortPosts(filterPublished(await getCollection("blog")));

  const items = posts.map((post) => {
    const searchable = normalizeText(
      [
        post.data.title,
        post.data.description,
        post.data.category,
        ...post.data.tags,
        post.body
      ].join(" ")
    );

    return {
      title: post.data.title,
      description: post.data.description,
      category: post.data.category,
      tags: post.data.tags,
      date: formatDate(post.data.date),
      readingTime: getReadingTime(post.body),
      url: withBase(`/blog/${post.slug}`),
      searchable
    };
  });

  return new Response(JSON.stringify(items), {
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
