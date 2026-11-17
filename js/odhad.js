// Automatický odhad tržní ceny bytu z indexu ČSÚ – čisté funkce bez DOM (testy: node tools/test_odhad.js).
// Odhad(datum) = poslední ručně zadaný odhad (kotva) × index(datum) / index(datum kotvy).
// Data: indexy/ceny-bytu.json (stahuje tools/stahni_index_cen_bytu.py), viz docs/12-odhad-trzni-ceny.md.
(function (root) {
  "use strict";

  const F = root.Finance || require("./finance.js");
  const ZDROJ = "Automatický odhad (index ČSÚ)";
  const REGIONY = { praha: "Praha", stredocesky: "Středočeský kraj" };

  const klic = (x) => x.r * 4 + (x.q - 1);
  // index čtvrtletí platí uprostřed čtvrtletí (15. den prostředního měsíce)
  const stred = (x) => Date.UTC(x.r, (x.q - 1) * 3 + 1, 15);

  // Základní řada (kraj) prodloužená o čtvrtletí, která v ní chybí, růstem doplňující řady.
  // zaklad, doplneni: [{ r, q, idx }] seřazené od nejstaršího.
  function spojRadu(zaklad, doplneni) {
    if (!zaklad || !zaklad.length) return [];
    const out = zaklad.map((x) => ({ r: x.r, q: x.q, idx: x.idx, doplneno: false }));
    if (!doplneni || !doplneni.length) return out;
    const dop = new Map(doplneni.map((x) => [klic(x), x.idx]));
    // nejnovější čtvrtletí, které mají obě řady
    const spolecne = zaklad.filter((x) => dop.has(klic(x))).pop();
    if (!spolecne) return out;
    const posl = klic(zaklad[zaklad.length - 1]);
    for (const d of doplneni) {
      if (klic(d) > posl) out.push({ r: d.r, q: d.q, idx: spolecne.idx * d.idx / dop.get(klic(spolecne)), doplneno: true });
    }
    return out;
  }

  // Index k datu: lineárně mezi středy čtvrtletí; před první řadou první hodnota, za poslední drží poslední (drzi = true).
  function indexKDatu(rada, datum) {
    if (!rada || !rada.length) return null;
    const t = F.d(datum).getTime();
    const b = rada.map((x) => ({ t: stred(x), x }));
    if (t <= b[0].t) return { idx: b[0].x.idx, drzi: false, doplneno: !!b[0].x.doplneno };
    const posl = b[b.length - 1];
    if (t >= posl.t) return { idx: posl.x.idx, drzi: t > posl.t, doplneno: !!posl.x.doplneno, ctvrtleti: `${posl.x.q}Q ${posl.x.r}` };
    let i = 0;
    while (b[i + 1].t < t) i++;
    const w = (t - b[i].t) / (b[i + 1].t - b[i].t);
    return { idx: b[i].x.idx + w * (b[i + 1].x.idx - b[i].x.idx), drzi: false, doplneno: !!(b[i].x.doplneno || b[i + 1].x.doplneno) };
  }

  const iso = (ms) => new Date(ms).toISOString().slice(0, 10);

  // Měsíční odhady (k 1. dni měsíce) od rokOd do nynějšího měsíce, počítané z posledního ručního odhadu bytu.
  // odhady: řádky tabulky odhady (ruční; automatické se ignorují). rada: výsledek spojRadu pro region bytu.
  function autoOdhady(byt, odhady, rada, dnes, rokOd = 2026) {
    if (!byt.region_indexu || !rada || !rada.length) return [];
    const kotvy = odhady.filter((o) => o.byt_id === byt.id && !o.auto && F.num(o.cena_m2) !== null)
      .sort((a, b) => (String(a.datum) < String(b.datum) ? -1 : 1));
    if (!kotvy.length) return [];
    const kotva = kotvy[kotvy.length - 1];
    const idxK = indexKDatu(rada, kotva.datum);
    const t = F.d(dnes);
    const out = [];
    for (let y = rokOd; y <= t.getUTCFullYear(); y++) {
      for (let m = 0; m < 12; m++) {
        const ms = Date.UTC(y, m, 1);
        if (ms > t.getTime() || ms <= F.d(kotva.datum).getTime()) continue;
        const idxM = indexKDatu(rada, iso(ms));
        out.push({
          byt_id: byt.id, datum: iso(ms), cena_m2: Math.round(F.num(kotva.cena_m2) * idxM.idx / idxK.idx),
          zdroj: ZDROJ, auto: true, drzi: idxM.drzi, doplneno: idxM.doplneno, region: byt.region_indexu,
        });
      }
    }
    return out;
  }

  // Řady podle regionu z obsahu indexy/ceny-bytu.json
  function radyZeSouboru(json) {
    const out = {};
    if (!json || !json.kraje) return out;
    for (const k of Object.keys(json.kraje)) out[k] = spojRadu(json.kraje[k], (json.doplneni || {})[k]);
    return out;
  }

  // Stav souboru s indexem (stáří dat)
  function stavIndexu(json, dnes) {
    if (!json) return { ok: false, text: "Index cen bytů ČSÚ se nepodařilo načíst." };
    const dni = Math.round((F.d(dnes) - F.d(json.stazeno)) / 864e5);
    if (dni > 150) return { ok: false, text: `Index cen bytů ČSÚ je starý ${dni} dní (stažen ${F.fmtDatum(json.stazeno)}). Zkontroluj měsíční stahování na GitHubu (záložka Actions).` };
    const fq = (s) => { const m = /(\d{4})-Q(\d)/.exec(String(s)); return m ? `${m[2]}. čtvrtletí ${m[1]}` : String(s); };
    return { ok: true, text: `ČSÚ, základ do ${fq(json.posledni_zaklad)}, doplněno do ${fq(json.posledni_doplneni)}, stažen ${F.fmtDatum(json.stazeno)}` };
  }

  const Odhad = { ZDROJ, REGIONY, spojRadu, indexKDatu, autoOdhady, radyZeSouboru, stavIndexu };
  root.Odhad = Odhad;
  if (typeof module !== "undefined") module.exports = Odhad;
})(typeof window !== "undefined" ? window : globalThis);
