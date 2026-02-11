const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTvwCII49Sgr5l9MR_06qtKkvyEPf8ykapcXpBRX-wqavcIBkDcq3aUmCrSdM-t7pS8HwDOPQqXkRwb/pub?output=csv";

const ICON_VERSION = "1.21";
const TEXTURES_URL = `https://unpkg.com/minecraft-textures/dist/textures/json/${ICON_VERSION}.id.json`;

const $rows = document.getElementById("rows");
const $search = document.getElementById("search");
const $category = document.getElementById("category");

let allData = [];
let textureIndex = null;
let openIndex = null; // welches Popup ist offen?

function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/).find(l => l.trim().length) || "";
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    return semis > commas ? ";" : ",";
}

function parseCSV(text, delimiter) {
    const rows = [];
    let cur = "", inQuotes = false;
    let row = [];

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];

        if (c === '"' && next === '"') { cur += '"'; i++; continue; }
        if (c === '"') { inQuotes = !inQuotes; continue; }

        if (!inQuotes && c === delimiter) {
            row.push(cur);
            cur = "";
            continue;
        }

        if (!inQuotes && (c === "\n" || c === "\r")) {
            if (c === "\r" && next === "\n") i++;
            row.push(cur);
            cur = "";
            if (row.some(v => v.trim() !== "")) rows.push(row);
            row = [];
            continue;
        }

        cur += c;
    }

    row.push(cur);
    if (row.some(v => v.trim() !== "")) rows.push(row);

    return rows;
}

function cleanHeader(s) {
    return (s ?? "")
        .toString()
        .replace(/^\uFEFF/, "")
        .replace(/^"+|"+$/g, "")
        .trim()
        .toLowerCase();
}

function escapeHtml(s) {
    return (s ?? "").toString()
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function toMinecraftId(mc_id) {
    const v = (mc_id ?? "").toString().trim().toLowerCase();
    if (!v || v === "none") return "";
    return v.includes(":") ? v : `minecraft:${v}`;
}

function getIconDataUrl(mc_id) {
    if (!textureIndex) return "";
    const key = toMinecraftId(mc_id);
    if (!key) return "";
    const hit = textureIndex.items?.[key];
    return hit?.texture || "";
}

function buildCategoryOptions() {
    const cats = [...new Set(allData.map(r => r.kategorie).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "de"));

    $category.innerHTML =
        `<option value="">Alle Kategorien</option>` +
        cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function closePopup() {
    if (openIndex === null) return;
    const popup = document.getElementById(`popup-${openIndex}`);
    if (popup) popup.classList.add("hidden");
    openIndex = null;
}

function openPopup(index) {
    // vorheriges schließen
    if (openIndex !== null && openIndex !== index) {
        closePopup();
    }

    const popup = document.getElementById(`popup-${index}`);
    if (!popup) return;

    popup.classList.remove("hidden");
    openIndex = index;
}

function togglePopup(index) {
    if (openIndex === index) {
        closePopup();
    } else {
        openPopup(index);
    }
}

// Für inline onclick:
window.togglePopup = togglePopup;

function render() {
    const q = ($search?.value ?? "").trim().toLowerCase();
    const cat = $category?.value ?? "";

    const filtered = allData.filter(r =>
        (!q || r.item.toLowerCase().includes(q)) &&
        (!cat || r.kategorie === cat)
    );

    openIndex = null; // nach Render ist nichts offen

    $rows.innerHTML = filtered.map((r, index) => {
        const icon = getIconDataUrl(r.mc_id);
        const iconHtml = icon ? `<img src="${icon}" class="item-icon" alt="">` : "";

        const popupText = r.last_updated
            ? `Zuletzt aktualisiert: ${escapeHtml(r.last_updated)}`
            : "Kein Update-Datum gesetzt";

        return `
      <tr>
        <td>${iconHtml}${escapeHtml(r.item)}</td>
        <td>${escapeHtml(r.kategorie)}</td>
        <td class="right">
          <span class="price-clickable" data-index="${index}">
            <span class="price-text" onclick="togglePopup(${index})">
              ${escapeHtml(r.preis)} 🪙
            </span>
            <span id="popup-${index}" class="price-popup hidden">
              ${popupText}
            </span>
          </span>
        </td>
      </tr>
    `;
    }).join("");

    // Hover-close auf Desktop: wenn man den Preisbereich verlässt, schließen
    document.querySelectorAll(".price-clickable").forEach(el => {
        el.addEventListener("mouseleave", () => {
            // nur schließen, wenn dieses Element das offene Popup hat
            const idx = Number(el.dataset.index);
            if (openIndex === idx) closePopup();
        });
    });
}

async function loadTextures() {
    try {
        const res = await fetch(TEXTURES_URL, { cache: "force-cache" });
        if (!res.ok) return;
        textureIndex = await res.json();
    } catch {
        textureIndex = null;
    }
}

async function loadPrices() {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV nicht erreichbar");

    const csvText = await res.text();
    const delimiter = detectDelimiter(csvText);
    const grid = parseCSV(csvText, delimiter);

    if (grid.length < 2) throw new Error("CSV hat zu wenig Zeilen");

    const headers = grid[0].map(cleanHeader);

    const idxItem  = headers.findIndex(h => h === "item");
    const idxKat   = headers.findIndex(h => h === "kategorie");
    const idxPreis = headers.findIndex(h => h === "preis");
    const idxMc    = headers.findIndex(h => h === "mc_id");
    const idxLast  = headers.findIndex(h => h === "last_updated");

    if (idxItem === -1 || idxKat === -1 || idxPreis === -1) {
        throw new Error("Spalten fehlen: item | kategorie | preis");
    }

    allData = grid.slice(1)
        .map(row => ({
            item: (row[idxItem] ?? "").toString().trim(),
            kategorie: (row[idxKat] ?? "").toString().trim(),
            preis: (row[idxPreis] ?? "").toString().trim(),
            mc_id: idxMc !== -1 ? (row[idxMc] ?? "").toString().trim() : "",
            last_updated: idxLast !== -1 ? (row[idxLast] ?? "").toString().trim() : ""
        }))
        .filter(r => r.item);

    buildCategoryOptions();
}

// Klick irgendwo anders => schließen
document.addEventListener("click", (e) => {
    const clickedInside = e.target.closest && e.target.closest(".price-clickable");
    if (!clickedInside) closePopup();
});

// ESC => schließen
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopup();
});

async function init() {
    await loadPrices();
    await loadTextures();
    render();
}

$search?.addEventListener("input", () => { closePopup(); render(); });
$category?.addEventListener("change", () => { closePopup(); render(); });

init().catch(err => {
    console.error(err);
    $rows.innerHTML = `<tr><td colspan="3">Fehler beim Laden</td></tr>`;
});
