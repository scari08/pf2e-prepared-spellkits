import { MODULE_ID } from "./consts.js";

Hooks.once("ready", () => {
  Hooks.on("renderCharacterSheetPF2e", addModuleFunctionalities);
});

function addModuleFunctionalities(characterSheetPF2e, $elements, actorSheet) {
  const actor = characterSheetPF2e.actor;
  const elem = $elements[0]; // remove this when jQuery is no longer used
  const matchingListItems = elem.querySelectorAll("ol.spellcastingEntry-list > li.spellcasting-entry");

  const preparedSpellcastingEntries = Array.from(matchingListItems)
    .map((li) => {
      const button = li.querySelector("div.spell-ability-data > button.prepare-spells");
      if (button) {
        return {
          id: li.getAttribute("data-item-id"),
          button: button,
        };
      }
      return null;
    })
    .filter((item) => item !== null);

  preparedSpellcastingEntries.forEach((entry) => {
    const spellcastingEntry = actor.getEmbeddedDocument("Item", entry.id);
    const currentSpellKit = spellcastingEntry.system.slots;
    let kitName = "";
    const savedSpellKits = spellcastingEntry.flags[MODULE_ID] || {};

    Object.keys(savedSpellKits).forEach((key) => {
      // Check if current spellkit matches any of those in the flags
      const savedKit = savedSpellKits[key];
      let allMatch = true;
      for (let slot of Object.keys(currentSpellKit)) {
        const currPrepared = currentSpellKit[slot]?.prepared || [];
        const savedPrepared = savedKit?.[slot]?.prepared || [];
        if (currPrepared.length !== savedPrepared.length) {
          allMatch = false;
          break;
        }
        for (let i = 0; i < currPrepared.length; i++) {
          if ((currPrepared[i]?.id || null) !== (savedPrepared[i]?.id || null)) {
            allMatch = false;
            break;
          }
        }
        if (!allMatch) break;
      }
      if (allMatch) {
        kitName = key;
      }
    });

    // Create the expandable div styled as flex row
    const expandableDiv = document.createElement("div");
    expandableDiv.classList.add("spellkits-expandable");

    // Create dropdown with initial options
    const dropdown = document.createElement("select");
    const options = [...(kitName == "" ? [{ value: kitName, text: kitName }] : []), ...Object.keys(savedSpellKits).map((key) => ({ value: key, text: key }))];
    options.forEach((opt) => {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.text;
      dropdown.appendChild(option);
    });
    dropdown.value = kitName; // Set current value

    // When dropdown value changes, the spellkit of that entry changes
    dropdown.addEventListener("change", () => {
      const selectedValue = dropdown.value;
      if (selectedValue !== "") {
        const kitLoad = savedSpellKits[selectedValue];
        spellcastingEntry.update({ _id: entry.id, "system.slots": kitLoad });
      }
    });

    // Create textbox for new value input
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = game.i18n.localize(MODULE_ID + ".textbox-placeholder");
    input.style.flexGrow = "1";

    // Create the arrow icon as an <a> with Font Awesome icon
    const arrowIcon = document.createElement("a");
    arrowIcon.setAttribute("data-tooltip", game.i18n.localize(MODULE_ID + ".spellkit-show-title"));
    arrowIcon.classList.add("spellkits-icon-btn");

    const arrowFaIcon = document.createElement("i");
    arrowFaIcon.classList.add("fa-solid", "fa-caret-down");
    arrowIcon.appendChild(arrowFaIcon);

    // Insert the arrow next to the button
    entry.button.insertAdjacentElement("afterend", arrowIcon);

    // Create save button as an <a> with Font Awesome icon
    const saveButton = document.createElement("a");
    saveButton.setAttribute("data-tooltip", game.i18n.localize(MODULE_ID + ".spellkit-save-title"));
    saveButton.classList.add("spellkits-icon-btn");
    const saveIcon = document.createElement("i");
    saveIcon.classList.add("fa-solid", "fa-floppy-disk");
    saveButton.appendChild(saveIcon);

    // Create delete button as an <a> with Font Awesome icon
    const deleteButton = document.createElement("a");
    deleteButton.title = game.i18n.localize(MODULE_ID + ".spellkit-delete-title");
    deleteButton.setAttribute("data-tooltip", game.i18n.localize(MODULE_ID + ".spellkit-delete-title"));
    deleteButton.classList.add("spellkits-icon-btn");
    const deleteIcon = document.createElement("i");
    deleteIcon.classList.add("fa-solid", "fa-trash");
    deleteButton.appendChild(deleteIcon);

    // Append dropdown, input, save, and delete buttons to expandable div
    expandableDiv.appendChild(dropdown);
    expandableDiv.appendChild(input);
    expandableDiv.appendChild(saveButton);
    expandableDiv.appendChild(deleteButton);

    // Find the container with class "spell-ability-data"
    const spellAbilityData = entry.button.closest(".spell-ability-data");
    if (spellAbilityData) {
      spellAbilityData.insertAdjacentElement("afterend", expandableDiv);
    }

    // Toggle expandable div on arrow click
    arrowIcon.addEventListener("click", async () => {
      const isExpanded = expandableDiv.style.display === "flex";
      expandableDiv.style.display = isExpanded ? "none" : "flex";
      arrowFaIcon.classList.toggle("fa-caret-down", isExpanded);
      arrowFaIcon.classList.toggle("fa-caret-right", !isExpanded);
    });

    // Save button click handler
    saveButton.addEventListener("click", async () => {
      const newValue = sanitizeKey(input.value.trim());

      if (newValue.length < 3 || newValue.length > 30) {
        ui.notifications.error(game.i18n.localize(MODULE_ID + ".textbox-length-error"));
        return;
      }

      if (savedSpellKits.hasOwnProperty(newValue)) {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize(MODULE_ID + ".spellkit-overwrite-title") },
          content: game.i18n.format(MODULE_ID + ".spellkit-overwrite-text", { newValue: newValue }),
          icon: "fa-solid fa-floppy-disk",
        });
        if (!confirmed) return;
      }

      kitName = newValue;
      spellcastingEntry.setFlag(MODULE_ID, kitName, currentSpellKit);
    });

    // Delete button click handler
    deleteButton.addEventListener("click", async () => {
      const selectedValue = dropdown.value;
      if (selectedValue !== "") {
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: game.i18n.localize(MODULE_ID + ".spellkit-delete-title") },
          content: game.i18n.format(MODULE_ID + ".spellkit-delete-text", { selectedValue: selectedValue }),
          icon: "fa-solid fa-trash",
        });
        if (confirmed) {
          spellcastingEntry.unsetFlag(MODULE_ID, selectedValue);
        }
      }
    });
  });
}

function sanitizeKey(key) {
  // Replaces any character in the key that is not a letter, digit, underscore, or hyphen with an underscore.
  return key.replace(/[^\w\-]/g, "_");
}
