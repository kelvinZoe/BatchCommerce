import { spawnSync } from "node:child_process";
import { renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, "..");
const repositoryRoot = path.resolve(webRoot, "..");
const destination = path.join(webRoot, "src/lib/supabase/database.types.ts");
const temporaryDestination = `${destination}.tmp`;

const result = spawnSync(
  "supabase",
  ["gen", "types", "--linked", "--lang=typescript", "--schema", "public", "--workdir", repositoryRoot],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024
  }
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  throw new Error(result.stderr || "Supabase type generation failed.");
}

if (!result.stdout.includes("export type Database")) {
  throw new Error("Supabase returned an invalid TypeScript schema contract.");
}

try {
  writeFileSync(temporaryDestination, result.stdout, "utf8");
  renameSync(temporaryDestination, destination);
} finally {
  rmSync(temporaryDestination, { force: true });
}

console.log(`Generated ${path.relative(repositoryRoot, destination)} from the linked Supabase project.`);
