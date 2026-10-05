const ids = ["ticketmasterApiKey", "seatgeekClientId", "ticketsDevApiKey"];
let savedValues = {};
let loaded = false;
let saving = false;

function hasChanges() {
  return ids.some((id) => document.getElementById(id).value.trim() !== (savedValues[id] || ""));
}

function updateState(id) {
  const configured = Boolean(document.getElementById(id).value.trim());
  const state = document.getElementById(id + "State");
  const changed = loaded && document.getElementById(id).value.trim() !== (savedValues[id] || "");
  state.textContent = changed ? "Unsaved change" : configured ? "Saved" : "Not configured";
  state.classList.toggle("on", configured && !changed);
}

document.addEventListener("DOMContentLoaded", async () => {
  const save = document.getElementById("save");
  const status = document.getElementById("status");
  save.disabled = true;
  status.textContent = "Loading connections…";
  try {
  const values = await chrome.storage.local.get(ids);
  savedValues = values;
  loaded = true;
  for (const id of ids) {
    const input = document.getElementById(id);
    input.value = values[id] || "";
    input.addEventListener("input", () => {
      updateState(id);
      save.disabled = saving || !hasChanges();
      status.textContent = hasChanges() ? "Changes are not saved yet." : "";
    });
    updateState(id);
  }
  status.textContent = "";
  } catch {
    status.textContent = "Could not load saved connections. Reopen this page to retry.";
  }
});

for (const button of document.querySelectorAll(".reveal")) {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.for);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.textContent = showing ? "Show" : "Hide";
    button.setAttribute("aria-pressed", String(!showing));
  });
}

document.getElementById("save").addEventListener("click", async () => {
  const save = document.getElementById("save");
  const status = document.getElementById("status");
  if (!loaded || saving || !hasChanges()) return;
  saving = true;
  save.disabled = true;
  status.textContent = "Saving…";
  try {
    const values = Object.fromEntries(ids.map((id) => [id, document.getElementById(id).value.trim()]));
    await chrome.storage.local.set(values);
    savedValues = values;
    ids.forEach(updateState);
    status.textContent = hasChanges() ? "Earlier changes saved. New edits still need saving." : "Saved on this device.";
  } catch {
    status.textContent = "Could not save. Try again.";
  } finally {
    saving = false;
    save.disabled = !hasChanges();
  }
});
