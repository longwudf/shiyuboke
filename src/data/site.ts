import siteData from "./site.json";

export type SiteLink = {
  href: string;
  label: string;
  external?: boolean;
  variant?: string;
};

export type SiteData = typeof siteData;

export const site = siteData;
export const brand = siteData.brand;
export const navItems = siteData.navigation;
export const footerLinks = siteData.footerLinks;
