// Testy vyúčtování záloh: node tools/test_vyuctovani.js
// Čísla jsou smyšlená, ale mají stejnou strukturu jako skutečná vyúčtování.
const assert = require("assert");
const V = require("../js/vyuctovani.js");

assert.strictEqual(V.pocetDni("2025-01-01", "2025-12-31"), 365);
assert.strictEqual(V.pocetDni("2025-06-01", "2025-12-31"), 214);
assert.strictEqual(V.pocetMesicu("2025-06-01", "2025-12-31"), 7);
assert.strictEqual(V.pocetMesicu("2025-01-01", "2025-12-31"), 12);

// měřič: konečný − počáteční stav, krát cena
assert.strictEqual(V.spotreba({ stav_od: 100, stav_do: 129.7 }), 29.7);
assert.strictEqual(V.naklad({ typ: "meridlo", stav_od: 100, stav_do: 130, cena: 300 }), 9000);
assert.strictEqual(V.naklad({ typ: "meridlo", spotreba: 10, cena: 2.5 }), 25);
assert.strictEqual(V.naklad({ typ: "den", cena: 61.14, dny: 213 }), 13022.82);
assert.strictEqual(V.naklad({ typ: "odpocet", castka: 1000 }), -1000);

// celý rok, záloha 4 500 × 12, odečet fondu oprav
const v = {
  zaloha_mesic: 4500, mesicu: 12,
  polozky: [
    { typ: "meridlo", stav_od: 10, stav_do: 40, cena: 300 },   // 9 000
    { typ: "den", cena: 80, dny: 365 },                        // 29 200
    { typ: "castka", castka: 15000 },                          // SVJ
    { typ: "odpocet", castka: 5000 },                          // fond oprav
  ],
};
let r = V.vypocet(v);
assert.strictEqual(r.naklady, 53200);
assert.strictEqual(r.odpocty, -5000);
assert.strictEqual(r.celkem, 48200);
assert.strictEqual(r.zalohy, 54000);
assert.strictEqual(r.rozdil, 5800);
assert.ok(r.preplatek && !r.nedoplatek);

// nedoplatek, ruční zálohy celkem (záloha se měnila)
r = V.vypocet({ zalohy_celkem: 40000, zaloha_mesic: 1, mesicu: 1, polozky: [{ typ: "castka", castka: 48200 }] });
assert.strictEqual(r.rozdil, -8200);
assert.ok(r.nedoplatek);

// prázdné vyúčtování se nesmí rozbít
r = V.vypocet({});
assert.strictEqual(r.celkem, 0);

// zálohy podle smluv: změna zálohy od března
const smlouvy = [
  { id: 1, najemce: "A", od: "2024-01-01", do: "2025-02-28", zaloha_mesic: 4000 },
  { id: 2, najemce: "A", od: "2025-03-01", do: null, zaloha_mesic: 4500 },
];
let z = V.zalohyPodleSmluv(smlouvy, "2025-01-01", "2025-12-31");
assert.strictEqual(z.mesicu, 12);
assert.strictEqual(z.zalohy_celkem, 2 * 4000 + 10 * 4500);
assert.ok(z.promenliva);
z = V.zalohyPodleSmluv(smlouvy, "2025-06-01", "2025-12-31");
assert.strictEqual(z.mesicu, 7);
assert.strictEqual(z.zaloha_mesic, 4500);
assert.ok(!z.promenliva);
// bez smlouvy
z = V.zalohyPodleSmluv([], "2025-01-01", "2025-12-31");
assert.strictEqual(z.mesicu, 0);

// navrhované období: nájemce A končí uprostřed roku, B navazuje od 1.6.
const sm2 = [
  { najemce: "A", od: "2024-03-01", do: "2025-05-31" },
  { najemce: "B", od: "2025-06-01", do: null },
];
let o = V.navrhObdobi(sm2, [], "2026-03-01");
assert.deepStrictEqual(o, { od: "2024-03-01", do: "2024-12-31" });
o = V.navrhObdobi(sm2, [{ do: "2024-12-31" }], "2026-03-01");
assert.deepStrictEqual(o, { od: "2025-01-01", do: "2025-05-31" }); // končí smlouva A
o = V.navrhObdobi(sm2, [{ do: "2025-05-31" }], "2026-03-01");
assert.deepStrictEqual(o, { od: "2025-06-01", do: "2025-12-31" }); // nový nájemce od června
assert.strictEqual(V.navrhObdobi(sm2, [{ do: "2025-12-31" }], "2026-03-01"), null); // 2026 ještě neskončil
// dodatek téhož nájemce prodlužuje smlouvu → neukončí období
const sm3 = [{ najemce: "A", od: "2024-01-01", do: "2025-02-28" }, { najemce: "A", od: "2025-03-01", do: "2026-12-31" }];
o = V.navrhObdobi(sm3, [{ do: "2024-12-31" }], "2026-03-01");
assert.deepStrictEqual(o, { od: "2025-01-01", do: "2025-12-31" });

// přesná částka z dokladu přepíše výpočet
assert.strictEqual(V.naklad({ typ: "meridlo", spotreba: 27.79, cena: 349.45, naklad_rucne: 9711.2 }), 9711.2);
// ukončení nájmu: nedoplatek + kauce − srážky = k vrácení
r = V.vypocet({ zaloha_mesic: 100, mesicu: 5, polozky: [
  { typ: "castka", castka: 1000 },
  { typ: "kauce", castka: 3000 },
  { typ: "srazka", castka: 1200 },
  { typ: "srazka", castka: 500 },
] });
assert.strictEqual(r.celkem, 1000);          // kauce a srážky nejsou náklad
assert.strictEqual(r.rozdil, -500);           // 500 záloh − 1000 nákladů
assert.strictEqual(r.vyrovnani, 1300);
assert.strictEqual(r.kVraceni, 800);

console.log("Vyúčtování: všechny testy prošly.");
