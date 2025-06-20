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
    let kitName = "custom";
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

    // Create the arrow icon
    const arrowIcon = document.createElement("span");
    arrowIcon.innerHTML = "&#9660;"; // Down-pointing arrow (▼)
    arrowIcon.classList.add("toggle-arrow");
    arrowIcon.title = "Show Spellkits Loadouts"; // Tooltip on hover
    arrowIcon.style.cursor = "pointer";
    arrowIcon.style.marginLeft = "0.25em";

    // Insert the arrow next to the button
    entry.button.insertAdjacentElement("afterend", arrowIcon);

    // Create the expandable div styled as flex row
    const expandableDiv = document.createElement("div");
    expandableDiv.classList.add("spellkits-expandable");
    expandableDiv.style.display = "none";
    expandableDiv.style.alignItems = "center";
    expandableDiv.style.gap = "0.5em";

    // Create dropdown with initial options
    const dropdown = document.createElement("select");
    const options = [...(kitName == "custom" ? [{ value: kitName, text: kitName }] : []), ...Object.keys(savedSpellKits).map((key) => ({ value: key, text: key }))];
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
      if (selectedValue !== "custom") {
        const kitLoad = savedSpellKits[selectedValue];
        spellcastingEntry.update({ _id: entry.id, "system.slots": kitLoad });
      }
    });

    // Create textbox for new value input
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Spellkit Loadout Name";
    input.style.flexGrow = "1";

    // Create save button as a small symbol
    const saveButton = document.createElement("button");
    saveButton.innerHTML = "&#128190;"; // floppy disk symbol
    saveButton.title = "Save Spellkit Loadout";
    saveButton.style.fontSize = "1.2em";
    saveButton.style.cursor = "pointer";
    saveButton.style.border = "none";
    saveButton.style.background = "transparent";
    saveButton.style.width = "auto";
    saveButton.style.padding = "0";

    // Append dropdown, input, and button to expandable div
    expandableDiv.appendChild(dropdown);
    expandableDiv.appendChild(input);
    expandableDiv.appendChild(saveButton);

    // Find the container with class "spell-ability-data"
    const spellAbilityData = entry.button.closest(".spell-ability-data");
    if (spellAbilityData) {
      spellAbilityData.insertAdjacentElement("afterend", expandableDiv);
    }

    // Toggle expandable div on arrow click
    arrowIcon.addEventListener("click", async () => {
      const isExpanded = expandableDiv.style.display === "flex";
      expandableDiv.style.display = isExpanded ? "none" : "flex";
      arrowIcon.innerHTML = isExpanded ? "&#9660;" : "&#9654;"; // ▼ or ►
    });

    // Save button click handler
    saveButton.addEventListener("click", () => {
      const newValue = sanitizeKey(input.value.trim());
      if (newValue === "") {
        ui.notifications.warn("Spellkit name cannot be empty.");
        return;
      }

      // Check if value already exists
      const exists = Array.from(dropdown.options).some((opt) => opt.value === newValue);
      kitName = newValue;

      // Save the new spellkit loadout in the item's flags
      spellcastingEntry.setFlag(MODULE_ID, kitName, currentSpellKit);
    });
  });
}

function sanitizeKey(key) {
  // Replaces any character in the key that is not a letter, digit, underscore, or hyphen with an underscore.
  return key.replace(/[^\w\-]/g, "_");
}
