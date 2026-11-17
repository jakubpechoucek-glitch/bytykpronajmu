// Podklad pro nové nájemné – čisté funkce bez DOM (testy: node tools/test_najem.js).
// Vstupy: řádky tabulek byty, pronajmy, najem_trh, najem_navrhy a soubor indexy/najemne-cpi.json.
(function (root) {
  "use strict";

  const F = root.Finance || require("./finance.js");
  const DEN = 86400000;

  const ZDROJE = {
    deloitte: "Deloitte Rent Index",
    mf: "Ministerstvo financí – cenová mapa",
    jiny: "Jiný zdroj",
  };

  // Kolik dní před koncem smlouvy se podklad považuje za „k řešení“
  const DNI_PRED_KONCEM = 120;
  // Tržní data starší než tolik dní se označí jako zastaralá (zdroje vycházejí čtvrtletně)
  const DNI_STARE_TRHU = 135;

  const zaokr = (v) => (v === null || v === undefined || !isFinite(v) ? null : Math.round(v));
  const rozdil = (nova, stara) => (stara ? (nova - stara) / stara : null);

  // ------------------------------------------------------------ kdy zapisovat čtvrtletní tržní data
  // Cenovou mapu MF zveřejňuje ministerstvo nejpozději 45 dnů po konci čtvrtletí (vyhláška 456/2024 Sb.),
  // tj. do 14.–15. 2., 5., 8. a 11. Termín zápisu je 20. – s malou rezervou. U Deloitte Rent Indexu
  // neznáme pevné datum vydání, proto se řídíme stejným termínem.
  const TERMINY_TRHU = [[2, 20], [5, 20], [8, 20], [11, 20]]; // [měsíc, den]
  const REZERVA_ZAPISU = 14; // zápis do 14 dnů před termínem se ještě počítá za nynější kolo

  function terminyTrhu(trhRadky, dnes) {
    const t = F.d(dnes);
    const y = t.getUTCFullYear();
    const vse = [];
    for (const yy of [y - 1, y, y + 1]) for (const [m, dd] of TERMINY_TRHU) vse.push(new Date(Date.UTC(yy, m - 1, dd)));
    vse.sort((a, b) => a - b);
    const posledni = vse.filter((x) => x <= t).pop();
    const dalsi = vse.find((x) => x > t);
    const datumy = (trhRadky || []).map((r) => String(r.datum).slice(0, 10)).sort();
    const poslZapis = datumy.length ? datumy[datumy.length - 1] : null;
    const splatne = !poslZapis || F.d(poslZapis) < new Date(posledni.getTime() - REZERVA_ZAPISU * DEN);
    return {
      posledni: F.iso(posledni), dalsi: F.iso(dalsi), poslZapis, splatne,
      dniDoDalsiho: Math.round((dalsi - t) / DEN),
      dniOdTerminu: Math.round((t - posledni) / DEN),
    };
  }

  // ------------------------------------------------------------ inflace nájmů (ČSÚ)
  // cpi = obsah indexy/najemne-cpi.json: { stazeno, posledni_mesic, mesice: [{ m: "2026-10", idx: 106.4 }] }
  function posledniIndex(cpi) {
    if (!cpi || !cpi.mesice || !cpi.mesice.length) return null;
    const p = cpi.mesice[cpi.mesice.length - 1];
    return { mesic: p.m, idx: p.idx, koef: p.idx / 100 };
  }

  // Stáří dat ČSÚ: soubor se obnovuje měsíčně, nejnovější měsíc je zpožděný ~6 týdnů
  function stavCpi(cpi, dnes) {
    if (!cpi) return { ok: false, text: "Data ČSÚ se nepodařilo načíst." };
    const t = F.d(dnes);
    const staz = F.d(cpi.stazeno);
    const dni = Math.round((t - staz) / DEN);
    if (dni > 60) return { ok: false, text: `Data ČSÚ jsou stará ${dni} dní (stažena ${F.fmtDatum(cpi.stazeno)}). Zkontroluj měsíční stahování na GitHubu (záložka Actions).` };
    return { ok: true, text: `ČSÚ, stažena ${F.fmtDatum(cpi.stazeno)}` };
  }

  // ------------------------------------------------------------ smlouva a nájem
  // Aktuální nájem = běžící smlouva; není-li, tak poslední
  function aktualniNajem(byt, pronajmy, dnes) {
    const pr = F.pronajmyBytu(byt, pronajmy);
    const akt = F.aktivniPronajem(byt, pronajmy, dnes);
    const p = akt || pr[pr.length - 1] || null;
    if (!p) return null;
    const najem = F.num(p.najem_mesic);
    const plocha = F.num(byt.plocha_m2);
    const t = F.d(dnes);
    const dnu = p.do ? Math.round((F.d(p.do) - t) / DEN) : null;
    return {
      najemce: p.najemce, od: p.od, do: p.do || null, beziSmlouva: !!akt,
      najem, kcM2: najem && plocha ? najem / plocha : null, dnuDoKonce: dnu,
    };
  }

  // Poslední údaj z každého zdroje u bytu (nejnovější podle data)
  function poslednTrh(trh, bytId) {
    const out = {};
    for (const r of trh.filter((x) => x.byt_id === bytId)) {
      const k = r.zdroj;
      if (!out[k] || String(r.datum) > String(out[k].datum)) out[k] = r;
    }
    return out;
  }

  // Nejnovější návrh nového nájemného k bytu
  function posledniNavrh(navrhy, bytId) {
    return navrhy.filter((n) => n.byt_id === bytId)
      .sort((a, b) => (String(a.plati_od) < String(b.plati_od) ? 1 : String(a.plati_od) < String(b.plati_od) ? -1 : (b.id || 0) - (a.id || 0)))[0] || null;
  }

  // ------------------------------------------------------------ celý podklad k bytu
  function podklad(byt, data, cpi, dnes) {
    const akt = aktualniNajem(byt, data.pronajmy, dnes);
    const plocha = F.num(byt.plocha_m2);
    const idx = posledniIndex(cpi);
    const varianty = [];
    if (akt && akt.najem && idx) {
      const c = akt.najem * idx.koef;
      varianty.push({ klic: "inflace", nazev: `Inflace nájmů (ČSÚ, ${idx.idx.toString().replace(".", ",")} % za ${F.fmtMesic(idx.mesic + "-01")})`, castka: zaokr(c), kcM2: plocha ? c / plocha : null, rozdil: rozdil(c, akt.najem) });
    }
    const trh = poslednTrh(data.najem_trh || [], byt.id);
    const t = F.d(dnes);
    for (const [zdroj, r] of Object.entries(trh)) {
      const kc = F.num(r.kc_m2);
      if (!kc || !plocha) continue;
      const c = kc * plocha;
      const stari = Math.round((t - F.d(r.datum)) / DEN);
      varianty.push({ id: r.id, klic: zdroj, nazev: `${ZDROJE[zdroj] || zdroj}${r.poznamka ? ` (${r.poznamka})` : ""}`, castka: zaokr(c), kcM2: kc, rozdil: akt ? rozdil(c, akt.najem) : null, datum: r.datum, stare: stari > DNI_STARE_TRHU, stariDni: stari });
    }
    const navrh = posledniNavrh(data.najem_navrhy || [], byt.id);
    const konci = akt && akt.dnuDoKonce !== null && akt.dnuDoKonce <= DNI_PRED_KONCEM;
    // návrh je schválený / odeslaný a ještě nezačal platit → není co řešit, jen čekat na podpis
    const vyreseno = !!navrh && (navrh.stav === "schvaleno" || navrh.stav === "odeslano") && F.d(navrh.plati_od) > t;
    return { byt, akt, idx, varianty, navrh, vyreseno, kReseni: !!konci && !vyreseno,
      navrhRozdil: navrh && akt ? rozdil(F.num(navrh.navrh), akt.najem) : null,
      navrhKcM2: navrh && plocha ? F.num(navrh.navrh) / plocha : null };
  }

  // Byty seřazené podle konce smlouvy (nejdřív ty, co končí dřív; bez konce nakonec)
  function poradiPodleKonce(data, cpi, dnes) {
    const a = data.byty.map((b) => podklad(b, data, cpi, dnes));
    const klic = (p) => (p.akt && p.akt.do ? F.d(p.akt.do).getTime() : Infinity);
    return a.sort((x, y) => klic(x) - klic(y));
  }

  const Najem = { ZDROJE, DNI_PRED_KONCEM, DNI_STARE_TRHU, posledniIndex, stavCpi, terminyTrhu, TERMINY_TRHU, aktualniNajem, poslednTrh, posledniNavrh, podklad, poradiPodleKonce };
  root.Najem = Najem;
  if (typeof module !== "undefined") module.exports = Najem;
})(typeof window !== "undefined" ? window : globalThis);
