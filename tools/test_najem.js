// Testy podkladu pro nové nájemné: node tools/test_najem.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const N = require("../js/najem.js");

// Čísla jsou smyšlená, jen kopírují postup výpočtu (aktuální nájem × index, Kč/m² × plocha).
const cpi = { stazeno: "2026-11-15", posledni_mesic: "2026-10", mesice: [{ m: "2026-09", idx: 105.0 }, { m: "2026-10", idx: 106.1 }] };
const byt = { id: "a", nazev: "A", plocha_m2: 100 };
const data = {
  byty: [byt, { id: "b", nazev: "B", plocha_m2: 50 }],
  pronajmy: [
    { byt_id: "a", najemce: "X", od: "2025-01-01", do: "2027-01-31", najem_mesic: 30000, typ: "smlouva" },
    { byt_id: "b", najemce: "Y", od: "2025-01-01", do: "2026-12-31", najem_mesic: 20000, typ: "smlouva" },
  ],
  najem_trh: [
    { id: 1, byt_id: "a", datum: "2026-04-01", zdroj: "deloitte", kc_m2: 400 },
    { id: 2, byt_id: "a", datum: "2026-07-01", zdroj: "deloitte", kc_m2: 450 },
    { id: 3, byt_id: "a", datum: "2026-07-01", zdroj: "mf", kc_m2: 420, poznamka: "novostavba" },
  ],
  najem_navrhy: [],
};

// poslední index
assert.strictEqual(N.posledniIndex(cpi).idx, 106.1);
assert.strictEqual(N.posledniIndex(null), null);

// podklad: inflace 30000 × 1,061 = 31830; trh: nejnovější údaj z každého zdroje
const p = N.podklad(byt, data, cpi, "2026-11-17");
assert.strictEqual(p.akt.najem, 30000);
assert.strictEqual(p.akt.kcM2, 300);
const inf = p.varianty.find((v) => v.klic === "inflace");
assert.strictEqual(inf.castka, 31830);
assert.ok(Math.abs(inf.rozdil - 0.061) < 1e-9);
const del = p.varianty.find((v) => v.klic === "deloitte");
assert.strictEqual(del.kcM2, 450); // starší údaj (400) se nepoužije
assert.strictEqual(del.castka, 45000);
assert.strictEqual(p.varianty.find((v) => v.klic === "mf").castka, 42000);
assert.strictEqual(del.stare, true); // 1. 7. → 17. 11. = 139 dní > 135 → zastaralé
assert.strictEqual(p.varianty.find((v) => v.klic === "mf").stare, true);
const cerstve = N.podklad(byt, data, cpi, "2026-08-15");
assert.strictEqual(cerstve.varianty.find((v) => v.klic === "deloitte").stare, false);

// konec smlouvy: A končí za 75 dní → k řešení; B za 44 dní taky, ale dřív
assert.strictEqual(p.akt.dnuDoKonce, 75);
assert.strictEqual(p.kReseni, true);
assert.strictEqual(N.podklad(byt, data, cpi, "2026-05-01").kReseni, false);
const poradi = N.poradiPodleKonce(data, cpi, "2026-11-17").map((x) => x.byt.id);
assert.deepStrictEqual(poradi, ["b", "a"]);

// byt bez tržních dat: jen inflace, bez pádu
const pb = N.podklad(data.byty[1], data, cpi, "2026-11-17");
assert.deepStrictEqual(pb.varianty.map((v) => v.klic), ["inflace"]);
assert.strictEqual(pb.varianty[0].castka, 21220);

// byt bez smlouvy: nic nepočítá z nájmu, ale nespadne
const bez = N.podklad({ id: "z", plocha_m2: 40 }, { ...data, byty: [], najem_trh: [{ byt_id: "z", datum: "2026-10-01", zdroj: "mf", kc_m2: 500 }] }, cpi, "2026-11-17");
assert.strictEqual(bez.akt, null);
assert.strictEqual(bez.varianty.length, 1);
assert.strictEqual(bez.varianty[0].castka, 20000);
assert.strictEqual(bez.varianty[0].rozdil, null);

// návrh: nejnovější podle data platnosti; rozdíl proti nynějšímu nájmu
const s2 = { ...data, najem_navrhy: [
  { id: 1, byt_id: "a", plati_od: "2026-01-01", navrh: 31000, stav: "odeslano" },
  { id: 2, byt_id: "a", plati_od: "2027-02-01", navrh: 33000, stav: "navrh" },
] };
const pn = N.podklad(byt, s2, cpi, "2026-11-17");
assert.strictEqual(pn.navrh.navrh, 33000);
assert.ok(Math.abs(pn.navrhRozdil - 0.1) < 1e-9);
assert.strictEqual(pn.navrhKcM2, 330);
assert.strictEqual(pn.vyreseno, false);
assert.strictEqual(pn.kReseni, true);
// schválený návrh s budoucím datem → už se nehlásí jako „k řešení“
const s3 = { ...data, najem_navrhy: [{ id: 3, byt_id: "a", plati_od: "2027-02-01", navrh: 33000, stav: "schvaleno" }] };
const ps = N.podklad(byt, s3, cpi, "2026-11-17");
assert.strictEqual(ps.vyreseno, true);
assert.strictEqual(ps.kReseni, false);
// tržní variantě zůstane id řádku (kvůli úpravě v aplikaci)
assert.strictEqual(p.varianty.find((v) => v.klic === "mf").id, 3);

// stáří dat ČSÚ
assert.strictEqual(N.stavCpi(cpi, "2026-11-17").ok, true);
assert.strictEqual(N.stavCpi(cpi, "2027-02-01").ok, false);
assert.strictEqual(N.stavCpi(null, "2026-11-17").ok, false);

// soubor, který stahuje Actions, má očekávaný tvar
const f = path.join(__dirname, "..", "indexy", "najemne-cpi.json");
if (fs.existsSync(f)) {
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  assert.ok(j.mesice.length > 60 && j.stazeno && j.posledni_mesic);
  assert.strictEqual(j.mesice[j.mesice.length - 1].m, j.posledni_mesic);
  assert.ok(N.posledniIndex(j).idx > 90 && N.posledniIndex(j).idx < 160);
}

// termíny čtvrtletních dat: 20. 2., 5., 8., 11.
const tr = (datum) => (datum ? [{ byt_id: "a", datum, zdroj: "mf", kc_m2: 400 }] : []);
let tt = N.terminyTrhu(tr("2026-10-01"), "2026-11-17");
assert.strictEqual(tt.posledni, "2026-08-20");
assert.strictEqual(tt.dalsi, "2026-11-20");
assert.strictEqual(tt.dniDoDalsiho, 3);
assert.strictEqual(tt.splatne, false); // zapsáno 1. 10., termín 20. 8. je už pokrytý
tt = N.terminyTrhu(tr("2026-10-01"), "2026-11-21"); // termín 20. 11. nastal, zápis z 1. 10. je starý
assert.strictEqual(tt.posledni, "2026-11-20");
assert.strictEqual(tt.splatne, true);
tt = N.terminyTrhu(tr("2026-11-10"), "2026-11-21"); // zápis krátce před termínem se počítá
assert.strictEqual(tt.splatne, false);
tt = N.terminyTrhu(tr("2026-11-01"), "2026-11-21"); // víc než 14 dní před termínem už ne
assert.strictEqual(tt.splatne, true);
assert.strictEqual(N.terminyTrhu([], "2026-11-17").splatne, true);
tt = N.terminyTrhu(tr("2026-11-25"), "2027-01-05"); // přechod roku
assert.strictEqual(tt.posledni, "2026-11-20");
assert.strictEqual(tt.dalsi, "2027-02-20");
assert.strictEqual(tt.splatne, false);

console.log("test_najem: OK");
