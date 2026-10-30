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
  najmy("vinohrady", "2023-03", "2026-09", 23500);
  najmy("holesovice", "2019-09", "2022-08", 18000);
  najmy("holesovice", "2022-10", "2025-12", 21000);
  najmy("ricany", "2024-05", "2026-08", 17000);

  root.DEMO_DATA = {
    byty: [
      { id: "vinohrady", poradi: 1, nazev: "Vinohrady", adresa: "Ukázková 1, Praha 2", dispozice: "2+1", plocha_m2: 68, patro: "4. NP",
        garazova_stani: 0, sklep_m2: 3.5, vybaveni: "kuchyň", posledni_vymalba: 2023, porizeni_datum: "2013-11-15", porizeni_cena: 3900000,
        odkaz_mapa: "https://maps.google.com", odkaz_fotogalerie: "", odkaz_smlouvy: "", poznamka: "Ukázkový byt" },
      { id: "holesovice", poradi: 2, nazev: "Holešovice", adresa: "Vzorová 22, Praha 7", dispozice: "2+kk", plocha_m2: 54, patro: "2. NP",
        garazova_stani: 1, sklep_m2: null, vybaveni: "NE", posledni_vymalba: 2022, porizeni_datum: "2019-06-01", porizeni_cena: 5200000 },
      { id: "ricany", poradi: 3, nazev: "Říčany", adresa: "", dispozice: "1+kk", plocha_m2: 36, patro: "1. NP",
        garazova_stani: 1, sklep_m2: 2, vybaveni: "ANO", posledni_vymalba: 2024, porizeni_datum: "2024-02-20", porizeni_cena: 3600000 },
    ],
    odhady: [
      { id: 1, byt_id: "vinohrady", datum: "2020-01-01", cena_m2: 105000, zdroj: "Atlas cen" },
      { id: 2, byt_id: "vinohrady", datum: "2026-03-01", cena_m2: 148000, zdroj: "Atlas cen" },
      { id: 3, byt_id: "holesovice", datum: "2026-03-01", cena_m2: 139000, zdroj: "Atlas cen" },
      { id: 4, byt_id: "ricany", datum: "2026-03-01", cena_m2: 108000, zdroj: "Atlas cen" },
    ],
    pronajmy: [
      { id: 1, byt_id: "vinohrady", najemce: "Nájemce A", od: "2014-03-01", do: "2016-12-31", najem_mesic: 15000, kauce: 30000, splatnost_den: 15 },
      { id: 2, byt_id: "vinohrady", najemce: "Nájemce B", od: "2017-02-01", do: "2020-01-31", najem_mesic: 17500, kauce: 35000, splatnost_den: 15 },
      { id: 3, byt_id: "vinohrady", najemce: "Nájemce C", od: "2020-03-01", do: "2023-02-28", najem_mesic: 19000, kauce: 40000, splatnost_den: 25 },
      { id: 4, byt_id: "vinohrady", najemce: "Nájemce D", od: "2023-03-01", do: "2026-12-31", najem_mesic: 23500, kauce: 47000, splatnost_den: 25, kontakt: "najemce.d@example.com" },
      { id: 5, byt_id: "holesovice", najemce: "Nájemce E", od: "2019-09-01", do: "2022-08-31", najem_mesic: 18000, kauce: 36000, splatnost_den: 20 },
      { id: 6, byt_id: "holesovice", najemce: "Nájemce F", od: "2022-10-01", do: "2025-12-31", najem_mesic: 21000, kauce: 42000, splatnost_den: 20 },
      { id: 7, byt_id: "ricany", najemce: "Nájemce G", od: "2024-05-01", do: "2027-04-30", najem_mesic: 17000, kauce: 34000, splatnost_den: 25 },
    ],
    najemne,
    hypoteky: [
      { id: 1, byt_id: "ricany", vyse: 2500000, splatka_mesic: 13800, sazba: 0.0489, fixace_let: 3, konec_fixace: "2027-02-20", splacena: false },
    ],
    inflace: [
      [2013, 0.014], [2014, 0.004], [2015, 0.003], [2016, 0.007], [2017, 0.025], [2018, 0.021], [2019, 0.028],
      [2020, 0.032], [2021, 0.038], [2022, 0.151], [2023, 0.107], [2024, 0.024], [2025, 0.025],
    ].map(([rok, mira]) => ({ rok, mira })),
  };
})(window);
