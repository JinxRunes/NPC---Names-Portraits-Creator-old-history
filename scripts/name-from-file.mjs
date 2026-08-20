/**
 * extract actor name
 */
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;

/**
 * @param {string} input  Filename or path (may be URI-encoded)
 * @returns {string}
 */
export function nameFromFilename(input) {
  if ( !input || typeof input !== "string" ) return "Unnamed NPC";

  let base = input.split(/[/\\]/).pop() ?? input;

  // Decode %20 etc. once (and again if double-encoded)
  for ( let i = 0; i < 2; i++ ) {
    if ( !/%[0-9A-Fa-f]{2}/.test(base) ) break;
    try {
      base = decodeURIComponent(base);
    }
    catch {
      break;
    }
  }

  base = base.replace(/\+/g, " ");
  base = base.replace(IMAGE_EXT, "");
  base = base.replace(/[_\s]+/g, " ").trim();
  return base || "Unnamed NPC";
}

/**
 * @param {string} filename
 * @returns {boolean}
 */
export function isImageFilename(filename) {
  return IMAGE_EXT.test(filename ?? "");
}

/**
 * Safe basename for disk upload while preserving a readable stem.
 * @param {string} originalName
 * @returns {string}
 */
export function safeUploadFilename(originalName) {
  let base = (originalName ?? "portrait").split(/[/\\]/).pop() ?? "portrait";
  try {
    if ( /%[0-9A-Fa-f]{2}/.test(base) ) base = decodeURIComponent(base);
  }
  catch { /* keep */ }

  const extMatch = base.match(IMAGE_EXT);
  const ext = extMatch ? extMatch[0].toLowerCase() : ".webp";
  let stem = base.replace(IMAGE_EXT, "").trim() || "portrait";
  // Keep letters, numbers, spaces, dashes, underscores; collapse the rest
  stem = stem.replace(/[^\p{L}\p{N} _\-().]/gu, "_").replace(/\s+/g, " ").trim();
  stem = stem.slice(0, 80) || "portrait";
  return `${stem}${ext}`;
}
