import friendsData from "./friends.json";

export type FriendLink = {
  name: string;
  description: string;
  href: string;
  avatar?: string;
  tags?: string[];
};

export type SiteProfile = {
  name: string;
  href: string;
  description: string;
  avatar?: string;
};

export const friends = friendsData.friends as FriendLink[];
export const siteProfile = friendsData.siteProfile as SiteProfile;
