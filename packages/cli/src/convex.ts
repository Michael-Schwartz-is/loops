import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = "https://greedy-flamingo-603.convex.cloud";

export function getConvexClient(): ConvexHttpClient {
  return new ConvexHttpClient(CONVEX_URL);
}
