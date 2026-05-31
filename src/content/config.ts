import { defineCollection, z } from "astro:content";

const blog = defineCollection({
  type: "content",
  schema: () =>
    z.object({
      title: z.string(),
      description: z.string(),
      date: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      category: z.string(),
      cover: z.string().optional(),
      draft: z.boolean().default(false),
      featured: z.boolean().default(false)
    })
});

export const collections = { blog };
