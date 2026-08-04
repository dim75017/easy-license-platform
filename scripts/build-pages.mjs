import { spawn } from "node:child_process";
import {
  cp,
  copyFile,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(projectRoot, "out");
const basePath = process.env.PAGES_BASE_PATH ?? "/easy-license-platform";
const textExtensions = new Set([".css", ".html", ".js", ".json", ".txt", ".webmanifest", ".xml"]);

if (!/^\/[A-Za-z0-9._-]+$/.test(basePath)) {
  throw new Error(`Invalid PAGES_BASE_PATH: ${basePath}`);
}
if (!outDir.startsWith(`${projectRoot}${sep}`)) {
  throw new Error("Pages build paths escaped the project root.");
}

function run(command, args, options) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { ...options, stdio: "inherit" });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Pages build exited with ${code ?? signal}.`));
    });
  });
}

async function textFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await textFiles(path)));
    else if (textExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

async function prefixPublicAssets() {
  for (const path of await textFiles(outDir)) {
    const source = await readFile(path, "utf8");
    const updated = source
      .replaceAll("/fonts/", `${basePath}/fonts/`)
      .replaceAll("/artists/", `${basePath}/artists/`)
      .replaceAll("/images/", `${basePath}/images/`);
    if (updated !== source) await writeFile(path, updated);
  }

  await writeFile(join(outDir, ".nojekyll"), "");
  await copyFile(join(outDir, "index.html"), join(outDir, "404.html"));
}

const temporaryRoot = await mkdtemp(join(projectRoot, ".pages-staging-"));
const buildRoot = join(temporaryRoot, "source");
const excludedTopLevel = new Set([
  ".git",
  ".next",
  ".vinext",
  ".wrangler",
  "dist",
  "node_modules",
  "out",
  "outputs",
  "work",
]);

try {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(buildRoot);

  for (const entry of await readdir(projectRoot, { withFileTypes: true })) {
    if (excludedTopLevel.has(entry.name) || entry.name.startsWith(".pages-staging-")) continue;

    const source = join(projectRoot, entry.name);
    const destination = join(buildRoot, entry.name);
    await cp(source, destination, {
      recursive: entry.isDirectory(),
      filter: (path) => {
        const projectPath = relative(projectRoot, path);
        return projectPath !== join("app", "api") && !projectPath.startsWith(`${join("app", "api")}${sep}`);
      },
    });
  }

  await run(
    process.execPath,
    [join(projectRoot, "node_modules", "next", "dist", "bin", "next"), "build", buildRoot],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        BUILD_TARGET: "pages",
        NEXT_PUBLIC_STATIC_DEMO: "true",
        PAGES_BASE_PATH: basePath,
      },
    },
  );
  await cp(join(buildRoot, "out"), outDir, { recursive: true });
  await prefixPublicAssets();
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
