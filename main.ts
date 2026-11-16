// main.ts — "The Ocean Has a Door" entry for ai-excited-01.
// Copies the repo-held entry.png to the output directory, verifying
// the image is a whole PNG or JPEG and that the copy is byte-identical.
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MAX_BYTES = 1048576;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const repoDir = dirname(fileURLToPath(import.meta.url));
const source = join(repoDir, "entry.png");
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const target = join(outDir, "entry.png");

if (!existsSync(source)) {
  throw new Error(`entry.png not found at ${source}`);
}

const bytes = readFileSync(source);
if (bytes.length === 0 || bytes.length > MAX_BYTES) {
  throw new Error(`entry.png is ${bytes.length} bytes; must be 1..${MAX_BYTES}`);
}

const isPng = bytes.subarray(0, 8).equals(PNG_SIGNATURE);
const isJpeg =
  bytes.length >= 4 &&
  bytes[0] === 0xff &&
  bytes[1] === 0xd8 &&
  bytes[bytes.length - 2] === 0xff &&
  bytes[bytes.length - 1] === 0xd9;
if (!isPng && !isJpeg) {
  throw new Error("entry.png is neither a whole PNG nor a whole JPEG");
}

mkdirSync(outDir, { recursive: true });
copyFileSync(source, target);

const copied = readFileSync(target);
const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");
if (copied.length !== bytes.length || sha(copied) !== sha(bytes)) {
  throw new Error("copied entry.png differs from the source");
}
console.log(`wrote ${target} (${copied.length} bytes, sha256 ${sha(copied)})`);
