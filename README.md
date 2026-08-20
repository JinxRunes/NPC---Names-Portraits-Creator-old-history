# NPC Name & Portrait Creator

Foundry VTT module creating new actors from a collection of named images of NPC actors from one template. You point it at a folder of portraits (local upload or something already on the server / CDN), it names each actor from the filename, and clones the template with that art on the sheet and token.

## Demo

[![NPC Name & Portrait Creator demo](https://img.youtube.com/vi/r5Bxs0Js6QM/maxresdefault.jpg)](https://www.youtube.com/live/r5Bxs0Js6QM)

[Watch on YouTube](https://www.youtube.com/live/r5Bxs0Js6QM)

## Install

Drop the module folder into `Data/modules/` as `npc-name-portrait-creator`, or install from a release ZIP that has `module.json` at the root. Enable it in the world. GM + Create Actor permission required.

## How to use

1. Right-click an actor in the sidebar (this is your template).
2. Pick **Create Mass Duplicates**.
3. Feed it images:
   - **Local folder** -- pick a folder on your machine; images get uploaded under the world (`npc-portraits/...`).
   - **Existing path** -- paste a Foundry Data path, or an `assets.jinx.gg` / play URL, or browse the folder tree. Subfolders are included; nothing is re-uploaded.
4. Review the list. Names come from filenames (`Cassian%20Aureli.webp` -> Cassian Aureli). Edit anything that looks wrong.
5. Create. Each entry becomes a clone of the template with the new name and portrait/token art.

## Notes

- Image types: png, jpg, jpeg, gif, webp, avif, bmp, svg. Everything else in the folder is ignored.
- Clones keep the template's folder, gear, and the rest of the sheet -- only name and art are swapped.

## License

MIT -- see [LICENSE](LICENSE).
