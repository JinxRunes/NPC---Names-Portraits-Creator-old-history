import { safeUploadFilename } from "./name-from-file.mjs";

const MODULE_ID = "npc-name-portrait-creator";

/**
 * ensure a data-folder path exists (create parents as needed).
 * @param {string} target
 * @param {string} [source="data"]
 */
export async function ensureDataFolder(target, source = "data") {
  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  const parts = target.split("/").filter(Boolean);
  let built = "";
  for ( const part of parts ) {
    built = built ? `${built}/${part}` : part;
    try {
      await FilePicker.browse(source, built);
    }
    catch {
      try {
        await FilePicker.createDirectory(source, built);
      }
      catch ( err ) {
        // Race: another create won — try browse again
        try {
          await FilePicker.browse(source, built);
        }
        catch {
          throw err;
        }
      }
    }
  }
}

/**
 * Upload one image into the world npc-portraits batch folder.
 * @param {File} file
 * @param {string} batchId
 * @returns {Promise<string>} Absolute/relative Foundry path to the uploaded file
 */
export async function uploadPortrait(file, batchId) {
  const FilePicker = foundry.applications.apps.FilePicker.implementation;
  const worldId = game.world.id;
  const folder = `worlds/${worldId}/npc-portraits/${batchId}`;
  await ensureDataFolder(folder);

  const uploadName = safeUploadFilename(file.name);
  // name sanitization
  const blob = file.slice(0, file.size, file.type || "application/octet-stream");
  const named = new File([blob], uploadName, { type: file.type || blob.type, lastModified: file.lastModified });

  const result = await FilePicker.upload("data", folder, named, {}, { notify: false });
  if ( !result?.path ) {
    throw new Error(`Upload failed for ${file.name}`);
  }
  return result.path;
}

/**
 * Clone the template actor 
 * @param {Actor} template
 * @param {{ name: string, imagePath: string }} opts
 * @returns {Promise<Actor>}
 */
export async function createActorFromTemplate(template, { name, imagePath }) {
  return template.clone({
    name,
    img: imagePath,
    prototypeToken: {
      name,
      texture: { src: imagePath }
    },
    folder: template.folder?.id ?? template._source?.folder ?? null
  }, {
    save: true,
    addSource: true,
    discardInvalidEmbedded: true,
    renderSheet: false
  });
}

export { MODULE_ID };
