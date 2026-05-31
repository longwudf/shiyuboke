import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { filterPublished, sortPosts } from "@/utils/posts";
import { withBase } from "@/utils/url";

export async function GET(context: { site: URL }) {
  const posts = sortPosts(filterPublished(await getCollection("blog")));

  return rss({
    title: "Longwu.dev",
    description: "Astro、TypeScript 与前端工程化技术文章。",
    site: new URL(withBase("/"), context.site),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: withBase(`/blog/${post.slug}`)
    }))
  });
}
