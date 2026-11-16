// "The Ocean Has a Door" — make.fun ai-excited-01 entry.
//
// The image is the artwork itself: a colossal midnight ocean split open
// like two curtains by the beam of a tiny red lighthouse, revealing a
// second, upside-down ocean with a pale moon beneath the waves and
// luminous whales swimming upward into it. It was produced from the
// design spec (SPEC-sol.md) with an image generator and selected for
// clean geometry, legible silhouettes and no stray text, so this program
// ships the finished image as-is and copies it byte-for-byte to the
// output path. Deterministic: the same bytes in, the same bytes out.
//
// Before copying, the program validates the file against the
// competition gate: at most 1 MiB, at most 1024x1024 pixels, and a whole
// JPEG (starts with SOI, ends with EOI, dimensions read from its SOF
// segment). After copying it verifies the destination byte-for-byte
// with a SHA-256 comparison, so a truncated or corrupted write fails
// loudly instead of silently submitting a broken image.
//
// Node 22, standard library only. No network, no randomness.
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_NAME = "entry.png";
const MAX_BYTES = 1048576; // 1 MiB gate limit
const MAX_DIMENSION = 1024; // gate limit per side

// Source image lives next to this program in the repository.
const repoDir = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(repoDir, SOURCE_NAME);

// Destination: $MAKEFUN_OUTPUT_DIR/entry.png, default /output/entry.png.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const outputPath = resolve(outputDir, SOURCE_NAME);

if (!existsSync(sourcePath)) {
  throw new Error(`source image missing: ${sourcePath}`);
}

const bytes = readFileSync(sourcePath);
if (bytes.length === 0 || bytes.length > MAX_BYTES) {
  throw new Error(`source image size ${bytes.length} bytes is outside the 1..1048576 range`);
}

// Whole-JPEG check: SOI marker at the start, EOI marker at the end.
if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
  throw new Error("source image is not a JPEG (missing SOI marker FFD8)");
}
if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
  throw new Error("source image is not a whole JPEG (missing EOI marker FFD9)");
}

// Read width/height from the first SOF0/SOF2 segment and enforce the
// 1024x1024 gate. Walk the JPEG markers; skip segments we do not need.
function jpegDimensions(buf) {
  let offset = 2; // past SOI
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      throw new Error(`corrupt JPEG marker at offset ${offset}`);
    }
    const marker = buf[offset + 1];
    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = buf.readUInt16BE(offset + 2);
    if (length < 2 || offset + 2 + length > buf.length) {
      throw new Error(`corrupt JPEG segment at offset ${offset}`);
    }
    // SOF0 (0xC0) / SOF2 (0xC2): precision byte, then height, then width.
    if (marker === 0xc0 || marker === 0xc2) {
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + length;
  }
  throw new Error("no SOF segment found in JPEG");
}

const { width, height } = jpegDimensions(bytes);
if (width === 0 || height === 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
  throw new Error(`image dimensions ${width}x${height} exceed the 1024x1024 gate`);
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(sourcePath, outputPath);

// Byte-for-byte verification: SHA-256 of destination must equal source.
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const sourceHash = sha256(bytes);
const writtenHash = sha256(readFileSync(outputPath));
if (writtenHash !== sourceHash) {
  throw new Error(`copy mismatch: sha256 ${writtenHash}, expected ${sourceHash}`);
}

console.log(`wrote ${outputPath} (${bytes.length} bytes, ${width}x${height}, sha256 ${sourceHash})`);
