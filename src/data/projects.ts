import projectsData from "./projects.json";

export type Project = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  stack: string[];
  highlights: string[];
  links: Array<{
    label: string;
    href: string;
  }>;
};

export const projects = projectsData as Project[];
