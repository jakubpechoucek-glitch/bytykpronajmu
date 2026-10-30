#!/usr/bin/env python3
"""Jednorázový import „Karty bytů.xlsx" → SQL pro Supabase.

Vstup: Markdown export sešitu (Dropbox → extrakce „markdown"; každý list je
nadpis `## <list>` a tabulka, sloučené buňky se v něm opakují).
Výstup: SQL (insert … on conflict do update) – spustit v Supabase → SQL Editor
až po supabase/schema.sql.

    python3 tools/import_excel.py karty.md > import.sql

Výstup obsahuje osobní údaje nájemníků – NEcommitovat (data/ je v .gitignore).
"""
import re
import sys
from datetime import date, timedelta

# list karty → (id, název, list s měsíčními nájmy)
BYTY = [
    ("KARLÍN", "karlin", "Karlín", "Yield-Karlín"),
    ("CHABRY", "chabry", "Chabry", "Yield-Chabry"),
    ("BLERIOT KBELY", "kbely", "Bleriot Kbely", "Yield-Kbely"),
    ("CHABRY 2", "chabry-2", "Chabry 2", "Yield-Chabry 2"),
    ("BRANDÝS", "brandys", "Brandýs nad Labem", "Yield-Brandys"),
]

# Hypotéky označené v Excelu poznámkou „Splacená"
SPLACENE = {"karlin", "chabry"}

# Ruční opravy zjevných překlepů v Excelu (viz docs/06-nesrovnalosti-v-datech.md)
OPRAVY_KONCE = {("brandys", date(2025, 10, 1)): (date(2026, 9, 30), "V Excelu konec 30.9.2025 (překlep), opraveno na 30.9.2026.")}

# Inflace 2010 v Excelu chybí – doplněna dle ČSÚ
INFLACE_DOPLNIT = {2010: 0.015}

LINK = re.compile(r"\[(.*?)\]\((.*?)\)")


def nacti_listy(md):
    listy, cur = {}, None
    for line in md.splitlines():
        if line.startswith("## "):
            cur = line[3:].strip()
            listy[cur] = []
        elif cur and line.startswith("|"):
            cells = [c.strip() for c in line.strip().strip("|").split("|")]
            if all(re.fullmatch(r":?-+:?", c) for c in cells if c):
                continue
            listy[cur].append(cells)
    return listy


def bez_duplicit(row):
    """Sloučené buňky se v exportu opakují – nech jen první výskyt."""
    out, prev = [], object()
    for c in row:
        if c != prev:
            out.append(c)
        prev = c
    return out


def text(c):
    c = LINK.sub(r"\1", c)
    return re.sub(r"[*_]", "", c).strip()


def odkaz(c):
    m = LINK.search(c)
    return m.group(2) if m else None


def cislo(c):
    c = text(c).replace("Kč", "").replace(" ", "").replace(",", ".")
    try:
        return float(c)
    except ValueError:
        return None


def datum_iso(c):
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", text(c))
    return date(int(m[1]), int(m[2]), int(m[3])) if m else None


def datum_any(s):
    s = s.strip()
    if m := re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})( 00:00:00)?", s):
        return date(int(m[1]), int(m[2]), int(m[3]))
    if m := re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", s):  # US m/d/rrrr
        return date(int(m[3]), int(m[1]), int(m[2]))
    if m := re.fullmatch(r"(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})", s):
        return date(int(m[3]), int(m[2]), int(m[1]))
    raise ValueError(f"neznámý formát data: {s!r}")


def interval(s):
    s = text(s)
    if re.search(r"\d\s*-\s*\d", s) and not re.fullmatch(r"\d{4}-\d{2}-\d{2}.*", s):
        a, b = re.split(r"\s*-\s*", s, maxsplit=1)
        return datum_any(a), datum_any(b)
    return datum_any(s), None


def najdi(rows, label):
    for r in rows:
        if r and text(r[0]) == label:
            return r
    return None


def karta(rows, byt_id, nazev):
    r = [bez_duplicit(x) for x in rows]
    b = {"id": byt_id, "nazev": nazev}

    por = [x for x in r if x and text(x[0]) == "Pořízení"]
    b["porizeni_cena"] = cislo(por[0][2])
    b["porizeni_datum"] = datum_iso(por[1][2])
    odhad = {"datum": datum_iso(por[0][4]), "odkaz": odkaz(por[0][5]),
             "cena_m2": cislo(por[1][-1] if por[1][-1] else por[1][-2]), "zdroj": "Atlas cen"}

    def pole(label):
        x = najdi(r, label)
        return x[1] if x and len(x) > 1 else ""

    b["dispozice"] = text(pole("Dispozice"))
    b["plocha_m2"] = cislo(pole("Plocha [m2]"))
    b["patro"] = text(pole("Patro"))
    gs = re.match(r"(\d+)", text(pole("Gar. Stání")))
    b["garazova_stani"] = int(gs[1]) if gs else None
    b["sklep_m2"] = cislo(pole("Sklep [m2]"))
    b["vybaveni"] = text(pole("Vybavený"))
    v = cislo(pole("Posl. výmalba"))
    b["posledni_vymalba"] = int(v) if v else None

    for x in r:
        for c in x:
            t, u = text(c), odkaz(c)
            if not u:
                continue
            if "GOOGLE" in t:
                b["odkaz_mapa"] = u
            elif "fotogalerii" in t:
                b["odkaz_fotogalerie"] = u
            elif "smlouvou" in t:
                b["odkaz_smlouvy"] = u
    # adresa z odkazu na Google mapy (…/maps/place/<adresa>/…), je-li v něm
    m = re.search(r"/maps/place/([^/@]+)", b.get("odkaz_mapa") or "")
    if m:
        from urllib.parse import unquote_plus
        b["adresa"] = unquote_plus(m[1])

    # pronájmy: řádky *1.* … pod hlavičkou „Pronájem"
    pron = []
    i0 = next(i for i, x in enumerate(r) if x and text(x[0]) == "Pronájem")
    for x in r[i0 + 1:]:
        if not x or not re.fullmatch(r"\d+\.", text(x[0])):
            break
        x = [c for c in x[1:] if c != ""]  # prázdné buňky (sloučené sloupce) pryč
        if not x:
            continue
        najemce, delka, dat = text(x[0]), text(x[1]), x[2]
        od, do = interval(dat)
        rest = x[3:]
        p = {"najemce": najemce, "od": od, "do": do, "delka": delka,
             "najem_mesic": cislo(rest[0]) if rest else None}
        rest = rest[1:]
        if rest and odkaz(rest[0]) and odkaz(rest[0]).startswith("mailto:"):
            p["kontakt"] = text(rest[0])
            rest = rest[1:]
        if rest:
            p["ucet"] = text(rest[0]).title()
            rest = rest[1:]
        if rest:
            d = re.match(r"\D*(\d+)", text(rest[0]))
            p["splatnost_den"] = int(d[1]) if d else None
            rest = rest[1:]
        if rest:
            p["kauce"] = cislo(rest[0])
        pron.append(p)

    pron.sort(key=lambda p: p["od"])
    for a, nxt in zip(pron, pron[1:] + [None]):
        if a["do"] is None and nxt:
            a["do"] = nxt["od"] - timedelta(days=1)
            a["poznamka"] = f"Konec dopočten podle další smlouvy (v Excelu jen „{a['delka']}“)."
        if (byt_id, a["od"]) in OPRAVY_KONCE:
            a["do"], a["poznamka"] = OPRAVY_KONCE[(byt_id, a["od"])]

    # hypotéka
    hyp = None
    vyse = cislo(pole("hypotéka celkem"))
    if vyse:
        fx = re.match(r"(\d+)", text(pole("fixace")))
        hyp = {"vyse": vyse, "splatka_mesic": cislo(pole("výše splátky")),
               "sazba": cislo(pole("výše úrokové sazby")),
               "konec_fixace": datum_iso(pole("datum konce fixace")),
               "fixace_let": int(fx[1]) if fx else None,
               "splacena": byt_id in SPLACENE}
    return b, odhad, pron, hyp


def mesicni_najmy(rows):
    """List Yield-*: řádek = rok, sloupce 1–12 = leden–prosinec."""
    najmy, inflace = [], {}
    hlav = next(r for r in rows if len(r) > 1 and text(r[1]) == "Leden")
    i_infl = next(i for i, c in enumerate(hlav) if text(c) == "Inflace")
    for r in rows:
        if not r or not re.fullmatch(r"\d{4}", text(r[0])):
            continue
        rok = int(text(r[0]))
        for m in range(1, 13):
            v = cislo(r[m]) if m < len(r) else None
            if v:
                najmy.append((date(rok, m, 1), v))
        inf = cislo(r[i_infl]) if i_infl < len(r) else None
        if inf is not None:
            inflace[rok] = inf
    return najmy, inflace


def sql(v):
    if v is None or v == "":
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(round(v, 6)) if isinstance(v, float) else str(v)
    if isinstance(v, date):
        return f"'{v.isoformat()}'"
    return "'" + str(v).replace("'", "''") + "'"


def insert(table, row, conflict, update=True):
    cols = list(row)
    col_sql = ", ".join(f'"{c}"' if c == "do" else c for c in cols)
    vals = ", ".join(sql(row[c]) for c in cols)
    s = f"insert into public.{table} ({col_sql}) values ({vals})"
    if conflict:
        upd = ", ".join(f"{c} = excluded.{c}" for c in cols if c not in conflict.split(","))
        s += f" on conflict ({conflict}) do " + (f"update set {upd}" if update and upd else "nothing")
    return s + ";"


def main():
    listy = nacti_listy(open(sys.argv[1], encoding="utf-8").read())
    out = ["-- Import z Karty bytů.xlsx – vygenerováno tools/import_excel.py",
           "-- Obsahuje osobní údaje. Spustit po supabase/schema.sql.",
           "begin;"]
    inflace = {}
    for poradi, (list_karta, byt_id, nazev, list_yield) in enumerate(BYTY, 1):
        b, odhad, pron, hyp = karta(listy[list_karta], byt_id, nazev)
        b["poradi"] = poradi
        out.append(f"\n-- {nazev}")
        out.append(insert("byty", b, "id"))
        # odhady, pronájmy a hypotéky nemají přirozený klíč → při opakování nahradit
        for t in ("odhady", "pronajmy", "hypoteky"):
            out.append(f"delete from public.{t} where byt_id = {sql(byt_id)};")
        out.append(insert("odhady", {"byt_id": byt_id, **odhad}, None))
        for p in pron:
            p = {k: v for k, v in p.items() if k != "delka"}
            out.append(insert("pronajmy", {"byt_id": byt_id, **p}, None))
        if hyp:
            out.append(insert("hypoteky", {"byt_id": byt_id, **hyp}, None))
        najmy, infl = mesicni_najmy(listy[list_yield])
        inflace.update(infl)
        for mesic, castka in najmy:
            out.append(insert("najemne", {"byt_id": byt_id, "mesic": mesic, "castka": castka}, "byt_id,mesic"))
        print(f"{nazev}: {len(pron)} pronájmů, {len(najmy)} měsíců nájmu, "
              f"hypotéka={'ano' if hyp else 'ne'}", file=sys.stderr)
    out.append("\n-- inflace")
    for rok, mira in sorted({**INFLACE_DOPLNIT, **inflace}.items()):
        out.append(insert("inflace", {"rok": rok, "mira": mira}, "rok"))
    out.append("commit;")
    print("\n".join(out))


if __name__ == "__main__":
    main()
