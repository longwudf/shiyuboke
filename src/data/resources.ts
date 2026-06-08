import resourcesData from "./resources.json";

export type ResourceItem = {
  name: string;
  description: string;
  href: string;
};

export type ResourceGroup = {
  title: string;
  items: ResourceItem[];
};

export type ResourcesData = {
  title: string;
  description: string;
  intro: string;
  groups: ResourceGroup[];
};

export const resources = resourcesData as ResourcesData;
