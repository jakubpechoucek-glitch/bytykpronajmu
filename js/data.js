// Datová vrstva: Supabase (ostrá data za přihlášením) nebo paměť (?demo).
// Rozhraní obou úložišť:
//   nacti()                  → { byty, odhady, pronajmy, najemne, hypoteky, inflace }
//   uloz(tabulka, radek, puvodni) → uložený řádek (puvodni = null → nový záznam)
//   smaz(tabulka, radek)
(function (root) {
  "use strict";

  // Primární klíče; `identity` = id generuje databáze, nesmí se posílat
  const TABULKY = {
    byty:     { pk: ["id"] },
    odhady:   { pk: ["id"], identity: true },
    pronajmy: { pk: ["id"], identity: true },
    najemne:  { pk: ["byt_id", "mesic"] },
    hypoteky: { pk: ["id"], identity: true },
    inflace:  { pk: ["rok"] },
  };

  function bezIdentity(t, radek) {
    const r = { ...radek };
    if (TABULKY[t].identity) delete r.id;
    return r;
  }

  function supabaseUloziste(client) {
    const chyba = (error) => {
      if (error) throw new Error(error.message || String(error));
    };
    return {
      ostra: true,
      async nacti() {
        const out = {};
        await Promise.all(Object.keys(TABULKY).map(async (t) => {
          const { data, error } = await client.from(t).select("*");
          chyba(error);
          out[t] = data;
        }));
        return out;
      },
      async uloz(t, radek, puvodni) {
        let q;
        if (puvodni) {
          q = client.from(t).update(bezIdentity(t, radek));
          for (const k of TABULKY[t].pk) q = q.eq(k, puvodni[k]);
        } else {
          q = client.from(t).insert(bezIdentity(t, radek));
        }
        const { data, error } = await q.select().single();
        chyba(error);
        return data;
      },
      async smaz(t, radek) {
        let q = client.from(t).delete();
        for (const k of TABULKY[t].pk) q = q.eq(k, radek[k]);
        const { error } = await q;
        chyba(error);
      },
    };
  }

  function pametoveUloziste(vychozi) {
    const db = JSON.parse(JSON.stringify(vychozi));
    let dalsiId = 1000;
    const shoda = (t, a, b) => TABULKY[t].pk.every((k) => String(a[k]) === String(b[k]));
    return {
      ostra: false,
      async nacti() {
        return JSON.parse(JSON.stringify(db));
      },
      async uloz(t, radek, puvodni) {
        const r = { ...radek };
        if (puvodni) {
          const i = db[t].findIndex((x) => shoda(t, x, puvodni));
          if (TABULKY[t].identity) r.id = puvodni.id;
          db[t][i] = { ...db[t][i], ...r };
          return db[t][i];
        }
        if (TABULKY[t].identity) r.id = dalsiId++;
        if (db[t].some((x) => shoda(t, x, r))) throw new Error("Záznam se stejným klíčem už existuje.");
        db[t].push(r);
        return r;
      },
      async smaz(t, radek) {
        db[t] = db[t].filter((x) => !shoda(t, x, radek));
      },
    };
  }

  root.Data = { TABULKY, supabaseUloziste, pametoveUloziste };
})(window);
