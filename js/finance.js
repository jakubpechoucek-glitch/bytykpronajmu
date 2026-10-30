// Finanční výpočty – čisté funkce bez DOM. Vzorce viz docs/04-financni-ukazatele.md.
// Data: řádky tabulek ze Supabase (byty, odhady, pronajmy, najemne, hypoteky, inflace).
(function (root) {
  "use strict";

  const DEN = 86400000;
  const ROK = 365.25 * DEN;

  // „2025-04-03" → Date (UTC půlnoc), Date → stejný Date
  function d(x) {
    if (x instanceof Date) return x;
    if (!x) return null;
    const [y, m, dd] = String(x).slice(0, 10).split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, dd));
  }
  const iso = (dt) => dt.toISOString().slice(0, 10);
  const roky = (a, b) => (d(b) - d(a)) / ROK;
  const num = (x) => (x === null || x === undefined || x === "" ? null : Number(x));

  // ------------------------------------------------------------ hodnota bytu
  function body(byt, odhady) {
    const pts = [];
    if (byt.porizeni_datum && num(byt.porizeni_cena)) pts.push({ d: d(byt.porizeni_datum), v: num(byt.porizeni_cena), typ: "porizeni" });
    for (const o of odhady.filter((o) => o.byt_id === byt.id)) {
      pts.push({ d: d(o.datum), v: num(o.cena_m2) * num(byt.plocha_m2), cena_m2: num(o.cena_m2), typ: "odhad", odhad: o });
    }
    return pts.sort((a, b) => a.d - b.d);
  }

  // Aktuální hodnota = poslední odhad (jinak pořizovací cena)
  function aktualniHodnota(byt, odhady) {
    const pts = body(byt, odhady);
    return pts.length ? pts[pts.length - 1] : null;
  }

  // Hodnota k datu: lineárně mezi známými body, po posledním bodu konstantní
  function hodnotaKDatu(byt, odhady, datum) {
    const pts = body(byt, odhady);
    const t = d(datum);
    if (!pts.length || t < pts[0].d) return 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (t <= b.d) return b.d - a.d === 0 ? b.v : a.v + (b.v - a.v) * ((t - a.d) / (b.d - a.d));
    }
    return pts[pts.length - 1].v;
  }

  // ------------------------------------------------------------ výnosy
  function cagr(p, v, n) {
    if (!p || !v || !(n > 0)) return null;
    return Math.pow(v / p, 1 / n) - 1;
  }

  // XIRR: Σ v_i / (1+r)^((d_i − d_0)/365) = 0. Newton, při selhání bisekce.
  function xirr(toky) {
    const cf = toky.filter((t) => t.v).map((t) => ({ d: d(t.d), v: t.v })).sort((a, b) => a.d - b.d);
    if (cf.length < 2 || !cf.some((t) => t.v > 0) || !cf.some((t) => t.v < 0)) return null;
    const t0 = cf[0].d;
    const ts = cf.map((c) => (c.d - t0) / (365 * DEN));
    const f = (r) => cf.reduce((s, c, i) => s + c.v / Math.pow(1 + r, ts[i]), 0);
    const df = (r) => cf.reduce((s, c, i) => s - (ts[i] * c.v) / Math.pow(1 + r, ts[i] + 1), 0);
    let r = 0.1;
    for (let i = 0; i < 100; i++) {
      const fr = f(r), dfr = df(r);
      if (!isFinite(fr) || !isFinite(dfr) || dfr === 0) break;
      const nr = r - fr / dfr;
      if (Math.abs(nr - r) < 1e-10) return nr;
      r = nr <= -0.99 ? (r - 0.99) / 2 : nr;
    }
    let lo = -0.99, hi = 10;
    if (f(lo) * f(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  function najemneBytu(byt, najemne) {
    return najemne.filter((n) => n.byt_id === byt.id && num(n.castka)).sort((a, b) => (a.mesic < b.mesic ? -1 : 1));
  }

  // Peněžní toky bytu: −pořizovací cena, měsíční nájmy, +hodnota na konci
  function tokyBytu(byt, odhady, najemne) {
    const h = aktualniHodnota(byt, odhady);
    if (!h || !num(byt.porizeni_cena)) return null;
    const najmy = najemneBytu(byt, najemne);
    const posledni = najmy.length ? d(najmy[najmy.length - 1].mesic) : null;
    const konec = posledni && posledni > h.d ? posledni : h.d;
    return {
      najmy: [{ d: d(byt.porizeni_datum), v: -num(byt.porizeni_cena) }, ...najmy.map((n) => ({ d: d(n.mesic), v: num(n.castka) }))],
      konec: { d: konec, v: h.v },
    };
  }

  // Odpisy: rovnoměrně, odpisová skupina 5 (30 let): 1. rok 1,4 %, dále 3,4 %
  function odpis(byt, rok) {
    const vstup = num(byt.odpisy_vstupni_cena) || num(byt.porizeni_cena);
    if (!vstup || !byt.porizeni_datum) return 0;
    const poradi = rok - d(byt.porizeni_datum).getUTCFullYear() + 1;
    if (poradi === 1) return vstup * 0.014;
    if (poradi >= 2 && poradi <= 30) return vstup * 0.034;
    return 0;
  }

  // ------------------------------------------------------------ pronájmy
  function pronajmyBytu(byt, pronajmy) {
    return pronajmy.filter((p) => p.byt_id === byt.id).sort((a, b) => (a.od < b.od ? -1 : 1));
  }
  function aktivniPronajem(byt, pronajmy, dnes) {
    const t = d(dnes);
    return pronajmyBytu(byt, pronajmy).find((p) => d(p.od) <= t && (!p.do || d(p.do) >= t)) || null;
  }

  // ------------------------------------------------------------ souhrn bytu
  function souhrnBytu(byt, data, dnes) {
    const P = num(byt.porizeni_cena);
    const h = aktualniHodnota(byt, data.odhady);
    const V = h ? h.v : null;
    const n = h && byt.porizeni_datum ? roky(byt.porizeni_datum, h.d) : null;
    const najmy = najemneBytu(byt, data.najemne);
    const toky = tokyBytu(byt, data.odhady, data.najemne);
    const drzeno = byt.porizeni_datum ? roky(byt.porizeni_datum, dnes) : null;

    // nájem za 12 měsíců končících posledním zapsaným měsícem
    // (dokud se nájemné nedopíše, nekazí yield prázdné poslední měsíce)
    const posledni = najmy.length ? d(najmy[najmy.length - 1].mesic) : null;
    const od12 = posledni ? new Date(Date.UTC(posledni.getUTCFullYear(), posledni.getUTCMonth() - 11, 1)) : null;
    const posl12 = posledni ? najmy.filter((x) => d(x.mesic) >= od12).reduce((s, x) => s + num(x.castka), 0) : 0;

    const aktivni = aktivniPronajem(byt, data.pronajmy, dnes);
    const hyp = data.hypoteky.filter((x) => x.byt_id === byt.id);

    return {
      byt,
      P, V,
      hodnotaDatum: h ? h.d : null,
      cenaM2Odhad: h && h.cena_m2 ? h.cena_m2 : null,
      cenaM2Porizeni: P && num(byt.plocha_m2) ? P / num(byt.plocha_m2) : null,
      n,
      zhodnoceni: P && V ? V / P - 1 : null,
      prosteZhodnoceniPa: P && V && n >= 1 ? (V / P - 1) / n : null,
      cagr: n >= 1 ? cagr(P, V, n) : null,
      irr: toky && roky(toky.najmy[0].d, toky.konec.d) >= 1 ? xirr([...toky.najmy, toky.konec]) : null,
      najemCelkem: najmy.reduce((s, x) => s + num(x.castka), 0),
      najem12: posl12,
      najem12Od: od12,
      yield12: P ? posl12 / P : null,
      yield12Hodnota: V ? posl12 / V : null,
      posledniNajem: najmy.length ? najmy[najmy.length - 1] : null,
      aktivni,
      najemMesic: aktivni ? num(aktivni.najem_mesic) : null,
      hypoteky: hyp,
      drzeno,
    };
  }

  // Po letech: nájem, yield, inflace, kumulace, hodnota ke konci roku, odpis
  function rocniPrehled(byt, data, dnes) {
    if (!byt.porizeni_datum) return [];
    const P = num(byt.porizeni_cena);
    const r0 = d(byt.porizeni_datum).getUTCFullYear();
    const najmy = najemneBytu(byt, data.najemne);
    const rPosl = Math.max(d(dnes).getUTCFullYear(), ...najmy.map((x) => d(x.mesic).getUTCFullYear()));
    const infl = Object.fromEntries(data.inflace.map((i) => [i.rok, num(i.mira)]));
    const out = [];
    let kum = 0;
    for (let r = r0; r <= rPosl; r++) {
      const vRoce = najmy.filter((x) => d(x.mesic).getUTCFullYear() === r);
      const najem = vRoce.reduce((s, x) => s + num(x.castka), 0);
      kum += najem;
      const yNom = P ? najem / P : null;
      const i = infl[r];
      const konecRoku = new Date(Date.UTC(r, 11, 31));
      const hodnota = hodnotaKDatu(byt, data.odhady, konecRoku < d(dnes) ? konecRoku : dnes);
      out.push({
        rok: r,
        mesicu: vRoce.length,
        najem,
        yieldNom: yNom,
        inflace: i ?? null,
        yieldReal: yNom !== null && i !== undefined ? (1 + yNom) / (1 + i) - 1 : null,
        kumulace: kum,
        hodnota,
        yieldHodnota: hodnota ? najem / hodnota : null,
        odpis: odpis(byt, r),
      });
    }
    return out;
  }

  // ------------------------------------------------------------ portfolio
  function portfolio(data, dnes) {
    const byty = [...data.byty].sort((a, b) => (a.poradi ?? 0) - (b.poradi ?? 0));
    const souhrny = byty.map((b) => souhrnBytu(b, data, dnes));
    const sum = (k) => souhrny.reduce((s, x) => s + (x[k] || 0), 0);
    const P = sum("P"), V = sum("V");

    // IRR z hodnoty (jako list CAGR v Excelu) a celkové IRR (hodnota + nájmy)
    const vsechnyToky = souhrny.map((s) => tokyBytu(s.byt, data.odhady, data.najemne)).filter(Boolean);
    let irrHodnota = null, irrCelkem = null;
    if (vsechnyToky.length) {
      const konec = new Date(Math.max(...vsechnyToky.map((t) => t.konec.d)));
      const nakupy = vsechnyToky.map((t) => t.najmy[0]);
      const koncovaHodnota = { d: konec, v: vsechnyToky.reduce((s, t) => s + t.konec.v, 0) };
      irrHodnota = xirr([...nakupy, koncovaHodnota]);
      irrCelkem = xirr([...vsechnyToky.flatMap((t) => t.najmy), koncovaHodnota]);
    }
    return {
      souhrny, P, V,
      zhodnoceni: P ? V / P - 1 : null,
      najem12: sum("najem12"),
      najemMesic: sum("najemMesic"),
      yield12: P ? sum("najem12") / P : null,
      yield12Hodnota: V ? sum("najem12") / V : null,
      najemCelkem: sum("najemCelkem"),
      irrHodnota, irrCelkem,
    };
  }

  // Hodnota portfolia ke konci každého roku (pro graf), po bytech
  function vyvojHodnoty(data, dnes) {
    const byty = [...data.byty].sort((a, b) => (a.poradi ?? 0) - (b.poradi ?? 0));
    const r0 = Math.min(...byty.filter((b) => b.porizeni_datum).map((b) => d(b.porizeni_datum).getUTCFullYear()));
    const r1 = d(dnes).getUTCFullYear();
    const roky_ = [];
    for (let r = r0; r <= r1; r++) roky_.push(r);
    return {
      roky: roky_,
      rady: byty.map((b) => ({
        byt: b,
        hodnoty: roky_.map((r) => {
          const k = new Date(Date.UTC(r, 11, 31));
          return Math.round(hodnotaKDatu(b, data.odhady, k < d(dnes) ? k : dnes));
        }),
        najmy: roky_.map((r) => najemneBytu(b, data.najemne).filter((x) => d(x.mesic).getUTCFullYear() === r).reduce((s, x) => s + num(x.castka), 0)),
      })),
    };
  }

  // ------------------------------------------------------------ upozornění
  function upozorneni(data, dnes) {
    const t = d(dnes);
    const za = (dny) => new Date(t.getTime() + dny * DEN);
    const out = [];
    for (const b of data.byty) {
      const pr = pronajmyBytu(b, data.pronajmy);
      const akt = aktivniPronajem(b, data.pronajmy, dnes);
      const budouci = pr.find((p) => d(p.od) > t);
      if (akt && akt.do && d(akt.do) <= za(90) && !budouci) {
        out.push({ byt: b, uroven: "varovani", text: `Smlouva (${akt.najemce}) končí ${fmtDatum(akt.do)}` });
      }
      if (!akt && pr.length) {
        const posl = pr[pr.length - 1];
        out.push({ byt: b, uroven: budouci ? "info" : "chyba",
          text: budouci ? `Nová smlouva začíná ${fmtDatum(budouci.od)}` : `Bez platné smlouvy (poslední skončila ${fmtDatum(posl.do)})` });
      }
      for (const h of data.hypoteky.filter((h) => h.byt_id === b.id && !h.splacena && h.konec_fixace)) {
        if (d(h.konec_fixace) <= za(180)) out.push({ byt: b, uroven: "varovani", text: `Konec fixace hypotéky ${fmtDatum(h.konec_fixace)}` });
      }
      // nájemné zapsané nejpozději za předminulý měsíc → připomenout
      const najmy = najemneBytu(b, data.najemne);
      const posl = najmy.length ? d(najmy[najmy.length - 1].mesic) : null;
      const hranice = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
      if (akt && (!posl || posl < hranice)) {
        out.push({ byt: b, uroven: "info", text: posl ? `Nájemné zapsané jen do ${fmtMesic(posl)}` : "Není zapsané žádné nájemné" });
      }
    }
    const poradi = { chyba: 0, varovani: 1, info: 2 };
    return out.sort((a, b) => poradi[a.uroven] - poradi[b.uroven]);
  }

  // ------------------------------------------------------------ formáty
  const nfKc = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });
  function fmtKc(v) { return v === null || v === undefined || isNaN(v) ? "—" : nfKc.format(Math.round(v)) + " Kč"; }
  function fmtMil(v) { return v === null || v === undefined ? "—" : (v / 1e6).toLocaleString("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " mil. Kč"; }
  function fmtPct(v, des = 2) { return v === null || v === undefined || !isFinite(v) ? "—" : (v * 100).toLocaleString("cs-CZ", { minimumFractionDigits: des, maximumFractionDigits: des }) + " %"; }
  function fmtDatum(x) { if (!x) return "—"; const t = d(x); return `${t.getUTCDate()}. ${t.getUTCMonth() + 1}. ${t.getUTCFullYear()}`; }
  const MESICE = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
  function fmtMesic(x) { const t = d(x); return `${t.getUTCMonth() + 1}/${t.getUTCFullYear()}`; }

  // Pásma IRR (docs/04): hranice 4 / 6 / 9 / 12 %
  const PASMA = [
    { do: 0.04, nazev: "< 4 %", text: "Nízké, často horší než spořicí účet / státní dluhopisy", typicky: "Slabý nájem, přepálená cena" },
    { do: 0.06, nazev: "4–6 %", text: "Konzervativní, relativně bezpečné, někdy OK v top lokalitách", typicky: "Prémiové byty ve velkých městech" },
    { do: 0.09, nazev: "6–9 %", text: "Solidní výnos u dlouhodobých pronájmů", typicky: "Běžné investiční byty s hypotékou" },
    { do: 0.12, nazev: "9–12 %", text: "Výborný výnos, často u dobře koupených nemovitostí nebo s vyšší pákou", typicky: "Smart investors, undervalued deals" },
    { do: Infinity, nazev: "> 12 %", text: "Skvělé, ale obvykle nese vyšší riziko (lokalita, právní riziko, krátkodobý nájem…)", typicky: "Airbnb, spekulace, přestavby" },
  ];
  const pasmo = (irr) => (irr === null ? null : PASMA.find((p) => irr < p.do));

  const Finance = {
    d, iso, roky, num, body, aktualniHodnota, hodnotaKDatu, cagr, xirr, tokyBytu, odpis,
    pronajmyBytu, aktivniPronajem, najemneBytu, souhrnBytu, rocniPrehled, portfolio,
    vyvojHodnoty, upozorneni, fmtKc, fmtMil, fmtPct, fmtDatum, fmtMesic, MESICE, PASMA, pasmo,
  };
  root.Finance = Finance;
  if (typeof module !== "undefined") module.exports = Finance;
})(typeof window !== "undefined" ? window : globalThis);
