// Testy výpočtů: node tools/test_finance.js
const assert = require("assert");
const F = require("../js/finance.js");
const blizko = (a, b, tol = 1e-4) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`);

// XIRR: −1000 dnes, +1100 za 365 dní → 10 %
blizko(F.xirr([{ d: "2020-01-01", v: -1000 }, { d: "2020-12-31", v: 1100 }]), 0.1);
// bez kladného toku nelze
assert.strictEqual(F.xirr([{ d: "2020-01-01", v: -1000 }]), null);

// CAGR: zdvojnásobení za 10 let
blizko(F.cagr(100, 200, 10), Math.pow(2, 0.1) - 1);

const byt = { id: "a", porizeni_datum: "2020-01-01", porizeni_cena: 1000000, plocha_m2: 50 };
// odpisy skupina 5: 1. rok 1,4 %, 2.–30. rok 3,4 %, pak nic
assert.strictEqual(F.odpis(byt, 2020), 14000);
assert.strictEqual(F.odpis(byt, 2021), 34000);
assert.strictEqual(F.odpis(byt, 2049), 34000);
assert.strictEqual(F.odpis(byt, 2050), 0);

// hodnota: lineárně mezi pořízením a odhadem, pak konstantní
const odhady = [{ byt_id: "a", datum: "2022-01-01", cena_m2: 40000 }]; // 2 mil.
blizko(F.hodnotaKDatu(byt, odhady, "2021-01-01"), 1500000, 2000);
assert.strictEqual(F.hodnotaKDatu(byt, odhady, "2030-01-01"), 2000000);
assert.strictEqual(F.hodnotaKDatu(byt, odhady, "2019-01-01"), 0);

// souhrn: yield z 12 zapsaných měsíců, aktivní smlouva, IRR
const najemne = [];
for (let m = 1; m <= 12; m++) najemne.push({ byt_id: "a", mesic: `2021-${String(m).padStart(2, "0")}-01`, castka: 5000 });
const data = { byty: [byt], odhady, najemne, inflace: [{ rok: 2021, mira: 0.038 }], hypoteky: [],
  pronajmy: [{ byt_id: "a", najemce: "X", od: "2021-01-01", do: "2023-12-31", najem_mesic: 5000 }] };
const s = F.souhrnBytu(byt, data, "2022-06-01");
blizko(s.yield12, 0.06);
assert.strictEqual(s.najemMesic, 5000);
assert.ok(s.irr > 0.4 && s.irr < 0.5, `IRR ${s.irr}`);
const r2021 = F.rocniPrehled(byt, data, "2022-06-01").find((r) => r.rok === 2021);
blizko(r2021.yieldReal, 1.06 / 1.038 - 1);

// upozornění: smlouva končí do 90 dnů
const u = F.upozorneni(data, "2023-11-01");
assert.ok(u.some((x) => /končí/.test(x.text)));

console.log("finance: OK");
