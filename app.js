const SHEET_CSV_URL = "";

const $rows = document.getElementById("rows");
const $search = document.getElementById("search");
const $category = document.getElementById("category");

let allData = [];

function parseCSV(text) {
    return text.trim().split("\n").map(row => row.split(","));
}

function loadData() {
    fetch(SHEET_CSV_URL, { cache: "no-store" })
        .then(res => res.text())
        .then(csv => {
            const data = parseCSV(csv);
            const headers = data[0].map(h => h.toLowerCase());

            const itemIndex = headers.indexOf("item");
            const katIndex = headers.indexOf("kategorie");
            const preisIndex = headers.indexOf("preis");

            allData = data.slice(1).map(row => ({
                item: row[itemIndex],
                kategorie: row[katIndex],
                preis: row[preisIndex]
            }));

            buildCategoryOptions();
            render();
        });
}

function buildCategoryOptions() {
    const cats = [...new Set(allData.map(r => r.kategorie))];
    $category.innerHTML =
        `<option value="">Alle Kategorien</option>` +
        cats.map(c => `<option value="${c}">${c}</option>`).join("");
}

function render() {
    const search = $search.value.toLowerCase();
    const cat = $category.value;

    const filtered = allData.filter(r =>
        (!search || r.item.toLowerCase().includes(search)) &&
        (!cat || r.kategorie === cat)
    );

    $rows.innerHTML = filtered.map(r => `
    <tr>
      <td>${r.item}</td>
      <td>${r.kategorie}</td>
      <td class="right">${r.preis} 🪙</td>
    </tr>
  `).join("");
}

$search.addEventListener("input", render);
$category.addEventListener("change", render);

loadData();
