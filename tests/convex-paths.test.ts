import { readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const validComponent = /^[A-Za-z0-9_.]+$/;

function invalidPaths(directory: string, components: string[] = []): string[] {
  const invalid: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "_generated") continue;
    const pathComponents = [...components, entry.name];
    if (!validComponent.test(entry.name)) invalid.push(pathComponents.join("/"));
    if (entry.isDirectory()) {
      invalid.push(...invalidPaths(join(directory, entry.name), pathComponents));
    }
  }
  return invalid;
}

it("uses only valid Convex path components outside _generated", () => {
  const root = fileURLToPath(new URL("../convex/", import.meta.url));
  expect(invalidPaths(root)).toEqual([]);
});
