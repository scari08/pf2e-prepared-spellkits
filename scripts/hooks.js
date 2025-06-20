import { MODULE_ID } from "./consts.js";

Hooks.once("ready", () => {
  Hooks.on("renderCharacterSheetPF2e", addModuleFunctionalities);

  //   Hooks.on("renderCreatureSheetPF2e", );

  //   Hooks.on("renderActorSheetPF2e", );

  //   Hooks.on("renderActorSheet", );
});

function addModuleFunctionalities(characterSheetPF2e, $elements, actorSheet) {
  const actor = characterSheetPF2e.actor;
  const elem = $elements[0];
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
    const savedSpellKits = actor.getFlag(MODULE_ID, entry.id); // Could be undefined if there are no saved kits yet

    const currentSpellKit = actor.getEmbeddedDocument("Item", entry.id).system.slots;
    let kitName = "custom"; // TODO check if current is one of the saved and change name

    // Create the arrow icon
    const arrowIcon = document.createElement("span");
    arrowIcon.innerHTML = "&#9660;"; // Down-pointing arrow (▼)
    arrowIcon.style.cursor = "pointer";
    arrowIcon.style.marginLeft = "0.25em";
    arrowIcon.classList.add("toggle-arrow");
    arrowIcon.title = "Show Spellkits Loadouts"; // Tooltip on hover

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
    const custom = document.createElement("option");
    custom.value = "custom";
    custom.textContent = "custom";
    dropdown.appendChild(custom);
    if (savedSpellKits && typeof savedSpellKits === "object") {
      Object.keys(savedSpellKits).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = key;
        dropdown.appendChild(option);
      });
    }

    // When dropdown value changes, the spellkit of that entry changes
    dropdown.addEventListener("change", () => {
      const selectedValue = dropdown.value;
      if (selectedValue !== "custom") {
        const kitLoad = savedSpellKits[selectedValue];
        actor.updateEmbeddedDocuments("Item", [{ _id: entry.id, "system.slots": kitLoad }]);
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
      if (newValue === "") return; // ignore empty input

      // Check if value already exists
      const exists = Array.from(dropdown.options).some((opt) => opt.value.toLowerCase() === newValue.toLowerCase());
      if (exists) {
        ui.notifications.error("Value already exists!");
        return;
      }

      // Create and append new option
      const newOption = document.createElement("option");
      newOption.value = newValue;
      newOption.textContent = newValue;
      dropdown.appendChild(newOption);

      // Save the new spellkit loadout in the actor's flags
      kitName = newValue;
      actor.setFlag(MODULE_ID, `${entry.id}.${kitName}`, currentSpellKit);
    });
  });
}

function sanitizeKey(key) {
  return key.replace(/[^\w\-]/g, "_");
}
