import { convexTest } from "convex-test";
import schema from "../convex/schema";

const modules = import.meta.glob("../convex/**/*.{js,ts}");

export function createTestBackend() {
  return convexTest(schema, modules);
}
