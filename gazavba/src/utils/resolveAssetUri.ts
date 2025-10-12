import { getSocketBaseUrl } from "../services/api";

export const resolveAssetUri = (value?: string | null) => {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const base = getSocketBaseUrl();
  if (!value.startsWith("/")) {
    return `${base}/${value}`;
  }
  return `${base}${value}`;
};
