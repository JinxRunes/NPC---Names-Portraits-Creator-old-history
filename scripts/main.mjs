import { MassDuplicatesApp } from "./mass-duplicates-app.mjs";
import { MODULE_ID } from "./create-actors.mjs";

/**
 * Open the editor window
 * @param {Actor} actor
 */
export function openMassDuplicates(actor) {
  if ( !actor ) {
    ui.notifications.error("NPCNamePortrait.MissingTemplate");
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
  new MassDuplicatesApp(actor).render({ force: true });
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing NPC — Name & Portrait Creator`);
});

Hooks.on("getActorContextOptions", (application, menuItems) => {
  menuItems.push({
    name: "NPCNamePortrait.ContextMassDuplicates",
    label: "NPCNamePortrait.ContextMassDuplicates",
    icon: "fa-solid fa-users",
    group: "npc-name-portrait",
    visible: li => {
      if ( !game.user.isGM || !Actor.canUserCreate(game.user) ) return false;
      const id = li?.closest?.("[data-entry-id]")?.dataset?.entryId;
      return !!application.collection?.get(id);
    },
    onClick: (_event, li) => {
      const id = li?.closest?.("[data-entry-id]")?.dataset?.entryId
        ?? li?.dataset?.entryId;
      const actor = application.collection?.get(id);
      openMassDuplicates(actor);
    },
    // Foundry ≤13 compat
    callback: li => {
      const el = li?.[0] ?? li;
      const id = el?.closest?.("[data-entry-id]")?.dataset?.entryId
        ?? el?.dataset?.entryId;
      const actor = application.collection?.get(id);
      openMassDuplicates(actor);
    }
  });
});
