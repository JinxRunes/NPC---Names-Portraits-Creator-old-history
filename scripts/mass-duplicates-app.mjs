import { MODULE_ID, createActorFromTemplate, uploadPortrait } from "./create-actors.mjs";
import { listImagesInDirectory, pathFromDirectoryLink } from "./browse-directory.mjs";
import { isImageFilename, nameFromFilename } from "./name-from-file.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * @typedef {object} MassEntry
 * @property {string} id
 * @property {File} [file]           Local upload source
 * @property {string} [imagePath]    Existing Foundry/CDN path (no upload)
 * @property {string} fileName
 * @property {string} actorName
 * @property {string} previewUrl
 * @property {"upload"|"link"} source
 */

export class MassDuplicatesApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {Actor} */
  #template;

  /** @type {MassEntry[]} */
  #entries = [];

  /** @type {boolean} */
  #busy = false;

  /** @type {string} */
  #statusText = "";

  /** @type {string} */
  #directoryLink = "";

  /** @type {1|2|3} */
  #step = 1;

  /** @type {number} */
  #completed = 0;

  /** @type {number} */
  #failed = 0;

  /** @type {boolean} */
  #finished = false;

  /**
   * @param {Actor} templateActor
   * @param {object} [options]
   */
  constructor(templateActor, options = {}) {
    super(options);
    this.#template = templateActor;
  }

  static DEFAULT_OPTIONS = {
    id: "npc-mass-duplicates",
    classes: ["npc-name-portrait-creator"],
    position: { width: 720, height: 620 },
    window: {
      title: "NPCNamePortrait.WindowTitle",
      icon: "fa-solid fa-users",
      resizable: true
    },
    actions: {
      pickFolder: MassDuplicatesApp.#onPickFolder,
      loadDirectoryLink: MassDuplicatesApp.#onLoadDirectoryLink,
      browseFoundryFolder: MassDuplicatesApp.#onBrowseFoundryFolder,
      clearList: MassDuplicatesApp.#onClearList,
      previousStep: MassDuplicatesApp.#onPreviousStep,
      nextStep: MassDuplicatesApp.#onNextStep,
      editSource: MassDuplicatesApp.#onEditSource,
      startOver: MassDuplicatesApp.#onStartOver,
      closeWindow: MassDuplicatesApp.#onCloseWindow,
      createActors: MassDuplicatesApp.#onCreateActors
    }
  };

  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/mass-duplicates.hbs`,
      root: true
    }
  };

  /** @inheritDoc */
  async _prepareContext() {
    return {
      templateName: this.#template?.name ?? "?",
      templateImg: this.#template?.img || this.#template?.prototypeToken?.texture?.src || "",
      directoryLink: this.#directoryLink,
      stepSource: this.#step === 1,
      stepReview: this.#step === 2,
      stepCreate: this.#step === 3,
      step1Done: this.#step > 1,
      step2Done: this.#step > 2,
      entries: this.#entries.map(e => ({
        id: e.id,
        fileName: e.fileName,
        actorName: e.actorName,
        previewUrl: e.previewUrl,
        source: e.source
      })),
      previewEntries: this.#entries.slice(0, 8).map(e => ({
        id: e.id,
        actorName: e.actorName,
        previewUrl: e.previewUrl
      })),
      remainingCount: Math.max(0, this.#entries.length - 8),
      sourceLabel: this.#entries[0]?.source === "link"
        ? game.i18n.localize("NPCNamePortrait.SourceExistingShort")
        : game.i18n.localize("NPCNamePortrait.SourceUploadShort"),
      busy: this.#busy,
      finished: this.#finished,
      completed: this.#completed,
      failed: this.#failed,
      progressPercent: this.#entries.length
        ? Math.round(((this.#completed + this.#failed) / this.#entries.length) * 100)
        : 0,
      statusText: this.#statusText
    };
  }

  /** @inheritDoc */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const root = this.element;
    root.querySelectorAll('input[data-action="editName"]').forEach(input => {
      input.addEventListener("change", () => {
        const id = input.dataset.entryId;
        const entry = this.#entries.find(e => e.id === id);
        if ( entry ) entry.actorName = input.value.trim() || nameFromFilename(entry.fileName);
      });
      input.addEventListener("input", () => {
        const id = input.dataset.entryId;
        const entry = this.#entries.find(e => e.id === id);
        if ( entry ) entry.actorName = input.value;
      });
    });

    const linkInput = root.querySelector("[data-npc-directory-link]");
    if ( linkInput && !linkInput.dataset.bound ) {
      linkInput.dataset.bound = "1";
      linkInput.addEventListener("change", () => {
        this.#directoryLink = linkInput.value.trim();
      });
      linkInput.addEventListener("keydown", event => {
        if ( event.key === "Enter" ) {
          event.preventDefault();
          this.#directoryLink = linkInput.value.trim();
          this.#loadFromDirectoryLink(this.#directoryLink);
        }
      });
    }

    const folderInput = root.querySelector("[data-npc-folder]");
    if ( folderInput && !folderInput.dataset.bound ) {
      folderInput.dataset.bound = "1";
      folderInput.addEventListener("change", () => this.#onFolderChosen(folderInput));
    }
  }

  /** @inheritDoc */
  async close(options) {
    this.#revokeObjectPreviews();
    this.#entries = [];
    return super.close(options);
  }

  #revokeObjectPreviews() {
    for ( const entry of this.#entries ) {
      if ( entry.source === "upload" && entry.previewUrl ) {
        URL.revokeObjectURL(entry.previewUrl);
      }
    }
  }

  static #onPickFolder(event, _target) {
    event.preventDefault();
    const input = this.element.querySelector("[data-npc-folder]");
    input?.click();
  }

  static #onClearList(event, _target) {
    event.preventDefault();
    this.#revokeObjectPreviews();
    this.#entries = [];
    this.#statusText = "";
    this.#step = 1;
    this.#completed = 0;
    this.#failed = 0;
    this.#finished = false;
    this.render();
  }

  static #onPreviousStep(event, _target) {
    event.preventDefault();
    if ( this.#busy ) return;
    this.#step = /** @type {1|2|3} */ (Math.max(1, this.#step - 1));
    this.render();
  }

  static #onNextStep(event, _target) {
    event.preventDefault();
    if ( this.#busy ) return;
    if ( !this.#entries.length ) {
      ui.notifications.warn("NPCNamePortrait.EmptyList");
      return;
    }
    this.#step = /** @type {1|2|3} */ (Math.min(3, this.#step + 1));
    this.render();
  }

  static #onEditSource(event, _target) {
    event.preventDefault();
    if ( this.#busy ) return;
    this.#finished = false;
    this.#step = 1;
    this.render();
  }

  static #onStartOver(event, _target) {
    event.preventDefault();
    if ( this.#busy ) return;
    this.#revokeObjectPreviews();
    this.#entries = [];
    this.#directoryLink = "";
    this.#statusText = "";
    this.#completed = 0;
    this.#failed = 0;
    this.#finished = false;
    this.#step = 1;
    this.render();
  }

  static #onCloseWindow(event, _target) {
    event.preventDefault();
    this.close();
  }

  static async #onLoadDirectoryLink(event, _target) {
    event.preventDefault();
    const input = this.element.querySelector("[data-npc-directory-link]");
    const value = (input?.value ?? this.#directoryLink).trim();
    this.#directoryLink = value;
    await this.#loadFromDirectoryLink(value);
  }

  static async #onBrowseFoundryFolder(event, _target) {
    event.preventDefault();
    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const current = pathFromDirectoryLink(this.#directoryLink) || "Assets";
    const picker = new FilePicker({
      type: "folder",
      current,
      callback: async path => {
        const resolved = pathFromDirectoryLink(path) || path;
        this.#directoryLink = resolved;
        await this.#loadFromDirectoryLink(resolved);
      }
    });
    picker.render(true);
  }

  /**
   * @param {string} raw
   */
  async #loadFromDirectoryLink(raw) {
    if ( this.#busy ) return;
    const folder = pathFromDirectoryLink(raw);
    if ( !folder ) {
      ui.notifications.warn("NPCNamePortrait.BadDirectoryLink");
      return;
    }

    this.#busy = true;
    this.#statusText = game.i18n.format("NPCNamePortrait.ListingDirectory", { path: folder });
    await this.render();

    try {
      const listed = await listImagesInDirectory(folder, { recursive: true, source: "data" });
      this.#revokeObjectPreviews();

      if ( !listed.length ) {
        this.#entries = [];
        this.#statusText = game.i18n.localize("NPCNamePortrait.NoImages");
        ui.notifications.warn("NPCNamePortrait.NoImages");
        return;
      }

      this.#entries = listed.map((row, i) => ({
        id: `e${i}-${foundry.utils.randomID(6)}`,
        imagePath: row.imagePath,
        fileName: row.fileName,
        actorName: row.actorName,
        previewUrl: row.imagePath,
        source: /** @type {"link"} */ ("link")
      }));
      this.#finished = false;
      this.#step = 2;
      this.#directoryLink = folder;
      this.#statusText = "";
    }
    catch ( err ) {
      console.error(`${MODULE_ID} | browse failed`, folder, err);
      this.#entries = [];
      this.#statusText = game.i18n.format("NPCNamePortrait.BrowseFailed", {
        path: folder,
        error: err?.message || String(err)
      });
      ui.notifications.error(this.#statusText);
    }
    finally {
      this.#busy = false;
      await this.render();
    }
  }

  /**
   * @param {HTMLInputElement} input
   */
  async #onFolderChosen(input) {
    const files = Array.from(input.files ?? []).filter(f => isImageFilename(f.name));
    input.value = "";

    this.#revokeObjectPreviews();

    if ( !files.length ) {
      this.#entries = [];
      this.#statusText = game.i18n.localize("NPCNamePortrait.NoImages");
      ui.notifications.warn("NPCNamePortrait.NoImages");
      return this.render();
    }

    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

    this.#entries = files.map((file, i) => ({
      id: `e${i}-${foundry.utils.randomID(6)}`,
      file,
      fileName: file.name,
      actorName: nameFromFilename(file.name),
      previewUrl: URL.createObjectURL(file),
      source: /** @type {"upload"} */ ("upload")
    }));
    this.#finished = false;
    this.#step = 2;
    this.#statusText = "";
    return this.render();
  }

  static async #onCreateActors(event, _target) {
    event.preventDefault();
    await this.#createAll();
  }

  async #createAll() {
    if ( this.#busy ) return;
    if ( !this.#template ) {
      ui.notifications.error("NPCNamePortrait.MissingTemplate");
      return;
    }
    if ( !this.#entries.length ) {
      ui.notifications.warn("NPCNamePortrait.EmptyList");
      return;
    }
    if ( !game.user.isGM ) {
      ui.notifications.error("NPCNamePortrait.NeedGM");
      return;
    }
    if ( !Actor.canUserCreate(game.user) ) {
      ui.notifications.error("NPCNamePortrait.NeedPermission");
      return;
    }

    this.#busy = true;
    this.#step = 3;
    this.#completed = 0;
    this.#failed = 0;
    this.#finished = false;
    this.#statusText = game.i18n.format("NPCNamePortrait.Progress", { done: 0, total: this.#entries.length });
    await this.render();

    const batchId = foundry.utils.randomID(10);
    let ok = 0;
    let fail = 0;

    for ( let i = 0; i < this.#entries.length; i++ ) {
      const entry = this.#entries[i];
      const name = (entry.actorName || "").trim() || nameFromFilename(entry.fileName);
      try {
        let imagePath = entry.imagePath;
        if ( entry.source === "upload" ) {
          if ( !entry.file ) throw new Error("Missing local file");
          imagePath = await uploadPortrait(entry.file, batchId);
        }
        if ( !imagePath ) throw new Error("Missing image path");
        await createActorFromTemplate(this.#template, { name, imagePath });
        ok += 1;
        this.#completed = ok;
      }
      catch ( err ) {
        fail += 1;
        this.#failed = fail;
        console.error(`${MODULE_ID} | Failed for ${entry.fileName}`, err);
      }
      this.#statusText = game.i18n.format("NPCNamePortrait.Progress", {
        done: ok + fail,
        total: this.#entries.length
      });
      const statusEl = this.element?.querySelector("[data-npc-status]");
      if ( statusEl ) statusEl.textContent = this.#statusText;
      const bar = this.element?.querySelector("[data-npc-progress]");
      if ( bar ) bar.style.width = `${Math.round(((ok + fail) / this.#entries.length) * 100)}%`;
    }

    this.#busy = false;
    if ( fail === 0 ) {
      this.#statusText = game.i18n.format("NPCNamePortrait.Done", {
        count: ok,
        template: this.#template.name
      });
      ui.notifications.info(this.#statusText);
    }
    else {
      this.#statusText = game.i18n.format("NPCNamePortrait.Partial", { ok, fail });
      ui.notifications.warn(this.#statusText);
    }
    this.#finished = true;
    await this.render();
  }
}
