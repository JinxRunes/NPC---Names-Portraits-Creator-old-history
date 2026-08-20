import { isImageFilename, nameFromFilename } from "./name-from-file.mjs";

/**
 * Turn a pasted assets/play URL or relative Data path into a FilePicker target.
 * Example:
 *   https://assets.jinx.gg/Assets/TokenRings/Menagerie%20Coast/.../Other%20Crew/
 *   → Assets/TokenRings/Menagerie Coast/.../Other Crew
 *
 * @param {string} input
 * @returns {string}
 */
export function pathFromDirectoryLink(input) {
  if ( !input || typeof input !== "string" ) return "";
  let value = input.trim();
  if ( !value ) return "";

  // Strip query/hash
  value = value.replace(/[?#].*$/, "");

  if ( /^https?:\/\//i.test(value) || value.startsWith("//") ) {
    try {
      const url = new URL(value.startsWith("//") ? `https:${value}` : value);
      value = url.pathname || "";
    }
    catch {
      return "";
    }
  }

  value = value.replace(/^\/+/, "");

  // Decode %20 etc. in each segment (Foundry data paths use real spaces)
  value = value
    .split("/")
    .map(seg => {
      if ( !seg ) return "";
      let s = seg;
      for ( let i = 0; i < 2; i++ ) {
        if ( !/%[0-9A-Fa-f]{2}/.test(s) ) break;
        try { s = decodeURIComponent(s); }
        catch { break; }
      }
      return s.replace(/\+/g, " ");
    })
    .filter((seg, i, arr) => seg !== "" || (i > 0 && i < arr.length - 1))
    .join("/");

  // If a file was pasted, use its parent directory
  const last = value.split("/").pop() ?? "";
  if ( last.includes(".") && isImageFilename(last) ) {
    value = value.split("/").slice(0, -1).join("/");
  }

  return value.replace(/\/+$/, "");
}

/**
 * Recursively list image files under a Data (or S3) folder.
 * @param {string} directoryPath  Relative path under the storage root
 * @param {object} [options]
 * @param {string} [options.source="data"]
 * @param {boolean} [options.recursive=true]
 * @param {string} [options.bucket]
 * @returns {Promise<{ imagePath: string, fileName: string, actorName: string }[]>}
 */
export async function listImagesInDirectory(directoryPath, options = {}) {
  const source = options.source ?? "data";
  const recursive = options.recursive !== false;
  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  const browseOpts = {};
  if ( source === "s3" && options.bucket ) browseOpts.bucket = options.bucket;

  /** @type {{ imagePath: string, fileName: string, actorName: string }[]} */
  const out = [];

  async function walk(target) {
    const result = await FilePicker.browse(source, target, browseOpts);
    const files = result?.files ?? [];
    for ( const filePath of files ) {
      const fileName = (filePath.split("/").pop() ?? filePath);
      if ( !isImageFilename(fileName) ) continue;
      out.push({
        imagePath: filePath,
        fileName: decodePathSegment(fileName),
        actorName: nameFromFilename(fileName)
      });
    }
    if ( recursive ) {
      for ( const dir of result?.dirs ?? [] ) {
        await walk(dir);
      }
    }
  }

  await walk(directoryPath);
  out.sort((a, b) => a.fileName.localeCompare(b.fileName, undefined, { sensitivity: "base" }));
  return out;
}

/**
 * @param {string} segment
 * @returns {string}
 */
function decodePathSegment(segment) {
  let s = segment;
  for ( let i = 0; i < 2; i++ ) {
    if ( !/%[0-9A-Fa-f]{2}/.test(s) ) break;
    try { s = decodeURIComponent(s); }
    catch { break; }
  }
  return s.replace(/\+/g, " ");
}
