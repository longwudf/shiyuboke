import nowData from "./now.json";

export type NowCard = {
  title: string;
  description: string;
};

export type NowData = {
  title: string;
  label: string;
  description: string;
  intro: string;
  cards: NowCard[];
};

export const now = nowData as NowData;
