const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTvwCII49Sgr5l9MR_06qtKkvyEPf8ykapcXpBRX-wqavcIBkDcq3aUmCrSdM-t7pS8HwDOPQqXkRwb/pub?output=csv";

const $rows = document.getElementById("rows");
const $search = document.getElementById("search");
const $category = document.getElementById("category");

let allData = [];

function detectDelimiter(text) {
    const firstLine = text.split(/\r?\n/).find(l => l.trim().length) || "";
    const commas = (firstLine.match(/,/g) || []).length;
    const semis = (firstLine.match(/;/g) || []).length;
    return semis > commas ? ";" : ",";
}

function parseCSV(text, delimiter) {
    // CSV Parser mit Anführungszeichen-Unterstützung
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
    // trim, lower, remove quotes, remove weird spaces
    return (s ?? "")
        .toString()
        .replace(/^\uFEFF/, "")           // BOM
        .replace(/[“”„]/g, '"')           // fancy quotes -> normal
        .replace(/^"+|"+$/g, "")          // surrounding quotes
        .replace(/\s+/g, " ")             // collapse whitespace
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

function buildCategoryOptions() {
    const cats = [...new Set(allData.map(r => r.kategorie).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, "de"));

    $category.innerHTML =
        `<option value="">Alle Kategorien</option>` +
        cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function render() {
    const q = $search.value.trim().toLowerCase();
    const cat = $category.value;

    const filtered = allData.filter(r =>
        (!q || r.item.toLowerCase().includes(q)) &&
        (!cat || r.kategorie === cat)
    );

    $rows.innerHTML = filtered.map(r => `
    <tr>
      <td>${escapeHtml(r.item)}</td>
      <td>${escapeHtml(r.kategorie)}</td>
      <td class="right">${escapeHtml(r.preis)} 🪙</td>
    </tr>
  `).join("");
}

async function loadData() {
    const res = await fetch(SHEET_CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV nicht erreichbar (HTTP ${res.status})`);

    const csvText = await res.text();
    const delimiter = detectDelimiter(csvText);
    const grid = parseCSV(csvText, delimiter);

    if (grid.length < 2) throw new Error("CSV hat zu wenig Zeilen (Header + Daten fehlen).");

    const headers = grid[0].map(cleanHeader);

    const idxItem = headers.findIndex(h => h === "item");
    const idxKat  = headers.findIndex(h => h === "kategorie");
    const idxPreis = headers.findIndex(h => h === "preis");

    if (idxItem === -1 || idxKat === -1 || idxPreis === -1) {
        throw new Error(`Spalten nicht gefunden. Gefunden: ${headers.join(" | ")}`);
    }

    allData = grid.slice(1)
        .map(row => ({
            item: (row[idxItem] ?? "").toString().trim(),
            kategorie: (row[idxKat] ?? "").toString().trim(),
            preis: (row[idxPreis] ?? "").toString().trim(),
        }))
        .filter(r => r.item);

    buildCategoryOptions();
    render();
}

$search.addEventListener("input", render);
$category.addEventListener("change", render);

loadData().catch(err => {
    console.error(err);
    $rows.innerHTML = `<tr><td colspan="3">Fehler: ${escapeHtml(err.message)}</td></tr>`;
});
