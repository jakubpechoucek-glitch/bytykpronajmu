// Smyšlená ukázková data pro režim ?demo (bez přihlášení). Nejsou to skutečné byty.
(function (root) {
  "use strict";

  const najemne = [];
  // měsíční nájem od–do (včetně) jednou částkou
  function najmy(byt_id, od, doMesic, castka) {
    let [y, m] = od.split("-").map(Number);
    const [y2, m2] = doMesic.split("-").map(Number);
    while (y < y2 || (y === y2 && m <= m2)) {
      najemne.push({ byt_id, mesic: `${y}-${String(m).padStart(2, "0")}-01`, castka });
      if (++m > 12) { m = 1; y++; }
    }
  }
  najmy("vinohrady", "2014-03", "2016-12", 15000);
  najmy("vinohrady", "2017-02", "2020-01", 17500);
  najmy("vinohrady", "2020-03", "2023-02", 19000);
  najmy("vinohrady", "2023-03", "2025-02", 23500);
  najmy("vinohrady", "2025-03", "2026-09", 24500);
  najmy("holesovice", "2019-09", "2022-08", 18000);
  najmy("holesovice", "2022-10", "2025-12", 21000);
  najmy("ricany", "2024-05", "2026-08", 17000);

  root.DEMO_DATA = {
    byty: [
      { id: "vinohrady", poradi: 1, region_indexu: "praha", nazev: "Vinohrady", adresa: "Ukázková 1, Praha 2", dispozice: "2+1", plocha_m2: 68, patro: "4. NP",
        garazova_stani: 0, sklep_m2: 3.5, vybaveni: "kuchyň", posledni_vymalba: 2023, porizeni_datum: "2013-11-15", porizeni_cena: 3900000,
        odkaz_mapa: "https://maps.google.com", odkaz_fotogalerie: "", odkaz_smlouvy: "", poznamka: "Ukázkový byt" },
      { id: "holesovice", poradi: 2, k_prodeji: true, region_indexu: "praha", nazev: "Holešovice", adresa: "Vzorová 22, Praha 7", dispozice: "2+kk", plocha_m2: 54, patro: "2. NP",
        garazova_stani: 1, sklep_m2: null, vybaveni: "NE", posledni_vymalba: 2022, porizeni_datum: "2019-06-01", porizeni_cena: 5200000 },
      { id: "ricany", poradi: 3, region_indexu: "stredocesky", nazev: "Říčany", adresa: "", dispozice: "1+kk", plocha_m2: 36, patro: "1. NP",
        garazova_stani: 1, sklep_m2: 2, vybaveni: "ANO", posledni_vymalba: 2024, porizeni_datum: "2024-02-20", porizeni_cena: 3600000 },
    ],
    odhady: [
      { id: 1, byt_id: "vinohrady", datum: "2020-01-01", cena_m2: 105000, zdroj: "Atlas cen" },
      { id: 2, byt_id: "vinohrady", datum: "2026-03-01", cena_m2: 148000, zdroj: "Atlas cen" },
      { id: 3, byt_id: "holesovice", datum: "2026-03-01", cena_m2: 139000, zdroj: "Atlas cen" },
      { id: 4, byt_id: "ricany", datum: "2026-03-01", cena_m2: 108000, zdroj: "Atlas cen" },
    ],
    pronajmy: [
      { id: 1, byt_id: "vinohrady", najemce: "Nájemce A", od: "2014-03-01", do: "2016-12-31", najem_mesic: 15000, kauce: 30000, zaloha_mesic: 2500, splatnost_den: 15 },
      { id: 2, byt_id: "vinohrady", najemce: "Nájemce B", od: "2017-02-01", do: "2020-01-31", najem_mesic: 17500, kauce: 35000, zaloha_mesic: 2800, splatnost_den: 15 },
      { id: 3, byt_id: "vinohrady", najemce: "Nájemce C", od: "2020-03-01", do: "2023-02-28", najem_mesic: 19000, kauce: 40000, zaloha_mesic: 3200, splatnost_den: 25 },
      { id: 4, byt_id: "vinohrady", najemce: "Nájemce D", od: "2023-03-01", do: "2025-02-28", najem_mesic: 23500, kauce: 47000, zaloha_mesic: 3500, splatnost_den: 25, kontakt: "najemce.d@example.com", typ: "smlouva", poznamka: "Smlouva na 2 roky." },
      { id: 14, byt_id: "vinohrady", najemce: "Nájemce D", od: "2025-03-01", do: "2026-12-31", najem_mesic: 24500, kauce: 47000, zaloha_mesic: 3800, splatnost_den: 25, kontakt: "najemce.d@example.com", typ: "dodatek", poznamka: "Dodatek – prodloužení a změna nájemného." },
      { id: 5, byt_id: "holesovice", najemce: "Nájemce E", od: "2019-09-01", do: "2022-08-31", najem_mesic: 18000, kauce: 36000, zaloha_mesic: 2600, splatnost_den: 20 },
      { id: 6, byt_id: "holesovice", najemce: "Nájemce F", od: "2022-10-01", do: "2025-12-31", najem_mesic: 21000, kauce: 42000, zaloha_mesic: 2900, splatnost_den: 20 },
      { id: 7, byt_id: "ricany", najemce: "Nájemce G", od: "2024-05-01", do: "2027-04-30", inflacni_dolozka: true, zvyseni_od: "2027-01-10", najem_mesic: 17000, kauce: 34000, zaloha_mesic: 2200, splatnost_den: 25 },
    ],
    najemne,
    // Ukázková vyúčtování (smyšlená čísla, stejná struktura jako skutečná)
    vyuctovani: [
      { id: 1, byt_id: "vinohrady", rok: 2024, od: "2024-01-01", do: "2024-12-31", najemce: "Nájemce D", zaloha_mesic: 3500, mesicu: 12, zalohy_celkem: null,
        odeslano: "2025-04-20", poznamka: "",
        polozky: [
          { typ: "meridlo", nazev: "Teplá voda", jednotka: "m³", stav_od: 41.2, stav_do: 63.9, cena: 330, spotreba: null },
          { typ: "meridlo", nazev: "Studená voda", jednotka: "m³", stav_od: 88.5, stav_do: 131.2, cena: 145, spotreba: null },
          { typ: "meridlo", nazev: "Teplo", jednotka: "GJ", stav_od: 1180, stav_do: 2210, cena: 6.4, spotreba: null },
          { typ: "castka", nazev: "Náklady SVJ na byt (vyúčtování SVJ)", castka: 26400 },
          { typ: "odpocet", nazev: "Fond oprav", castka: 8200 },
        ] },
      { id: 2, byt_id: "vinohrady", rok: 2025, od: "2025-01-01", do: "2025-12-31", najemce: "Nájemce D", zaloha_mesic: 3800, mesicu: 12, zalohy_celkem: 45000,
        odeslano: null, poznamka: "Záloha se od března zvýšila z 3 500 na 3 800 Kč (zálohy celkem 2 × 3 500 + 10 × 3 800).",
        polozky: [
          { typ: "meridlo", nazev: "Teplá voda", jednotka: "m³", stav_od: 63.9, stav_do: 88.1, cena: 345, spotreba: null },
          { typ: "meridlo", nazev: "Studená voda", jednotka: "m³", stav_od: 131.2, stav_do: 172.6, cena: 152, spotreba: null },
          { typ: "meridlo", nazev: "Teplo", jednotka: "GJ", stav_od: 2210, stav_do: 3290, cena: 6.9, spotreba: null },
          { typ: "castka", nazev: "Náklady SVJ na byt (vyúčtování SVJ)", castka: 28100 },
          { typ: "odpocet", nazev: "Fond oprav", castka: 8600 },
        ] },
      { id: 3, byt_id: "holesovice", rok: 2025, od: "2025-01-01", do: "2025-12-31", najemce: "Nájemce F", zaloha_mesic: 2900, mesicu: 12, zalohy_celkem: null,
        odeslano: null, poznamka: "",
        polozky: [
          { typ: "meridlo", nazev: "Teplá voda", jednotka: "m³", stav_od: 10, stav_do: 28.5, cena: 340, spotreba: null },
          { typ: "meridlo", nazev: "Studená voda", jednotka: "m³", stav_od: 22, stav_do: 51, cena: 150, spotreba: null },
          { typ: "den", nazev: "Ostatní náklady", cena: 61.5, dny: 365 },
        ] },
    ],
    hypoteky: [
      { id: 1, byt_id: "ricany", vyse: 2500000, splatka_mesic: 13800, sazba: 0.0489, fixace_let: 3, konec_fixace: "2027-02-20", splacena: false },
    ],
    najem_trh: [
      { id: 1, byt_id: "vinohrady", datum: "2026-10-01", zdroj: "deloitte", kc_m2: 470 },
      { id: 2, byt_id: "vinohrady", datum: "2026-10-01", zdroj: "mf", kc_m2: 455 },
      { id: 3, byt_id: "holesovice", datum: "2026-10-01", zdroj: "deloitte", kc_m2: 490 },
      { id: 4, byt_id: "ricany", datum: "2026-04-01", zdroj: "mf", kc_m2: 410 },
    ],
    najem_navrhy: [
      { id: 1, byt_id: "vinohrady", plati_od: "2027-01-01", navrh: 25500, stav: "navrh", poznamka: "Ukázkový návrh podle inflace nájmů.", upravil: "Ukázka", upraveno: "2026-11-10T09:00:00Z" },
    ],
    inflace: [
      [2013, 0.014], [2014, 0.004], [2015, 0.003], [2016, 0.007], [2017, 0.025], [2018, 0.021], [2019, 0.028],
      [2020, 0.032], [2021, 0.038], [2022, 0.151], [2023, 0.107], [2024, 0.024], [2025, 0.025],
    ].map(([rok, mira]) => ({ rok, mira })),
  };
})(window);
