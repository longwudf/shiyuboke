import aboutData from "./about.json";

export type AboutData = {
  title: string;
  description: string;
  paragraphs: string[];
};

export const about = aboutData as AboutData;
