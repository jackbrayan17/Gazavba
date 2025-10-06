import { ColorSchemeName } from "react-native";

export const palette = {
  primary: "#0C3B2E",
  accent:  "#1F6B4F",
  mint:    "#6CC16C",
  amber:   "#F3C323",
  bgLight: "#F7F7F7",
  bgDark:  "#0F1115",
  text:    "#111111",
  subtext: "#77838F",
  bubbleMe:   "#DCF8C6",
  bubbleThem: "#FFFFFF"
};

export type Theme = {
  bg: string; card: string; text: string; subtext: string;
  primary: string; accent: string; mint: string; amber: string;
  hairline: string; bubbleMe: string; bubbleThem: string;
  tabActive: string; tabInactive: string;
};

export const getTheme = (scheme: ColorSchemeName): Theme => {
  const dark = scheme === "dark";
  return {
    bg: dark ? palette.bgDark : "#FFFFFF",
    card: dark ? "#171A20" : "#FFFFFF",
    text: dark ? "#EDEDED" : palette.text,
    subtext: dark ? "#A9B2BD" : palette.subtext,
    primary: palette.primary,
    accent: palette.accent,
    mint: palette.mint,
    amber: palette.amber,
    hairline: dark ? "#22262E" : "#E9ECEF",
    bubbleMe: dark ? "#214C38" : palette.bubbleMe,
    bubbleThem: dark ? "#1A1E25" : "#FFFFFF",
    tabActive: palette.mint,
    tabInactive: dark ? "#9AA4AE" : palette.subtext
  };
};
