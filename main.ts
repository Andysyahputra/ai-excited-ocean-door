// The Ocean Has a Door — make.fun ai-excited-01
//
// Copies the entry image (a JPEG held in this repository as entry.png)
// to $MAKEFUN_OUTPUT_DIR/entry.png (default /output/entry.png).
// Before copying, the image is validated against the competition gate:
//   - JPEG magic bytes (FF D8 FF) and terminating EOI marker (FF D9)
//   - at most 1 MiB (1,048,576 bytes)
//   - at most 1024 x 1024 pixels (dimensions read from the SOF marker)
// After copying, the output file is re-read and its size and sha256 are
// compared with the source, so a partial or corrupted write is caught
// instead of silently passing. The copy is byte-for-byte, so repeated
// runs are deterministic.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";

const MAX_BYTES = 1_048_576;
const MAX_DIMENSION = 1024;

const repoRoot = new URL(".", import.meta.url).pathname;
const sourcePath = resolve(repoRoot, "entry.png");
const outputDir = process.env.MAKEFUN_OUTPUT_DIR?.trim() || "/output";
const outputPath = join(outputDir, "entry.png");

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

// Read the SOF segment of a JPEG and return its [width, height].
// JPEG markers: 0xFF 0xC0..0xCF (except 0xC4, 0xC8, 0xCC) hold the frame header.
function jpegDimensions(bytes: Buffer): [number, number] {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    fail("entry.png is not a JPEG (missing SOI marker FF D8 FF)");
  }
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) fail("entry.png is malformed: expected a JPEG marker");
    const marker = bytes[offset + 1];
    // Standalone markers have no length field; skip them.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > bytes.length) {
      fail("entry.png is malformed: bad JPEG segment length");
    }
    const isSof =
      (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc);
    if (isSof) {
      const height = bytes.readUInt16BE(offset + 5);
      const width = bytes.readUInt16BE(offset + 7);
      return [width, height];
    }
    offset += 2 + length;
  }
  fail("entry.png is malformed: no JPEG SOF segment found");
}

if (!existsSync(sourcePath)) fail(`source image not found: ${sourcePath}`);

const bytes = readFileSync(sourcePath);
const size = statSync(sourcePath).size;

if (size > MAX_BYTES) {
  fail(`entry.png is ${size} bytes, over the 1 MiB limit`);
}
if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
  fail("entry.png is truncated: missing JPEG end marker FF D9");
}
const [width, height] = jpegDimensions(bytes);
if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
  fail(`entry.png is ${width}x${height}, over the 1024x1024 limit`);
}

const sourceDigest = sha256(bytes);
mkdirSync(outputDir, { recursive: true });
if (resolve(outputPath) !== resolve(sourcePath)) {
  copyFileSync(sourcePath, outputPath);
}

// Verify the written output matches the validated source byte for byte.
const written = readFileSync(outputPath);
if (written.length !== size) {
  fail(`output is ${written.length} bytes, expected ${size}: incomplete write`);
}
if (sha256(written) !== sourceDigest) {
  fail("output sha256 does not match source: corrupted write");
}

console.log(`copied entry.png (${size} bytes, ${width}x${height}, sha256 ${sourceDigest}) -> ${outputPath} (verified)`);
