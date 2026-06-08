import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { brand } from "@/data/site";
import { filterPublished, sortPosts } from "@/utils/posts";
import { withBase } from "@/utils/url";

export async function GET(context: { site: URL }) {
  const posts = sortPosts(filterPublished(await getCollection("blog")));

  return rss({
    title: brand.name,
    description: brand.description,
    site: new URL(withBase("/"), context.site),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: withBase(`/blog/${post.slug}`)
    }))
  });
}
