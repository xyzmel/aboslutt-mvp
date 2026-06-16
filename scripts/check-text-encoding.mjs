import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const roots = ["src", "prisma", "scripts"];
const extraFiles = ["README.md", "package.json"];
const allowedExtensions = new Set([
  ".css",
  ".json",
  ".md",
  ".mjs",
  ".prisma",
  ".sql",
  ".ts",
  ".tsx",
]);
const mojibakePattern = new RegExp(`[${String.fromCharCode(0xc3)}${String.fromCharCode(0xc2)}${String.fromCharCode(0xfffd)}]`);
const failures = [];

for (const root of roots) {
  await scanPath(root);
}

for (const file of extraFiles) {
  await checkFile(file);
}

if (failures.length > 0) {
  console.error("Fant mulig mojibake eller UTF-8 BOM i tekstfiler:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Tekstsjekk OK: ingen åpenbar mojibake eller BOM funnet.");

async function scanPath(currentPath) {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      if ([".next", "node_modules"].includes(entry.name)) {
        continue;
      }
      await scanPath(entryPath);
      continue;
    }

    await checkFile(entryPath);
  }
}

async function checkFile(filePath) {
  if (!allowedExtensions.has(path.extname(filePath))) {
    return;
  }

  const buffer = await readFile(filePath);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    failures.push(`${filePath}: UTF-8 BOM`);
  }

  const text = buffer.toString("utf8");
  const match = text.match(mojibakePattern);
  if (match?.index !== undefined) {
    const line = text.slice(0, match.index).split(/\r?\n/).length;
    failures.push(`${filePath}:${line}: inneholder "${match[0]}"`);
  }
}
