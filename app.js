import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  firebaseConfig, COLLECTION, MAP_CENTER, MAP_ZOOM, STATUS_COLORS, DEFAULT_COLOR
} from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));
const colorOf = (status) => STATUS_COLORS[status] || DEFAULT_COLOR;
const fmtLuas = (n) => Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });

// ---------- Peta ----------
const map = L.map("map", { center: MAP_CENTER, zoom: MAP_ZOOM });

const basemaps = {
  "OpenStreetMap": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "&copy; OpenStreetMap contributors"
  }),
  "Citra Satelit (Esri)": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxZoom: 19, attribution: "Tiles &copy; Esri"
    }),
  "Topografi (OpenTopoMap)": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17, attribution: "&copy; OpenTopoMap, OpenStreetMap contributors"
  })
};
basemaps["OpenStreetMap"].addTo(map);
L.control.layers(basemaps, null, { position: "topright" }).addTo(map);
L.control.scale({ imperial: false }).addTo(map);

const legend = L.control({ position: "bottomright" });
legend.onAdd = () => {
  const div = L.DomUtil.create("div", "legend");
  div.innerHTML = "<b>Status kepemilikan</b>" +
    Object.entries(STATUS_COLORS).map(([s, c]) => `<div><i style="background:${c}"></i>${esc(s)}</div>`).join("") +
    `<div><i style="background:${DEFAULT_COLOR}"></i>Lainnya</div>`;
  return div;
};
legend.addTo(map);

const parcelGroup = L.featureGroup().addTo(map);
const layersById = new Map();

// ---------- Data ----------
let parcels = [];          // [{id, nib, nama_pemilik, luas, status, geometry}]
let firstLoad = true;
let isAdmin = false;

function parseDoc(d) {
  const data = d.data();
  let geometry = null;
  try { geometry = typeof data.geometry === "string" ? JSON.parse(data.geometry) : data.geometry; } catch { /* abaikan */ }
  return {
    id: d.id,
    nib: data.nib ?? d.id,
    nama_pemilik: data.nama_pemilik ?? "",
    luas: Number(data.luas) || 0,
    status: data.status ?? "",
    geometry
  };
}

onSnapshot(collection(db, COLLECTION), (snap) => {
  parcels = snap.docs.map(parseDoc).filter((p) => p.geometry);
  render();
  if (firstLoad && parcelGroup.getLayers().length) {
    map.fitBounds(parcelGroup.getBounds().pad(0.1));
    firstLoad = false;
  }
}, (err) => {
  $("count").textContent = "Gagal memuat data: " + err.message;
});

// ---------- Filter & render ----------
function filtered() {
  const q = $("q").value.trim().toLowerCase();
  const st = $("fStatus").value;
  return parcels.filter((p) =>
    (!st || p.status === st) &&
    (!q || String(p.nib).toLowerCase().includes(q) || p.nama_pemilik.toLowerCase().includes(q))
  );
}

function popupHtml(p) {
  return `<div class="popup">
    <table>
      <tr><td>NIB</td><td><b>${esc(p.nib)}</b></td></tr>
      <tr><td>Pemilik</td><td>${esc(p.nama_pemilik)}</td></tr>
      <tr><td>Luas</td><td>${fmtLuas(p.luas)} m²</td></tr>
      <tr><td>Status</td><td>${esc(p.status)}</td></tr>
    </table>
    <div class="btns admin-only">
      <button data-act="edit" data-id="${esc(p.id)}">Edit</button>
      <button data-act="del" class="danger" data-id="${esc(p.id)}">Hapus</button>
    </div>
  </div>`;
}

function render() {
  parcelGroup.clearLayers();
  layersById.clear();
  const list = filtered();

  list.forEach((p) => {
    const layer = L.geoJSON({ type: "Feature", properties: {}, geometry: p.geometry }, {
      style: () => ({ color: "#1f2933", weight: 1.5, fillColor: colorOf(p.status), fillOpacity: 0.55 })
    });
    layer.bindPopup(popupHtml(p));
    layer.bindTooltip(String(p.nib), { sticky: true });
    parcelGroup.addLayer(layer);
    layersById.set(p.id, layer);
  });

  $("count").textContent = `${list.length} dari ${parcels.length} bidang`;
  $("results").innerHTML = list.slice(0, 200).map((p) => `
    <li data-id="${esc(p.id)}">
      <div><b>${esc(p.nib)}</b> — ${esc(p.nama_pemilik)}</div>
      <div class="sub">${esc(p.status)} · ${fmtLuas(p.luas)} m²</div>
    </li>`).join("");
}

function fillStatusSelects() {
  const opts = Object.keys(STATUS_COLORS).map((s) => `<option>${esc(s)}</option>`).join("");
  $("fStatus").insertAdjacentHTML("beforeend", opts);
  $("fStat").innerHTML = opts;
}
fillStatusSelects();

$("q").addEventListener("input", render);
$("fStatus").addEventListener("change", render);

$("results").addEventListener("click", (e) => {
  const li = e.target.closest("li");
  if (!li) return;
  const layer = layersById.get(li.dataset.id);
  if (!layer) return;
  map.fitBounds(layer.getBounds().pad(0.5), { maxZoom: 19 });
  layer.openPopup(layer.getBounds().getCenter());
});

// ---------- Popup: Edit / Hapus ----------
map.on("popupopen", (e) => {
  e.popup.getElement().querySelectorAll("button[data-act]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const p = parcels.find((x) => x.id === btn.dataset.id);
      if (!p) return;
      map.closePopup();
      if (btn.dataset.act === "edit") openForm(p, true);
      if (btn.dataset.act === "del") {
        if (!confirm(`Hapus bidang NIB ${p.nib}?\n(Catatan: jika masih ada di Spreadsheet, data akan muncul lagi saat sinkronisasi berikutnya.)`)) return;
        try { await deleteDoc(doc(db, COLLECTION, p.id)); }
        catch (err) { alert("Gagal menghapus: " + err.message); }
      }
    });
  });
});

// ---------- Form tambah/edit ----------
let editing = null; // {id|null, geometry}

function openForm(p, isEdit) {
  editing = { id: isEdit ? p.id : null, geometry: p.geometry };
  $("formTitle").textContent = isEdit ? "Edit Bidang" : "Tambah Bidang";
  $("fNib").value = p.nib || "";
  $("fNib").readOnly = isEdit;
  $("fNama").value = p.nama_pemilik || "";
  $("fLuas").value = p.luas ?? "";
  $("fStat").value = p.status && STATUS_COLORS[p.status] ? p.status : Object.keys(STATUS_COLORS)[0];
  $("formErr").textContent = "";
  $("formDlg").showModal();
}

$("formCancel").addEventListener("click", () => $("formDlg").close());

$("parcelForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nib = $("fNib").value.trim();
  if (!nib || nib.includes("/")) { $("formErr").textContent = "NIB wajib diisi dan tidak boleh memuat karakter “/”."; return; }
  try {
    await setDoc(doc(db, COLLECTION, nib), {
      nib,
      nama_pemilik: $("fNama").value.trim(),
      luas: Number($("fLuas").value) || 0,
      status: $("fStat").value,
      geometry: JSON.stringify(editing.geometry),
      updated_at: serverTimestamp()
    }, { merge: true });
    $("formDlg").close();
  } catch (err) {
    $("formErr").textContent = "Gagal menyimpan: " + err.message;
  }
});

// ---------- Gambar poligon (admin) ----------
const drawControl = new L.Control.Draw({
  position: "topleft",
  draw: { polygon: { allowIntersection: false, showArea: false }, rectangle: true,
    polyline: false, circle: false, marker: false, circlemarker: false },
  edit: false
});
map.addControl(drawControl);

map.on(L.Draw.Event.CREATED, (e) => {
  const geometry = e.layer.toGeoJSON().geometry;
  const area = L.GeometryUtil.geodesicArea(e.layer.getLatLngs()[0]);
  openForm({ geometry, luas: Math.round(area * 100) / 100 }, false);
});

// ---------- Login admin ----------
$("btnLogin").addEventListener("click", () => { $("loginErr").textContent = ""; $("loginDlg").showModal(); });
$("loginCancel").addEventListener("click", () => $("loginDlg").close());
$("btnLogout").addEventListener("click", () => signOut(auth));

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    $("password").value = "";
    $("loginDlg").close();
  } catch {
    $("loginErr").textContent = "Email atau kata sandi salah.";
  }
});

onAuthStateChanged(auth, (user) => {
  isAdmin = !!user;
  document.body.classList.toggle("admin", isAdmin);
  $("btnLogin").hidden = isAdmin;
  $("btnLogout").hidden = !isAdmin;
});

// ---------- Ekspor & cetak ----------
function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
const stamp = () => new Date().toISOString().slice(0, 10);

$("btnGeojson").addEventListener("click", () => {
  const fc = {
    type: "FeatureCollection",
    features: filtered().map((p) => ({
      type: "Feature",
      properties: { nib: p.nib, nama_pemilik: p.nama_pemilik, luas: p.luas, status: p.status },
      geometry: p.geometry
    }))
  };
  download(`bidang-tanah-${stamp()}.geojson`, JSON.stringify(fc, null, 2), "application/geo+json");
});

$("btnCsv").addEventListener("click", () => {
  const cell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [["nib", "nama_pemilik", "luas", "status", "geometry"].join(",")];
  filtered().forEach((p) => rows.push(
    [p.nib, p.nama_pemilik, p.luas, p.status, JSON.stringify(p.geometry)].map(cell).join(",")
  ));
  download(`bidang-tanah-${stamp()}.csv`, "\ufeff" + rows.join("\n"), "text/csv;charset=utf-8");
});

$("btnPrint").addEventListener("click", () => {
  map.invalidateSize();
  setTimeout(() => window.print(), 200);
});
window.addEventListener("beforeprint", () => map.invalidateSize());
window.addEventListener("afterprint", () => map.invalidateSize());
