// Vyúčtování záloh nájemníkovi – čisté funkce bez DOM (testy: node tools/test_vyuctovani.js).
// Vyúčtování = položky nákladů − odečty, porovnané se zaplacenými zálohami.
// Položky (`polozky`, pole objektů), podle `typ`:
//   meridlo : spotřeba z měřiče  { nazev, jednotka, stav_od, stav_do, spotreba?, cena }  náklad = spotřeba × cena
//   den     : denní sazba        { nazev, cena, dny }                                      náklad = cena × dny
//   castka  : pevná částka       { nazev, castka }                                         např. náklady SVJ na byt
//   odpocet : odečet             { nazev, castka }                                         např. Fond oprav (snižuje náklad)
//   kauce   : vrácená kauce      { nazev, castka }   jen při ukončení nájmu, přičte se k přeplatku
//   srazka  : srážka z kauce     { nazev, castka }   např. nedoplatek z minulého roku, oprava podlahy
// Měřič a denní sazba mohou mít `naklad_rucne` – přesná částka z dokladu přepíše výpočet (haléře).
(function (root) {
  "use strict";

  const DEN = 86400000;
  const num = (x) => (x === null || x === undefined || x === "" || isNaN(Number(x)) ? null : Number(x));
  const n0 = (x) => num(x) ?? 0;
  const dt = (x) => { const [y, m, d] = String(x).slice(0, 10).split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const zaokr = (x) => Math.round(x * 100) / 100;

  const TYPY = {
    meridlo: "Měřič (spotřeba × cena)",
    den: "Denní sazba × počet dní",
    castka: "Pevná částka",
    odpocet: "Odečet (např. Fond oprav)",
    kauce: "Kauce k vrácení (při ukončení nájmu)",
    srazka: "Srážka z kauce (při ukončení nájmu)",
  };
  const VYROVNANI = ["kauce", "srazka"];

  // Spotřeba měřiče: ruční přepsání, jinak konečný − počáteční stav
  function spotreba(p) {
    const s = num(p.spotreba);
    if (s !== null) return s;
    const a = num(p.stav_od), b = num(p.stav_do);
    return a !== null && b !== null ? zaokr((b - a) * 1000) / 1000 : 0;
  }

  // Náklad jedné položky v Kč (odečet je záporný)
  function naklad(p) {
    const r = num(p.naklad_rucne);
    if (r !== null && (p.typ === "meridlo" || p.typ === "den")) return zaokr(r);
    switch (p.typ) {
      case "meridlo": return zaokr(spotreba(p) * n0(p.cena));
      case "den": return zaokr(n0(p.cena) * n0(p.dny));
      case "odpocet": case "srazka": return -zaokr(n0(p.castka));
      default: return zaokr(n0(p.castka));
    }
  }

  // Počet dní období včetně obou krajních dnů (1.1.–31.12. = 365)
  function pocetDni(od, do_) {
    return Math.round((dt(do_) - dt(od)) / DEN) + 1;
  }

  // Počet (i započatých) měsíců období: 1.6.–31.12. = 7
  function pocetMesicu(od, do_) {
    const a = dt(od), b = dt(do_);
    return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth() + 1;
  }

  // Zálohy celkem: ručně zadaná částka, jinak záloha/měsíc × počet měsíců
  function zalohyCelkem(v) {
    const r = num(v.zalohy_celkem);
    return r !== null ? r : zaokr(n0(v.zaloha_mesic) * n0(v.mesicu));
  }

  // Výsledek: kladný rozdíl = přeplatek (vrací se nájemníkovi), záporný = nedoplatek
  function vypocet(v) {
    const polozky = (v.polozky || []).map((p) => ({ ...p, naklad: naklad(p) }));
    const vyrovnaniPol = polozky.filter((p) => VYROVNANI.includes(p.typ));
    const nakladPol = polozky.filter((p) => !VYROVNANI.includes(p.typ));
    const naklady = zaokr(nakladPol.filter((p) => p.typ !== "odpocet").reduce((s, p) => s + p.naklad, 0));
    const odpocty = zaokr(polozky.filter((p) => p.typ === "odpocet").reduce((s, p) => s + p.naklad, 0)); // záporné
    const celkem = zaokr(naklady + odpocty);
    const zalohy = zalohyCelkem(v);
    const rozdil = zaokr(zalohy - celkem);
    // vyrovnání při ukončení nájmu: kauce − srážky; kVraceni = co se nájemci nakonec vrací (záporné = doplácí)
    const vyrovnani = zaokr(vyrovnaniPol.reduce((s, p) => s + p.naklad, 0));
    const kVraceni = zaokr(rozdil + vyrovnani);
    return { polozky, nakladPol, vyrovnaniPol, naklady, odpocty, celkem, zalohy, rozdil, preplatek: rozdil > 0, nedoplatek: rozdil < 0, maVyrovnani: vyrovnaniPol.length > 0, vyrovnani, kVraceni };
  }

  // Návrh záloh podle smluv: měsíce období, ve kterých platila smlouva/dodatek se zálohou.
  // Smlouva platí v měsíci, pokud platila k jeho 15. dni (stejně jako „Doplnit podle smluv“).
  function zalohyPodleSmluv(pronajmy, od, do_) {
    const out = { najemce: null, zaloha_mesic: null, mesicu: 0, zalohy_celkem: 0, pronajem_id: null };
    const a = dt(od), b = dt(do_);
    let y = a.getUTCFullYear(), m = a.getUTCMonth();
    const sazby = new Set();
    for (; y < b.getUTCFullYear() || (y === b.getUTCFullYear() && m <= b.getUTCMonth()); m++) {
      if (m > 11) { m = 0; y++; }
      const stred = new Date(Date.UTC(y, m, 15));
      const p = pronajmy.find((x) => dt(x.od) <= stred && (!x.do || dt(x.do) >= stred));
      if (!p) continue;
      out.najemce = p.najemce;
      out.pronajem_id = p.id ?? null;
      const z = n0(p.zaloha_mesic);
      out.mesicu++;
      out.zalohy_celkem += z;
      sazby.add(z);
      out.zaloha_mesic = z;
    }
    out.zalohy_celkem = zaokr(out.zalohy_celkem);
    // záloha se v průběhu období měnila → bez jednotné měsíční částky
    if (sazby.size > 1) out.zaloha_mesic = zaokr(out.zalohy_celkem / out.mesicu);
    out.promenliva = sazby.size > 1;
    return out;
  }

  const iso = (x) => x.toISOString().slice(0, 10);

  // Návrh dalšího období: navazuje na konec posledního vyúčtování (nebo začátek první smlouvy)
  // a končí koncem kalendářního roku, nebo dřív – když nájemníkova smlouva končí uprostřed roku.
  // Vrací { od, do } nebo null (není co vyúčtovat – vše do `dnes` je pokryté).
  function navrhObdobi(pronajmy, existujici, dnes) {
    const sm = [...pronajmy].sort((a, b) => (a.od < b.od ? -1 : 1));
    if (!sm.length) return null;
    const posledniDo = existujici.reduce((m, v) => (v.do > m ? v.do : m), "");
    let od = posledniDo ? iso(new Date(dt(posledniDo).getTime() + DEN)) : String(sm[0].od).slice(0, 10);
    // mezera bez smlouvy → přeskočit na další smlouvu
    if (!sm.some((p) => String(p.od).slice(0, 10) <= od && (!p.do || String(p.do).slice(0, 10) >= od))) {
      const dalsi = sm.find((p) => String(p.od).slice(0, 10) > od);
      if (!dalsi) return null;
      od = String(dalsi.od).slice(0, 10);
    }
    const aktualni = sm.find((p) => String(p.od).slice(0, 10) <= od && (!p.do || String(p.do).slice(0, 10) >= od));
    // konec nájemce = konec posledního navazujícího dokumentu téhož nájemce
    let konec = aktualni.do ? String(aktualni.do).slice(0, 10) : null;
    for (let zmena = true; zmena && konec;) {
      zmena = false;
      const nav = sm.find((p) => p.najemce === aktualni.najemce && String(p.od).slice(0, 10) <= iso(new Date(dt(konec).getTime() + DEN)) && (!p.do || String(p.do).slice(0, 10) > konec));
      if (nav) { konec = nav.do ? String(nav.do).slice(0, 10) : null; zmena = true; }
    }
    const konecRoku = `${od.slice(0, 4)}-12-31`;
    let do_ = konec && konec < konecRoku ? konec : konecRoku;
    if (do_ >= String(dnes).slice(0, 10)) return null; // období ještě neskončilo
    return { od, do: do_ };
  }

  const Vyuctovani = { navrhObdobi, TYPY, spotreba, naklad, pocetDni, pocetMesicu, zalohyCelkem, vypocet, zalohyPodleSmluv };
  root.Vyuctovani = Vyuctovani;
  if (typeof module !== "undefined") module.exports = Vyuctovani;
})(typeof window !== "undefined" ? window : globalThis);
