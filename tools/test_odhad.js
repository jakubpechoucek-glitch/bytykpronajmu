// Testy automatického odhadu ceny bytu: node tools/test_odhad.js
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const O = require("../js/odhad.js");
const blizko = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

// ---- spojení řad: základ + doplnění (nahrazuje chybějící čtvrtletí růstem doplňující řady)
const zaklad = [{ r: 2025, q: 1, idx: 100 }, { r: 2025, q: 2, idx: 102 }, { r: 2025, q: 3, idx: 104 }, { r: 2025, q: 4, idx: 106 }];
const dopl = [{ r: 2025, q: 3, idx: 200 }, { r: 2025, q: 4, idx: 210 }, { r: 2026, q: 1, idx: 220.5 }, { r: 2026, q: 2, idx: 231.525 }];
let rada = O.spojRadu(zaklad, dopl);
assert.strictEqual(rada.length, 6);
assert.deepStrictEqual(rada.map((x) => x.doplneno), [false, false, false, false, true, true]);
blizko(rada[4].idx, 106 * 220.5 / 210);
blizko(rada[5].idx, 106 * 231.525 / 210);
assert.strictEqual(O.spojRadu(zaklad, []).length, 4);
assert.strictEqual(O.spojRadu(zaklad, [{ r: 2026, q: 1, idx: 5 }]).length, 4); // žádné společné čtvrtletí → nepřipojuje
assert.deepStrictEqual(O.spojRadu([], dopl), []);

// ---- index k datu: lineárně mezi středy čtvrtletí (15. 2., 15. 5., …)
const r2 = [{ r: 2026, q: 1, idx: 100 }, { r: 2026, q: 2, idx: 110 }];
blizko(O.indexKDatu(r2, "2026-02-15").idx, 100);
blizko(O.indexKDatu(r2, "2026-05-15").idx, 110);
blizko(O.indexKDatu(r2, "2026-05-01").idx, 100 + 10 * 75 / 89);
assert.strictEqual(O.indexKDatu(r2, "2026-05-01").drzi, false);
assert.strictEqual(O.indexKDatu(r2, "2026-01-01").idx, 100);   // před první řadou
assert.strictEqual(O.indexKDatu(r2, "2026-09-01").idx, 110);   // za poslední drží poslední hodnotu
assert.strictEqual(O.indexKDatu(r2, "2026-09-01").drzi, true);
assert.strictEqual(O.indexKDatu([], "2026-01-01"), null);

// ---- měsíční odhady z posledního ručního odhadu
const byt = { id: "a", region_indexu: "praha" };
const ruc = [{ byt_id: "a", datum: "2026-02-15", cena_m2: 1000, zdroj: "Atlas cen" }];
let a = O.autoOdhady(byt, ruc, r2, "2026-05-20");
assert.deepStrictEqual(a.map((x) => x.datum), ["2026-03-01", "2026-04-01", "2026-05-01"]); // jen měsíce po kotvě, do nynějška
assert.strictEqual(a[2].cena_m2, Math.round(1000 * (100 + 10 * 75 / 89) / 100));            // 1084
assert.ok(a.every((x) => x.auto === true && x.zdroj === O.ZDROJ && x.byt_id === "a"));
assert.ok(a[0].cena_m2 < a[1].cena_m2 && a[1].cena_m2 < a[2].cena_m2);
// za posledním čtvrtletím se hodnota drží a označí
a = O.autoOdhady(byt, ruc, r2, "2026-09-10");
assert.strictEqual(a.find((x) => x.datum === "2026-08-01").drzi, true);
assert.strictEqual(a.find((x) => x.datum === "2026-09-01").cena_m2, 1100);
// novější ruční kotva přepočítává od sebe; automatické řádky se jako kotva neberou
const ruc2 = [...ruc, { byt_id: "a", datum: "2026-04-10", cena_m2: 1200, zdroj: "Atlas cen" }, { byt_id: "a", datum: "2026-05-01", cena_m2: 9999, auto: true }];
a = O.autoOdhady(byt, ruc2, r2, "2026-06-05");
assert.deepStrictEqual(a.map((x) => x.datum), ["2026-05-01", "2026-06-01"]);
assert.strictEqual(a[0].cena_m2, Math.round(1200 * (100 + 10 * 75 / 89) / (100 + 10 * 54 / 89))); // kotva 10. 4. → 54 dní od 15. 2.
// jen od roku 2026: starší měsíce se negenerují
const rokDo = O.autoOdhady(byt, [{ byt_id: "a", datum: "2025-04-03", cena_m2: 1000 }], [{ r: 2025, q: 1, idx: 100 }, { r: 2026, q: 2, idx: 120 }], "2026-02-10");
assert.deepStrictEqual(rokDo.map((x) => x.datum), ["2026-01-01", "2026-02-01"]);
// bez regionu / bez kotvy / bez řady = nic
assert.deepStrictEqual(O.autoOdhady({ id: "a" }, ruc, r2, "2026-05-20"), []);
assert.deepStrictEqual(O.autoOdhady(byt, [], r2, "2026-05-20"), []);
assert.deepStrictEqual(O.autoOdhady(byt, ruc, [], "2026-05-20"), []);
assert.deepStrictEqual(O.autoOdhady(byt, [{ byt_id: "jiny", datum: "2026-02-15", cena_m2: 1000 }], r2, "2026-05-20"), []);

// ---- stáří souboru
assert.strictEqual(O.stavIndexu(null, "2026-11-17").ok, false);
assert.strictEqual(O.stavIndexu({ stazeno: "2026-11-15", posledni_zaklad: "2025-Q4", posledni_doplneni: "2026-Q2" }, "2026-11-17").ok, true);
assert.ok(/4\. čtvrtletí 2025/.test(O.stavIndexu({ stazeno: "2026-11-15", posledni_zaklad: "2025-Q4", posledni_doplneni: "2026-Q2" }, "2026-11-17").text));
assert.strictEqual(O.stavIndexu({ stazeno: "2026-01-01", posledni_zaklad: "2025-Q4", posledni_doplneni: "2026-Q2" }, "2026-11-17").ok, false);

// ---- soubor, který stahuje skript, má očekávaný tvar
const f = path.join(__dirname, "..", "indexy", "ceny-bytu.json");
if (fs.existsSync(f)) {
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const rady = O.radyZeSouboru(j);
  assert.ok(rady.praha && rady.stredocesky);
  for (const k of ["praha", "stredocesky"]) {
    assert.ok(rady[k].length > 40, k);
    assert.ok(rady[k].every((x) => x.idx > 50 && x.idx < 800), k);
    assert.ok(rady[k].some((x) => x.doplneno), `${k}: doplnění prodlužuje řadu`);
  }
  assert.ok(j.stazeno && j.posledni_zaklad && j.posledni_doplneni);
}

console.log("test_odhad: OK");
