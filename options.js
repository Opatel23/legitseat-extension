const ids = ["ticketmasterApiKey", "seatgeekClientId", "ticketsDevApiKey"];
document.addEventListener("DOMContentLoaded", async () => {
  const values = await chrome.storage.local.get(ids);
  ids.forEach((id) => { document.getElementById(id).value = values[id] || ""; });
});
document.getElementById("save").addEventListener("click", async () => {
  const values = Object.fromEntries(ids.map((id) => [id, document.getElementById(id).value.trim()]));
  await chrome.storage.local.set(values);
  document.getElementById("status").textContent = "Saved.";
  setTimeout(() => { document.getElementById("status").textContent = ""; }, 2000);
});
