import { getCollection } from "astro:content";
import { filterPublished, formatDate, getReadingStats, sortPosts } from "@/utils/posts";
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
    const titleText = normalizeText(post.data.title);
    const descriptionText = normalizeText(post.data.description);
    const categoryText = normalizeText(post.data.category);
    const tagText = normalizeText(post.data.tags.join(" "));
    const bodyText = normalizeText(post.body);
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
      updatedDate: post.data.updatedDate ? formatDate(post.data.updatedDate) : undefined,
      readingTime: getReadingStats(post.body).label,
      cover: post.data.cover ? withBase(post.data.cover) : undefined,
      url: withBase(`/blog/${post.slug}`),
      searchable,
      titleText,
      descriptionText,
      categoryText,
      tagText,
      bodyText
    };
  });

  return new Response(JSON.stringify(items), {
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}
