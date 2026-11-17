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
  assert.ok(j.obecna && j.obecna.length > 60 && j.posledni_mesic_obecna);
  assert.ok(N.posledniObecna(j).idx > 90 && N.posledniObecna(j).idx < 130);
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

// ---- inflační doložka (zvýšení po prvním roce)
const cpi2 = { ...cpi, obecna: [{ m: "2026-09", idx: 102.0 }, { m: "2026-10", idx: 102.4 }], posledni_mesic_obecna: "2026-10" };
const sm = (extra = {}) => ({ byt_id: "d", najemce: "X", od: "2026-01-01", do: "2027-12-31", najem_mesic: 22000, typ: "smlouva", inflacni_dolozka: true, ...extra });
const dd = (pron, navrhy = []) => ({ byty: [{ id: "d", nazev: "D", plocha_m2: 50 }], pronajmy: pron, najem_trh: [], najem_navrhy: navrhy, hypoteky: [] });
const byD = (x) => x.byty[0];
assert.strictEqual(N.posledniObecna(cpi2).idx, 102.4);
assert.strictEqual(N.posledniObecna(cpi), null);

// 2letá smlouva od 1. 1. 2026: zvýšení lze od 1. 1. 2027, začít 1. 10., odeslat do 1. 11.
let dl = N.dolozka(byD(dd([sm()])), dd([sm()]), cpi2, "2026-11-17");
assert.strictEqual(dl.datum, "2027-01-01");
assert.strictEqual(dl.zacit, "2026-10-01");
assert.strictEqual(dl.odeslat, "2026-11-01");
assert.strictEqual(dl.dniDoDatumu, 45);
assert.strictEqual(dl.poTerminu, true);   // 1. 11. už uplynulo
assert.strictEqual(dl.kReseni, true);
assert.strictEqual(dl.vyreseno, false);
// před začátkem řešení se nehlásí
dl = N.dolozka(byD(dd([sm()])), dd([sm()]), cpi2, "2026-09-30");
assert.strictEqual(dl.kReseni, false);
assert.strictEqual(dl.poTerminu, false);
// smlouva začínající uprostřed roku: první výročí
dl = N.dolozka(byD(dd([sm({ od: "2026-06-01", do: "2028-05-31" })])), dd([sm({ od: "2026-06-01", do: "2028-05-31" })]), cpi2, "2026-11-17");
assert.strictEqual(dl.datum, "2027-06-01");
assert.strictEqual(dl.zacit, "2027-03-01");
assert.strictEqual(dl.kReseni, false);
// ručně zadané datum má přednost
const dz = dd([sm({ zvyseni_od: "2027-02-01" })]);
assert.strictEqual(N.dolozka(byD(dz), dz, cpi2, "2026-11-17").datum, "2027-02-01");
// konec měsíce: −3 měsíce od 31. 5. je 28. 2.
const dk = dd([sm({ od: "2026-05-31", do: "2028-05-30" })]);
assert.strictEqual(N.dolozka(byD(dk), dk, cpi2, "2026-11-17").zacit, "2027-02-28");
// roční smlouva: do jejího konce už zvýšení nenastane
const d1 = dd([sm({ do: "2026-12-31" })]);
assert.strictEqual(N.dolozka(byD(d1), d1, cpi2, "2026-11-17"), null);
// bez doložky nic
const dn = dd([sm({ inflacni_dolozka: false })]);
assert.strictEqual(N.dolozka(byD(dn), dn, cpi2, "2026-11-17"), null);
// vyřešeno: schválený návrh k datu zvýšení, nebo už platící dodatek
const dv = dd([sm()], [{ id: 1, byt_id: "d", plati_od: "2027-01-01", navrh: 23000, stav: "schvaleno" }]);
assert.strictEqual(N.dolozka(byD(dv), dv, cpi2, "2026-11-17").vyreseno, true);
assert.strictEqual(N.dolozka(byD(dv), dv, cpi2, "2026-11-17").kReseni, false);
const dv2 = dd([sm(), sm({ od: "2027-01-01", typ: "dodatek", najem_mesic: 23000 })]);
assert.strictEqual(N.dolozka(byD(dv2), dv2, cpi2, "2026-11-17").vyreseno, true);
const dnv = dd([sm()], [{ id: 1, byt_id: "d", plati_od: "2027-01-01", navrh: 23000, stav: "navrh" }]);
assert.strictEqual(N.dolozka(byD(dnv), dnv, cpi2, "2026-11-17").vyreseno, false); // jen návrh nestačí

// podklad: obě inflace vedle sebe (nájmy +6,1 %, obecná +2,4 %), příznak k řešení
const dp = N.podklad(byD(dd([sm()])), dd([sm()]), cpi2, "2026-11-17");
assert.strictEqual(dp.varianty.find((v) => v.klic === "inflace").castka, 23342);
assert.strictEqual(dp.varianty.find((v) => v.klic === "obecna").castka, 22528);
assert.strictEqual(dp.kReseni, true);
assert.strictEqual(N.podklad(byD(dn), dn, cpi2, "2026-11-17").varianty.some((v) => v.klic === "obecna"), false);

// upozornění a termíny
const up = N.upozorneniDolozky(dd([sm()]), cpi2, "2026-11-17");
assert.strictEqual(up.length, 1);
assert.strictEqual(up[0].uroven, "chyba");
assert.strictEqual(up[0].typ, "dolozka");
assert.strictEqual(N.upozorneniDolozky(dd([sm()]), cpi2, "2026-09-30").length, 0);
const tm = N.terminy(dd([sm()]), cpi2, "2026-11-17");
assert.deepStrictEqual(tm.map((x) => x.typ), ["trh", "dolozka-zacit", "dolozka-odeslat", "dolozka", "konec"]); // trh: zmeškaný termín 20. 8., data nikdy nezapsána
assert.ok(tm.every((x, i) => i === 0 || tm[i - 1].datum <= x.datum));
assert.strictEqual(tm.find((x) => x.typ === "dolozka-odeslat").dni, -16);
assert.strictEqual(N.terminy(dv, cpi2, "2026-11-17").some((x) => x.typ.startsWith("dolozka")), false); // vyřešené se nehlídá

console.log("test_najem: OK");
