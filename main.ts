import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Entry for make.fun "Make the AI judge excited" (ai-excited-01).
// The image is "The Ocean Has a Door": a tiny red lighthouse whose beam
// parts the midnight ocean onto an upside-down ocean with an ivory moon
// and luminous whales. This program copies the image the repository
// holds to the output directory. No network, deterministic output.

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const source = join(here, "entry.png");
const target = join(outDir, "entry.png");

// Fail loudly instead of writing a partial or wrong file: the source
// must exist and be a complete JPEG (SOI marker at the start, EOI at
// the end) before anything is copied.
const bytes = readFileSync(source);
if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
  throw new Error("entry.png is not a JPEG image");
}
if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
  throw new Error("entry.png is truncated: missing JPEG end marker");
}

mkdirSync(outDir, { recursive: true });
copyFileSync(source, target);

// Verify the copy landed whole: same byte length as the source.
if (statSync(target).size !== bytes.length) {
  throw new Error("output is not byte-identical to entry.png");
}
