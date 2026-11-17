#!/usr/bin/env python3
"""Stáhne z ČSÚ čtvrtletní indexy realizovaných cen bytů a uloží je do indexy/ceny-bytu.json.

Zdroje (volně dostupné, zdarma):
 1. ZÁKLAD – DataStat, sada CEN0401 „Indexy cen nemovitostí – data ČÚZK“ (CSV na stálé adrese),
    byty, základ 2010 = 100, kraje Praha a Středočeský. Sada se aktualizuje zhruba jednou ročně.
 2. DOPLNĚNÍ – čtvrtletní XLSX „Indexy realizovaných cen starších bytů“ (csu.gov.cz), řady Praha
    a ČR bez Prahy. Má novější čtvrtletí než základ; používá se jen na prodloužení základu
    (v aplikaci js/odhad.js: základ × růst doplňující řady).

Spouští ho GitHub Actions (.github/workflows/indexy.yml), jde pustit i ručně:
    python3 tools/stahni_index_cen_bytu.py      (potřebuje openpyxl: pip install openpyxl)

Soubor obsahuje jen veřejná čísla. Při chybě (síť, změna formátu, nesmyslná čísla) skript skončí
chybou a původní soubor nepřepíše; aplikace pak ukáže stáří dat.
"""
import csv
import datetime
import html
import io
import json
import os
import re
import sys
import time
import urllib.request

try:
    import openpyxl
except ImportError:  # srozumitelná hláška místo tracebacku
    raise SystemExit("CHYBA: chybí balíček openpyxl (pip install openpyxl).")

URL_ZAKLAD = "https://data.csu.gov.cz/opendata/sady/CEN0401/distribuce/csv"
URL_STRANKA = "https://csu.gov.cz/produkty/indexy-realizovanych-cen-bytu-{q}-ctvrtleti-{rok}"
URL_ROOT = "https://csu.gov.cz"
VYSTUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "indexy", "ceny-bytu.json")

KRAJE = {"Hlavní město Praha": "praha", "Středočeský kraj": "stredocesky"}
UA = {"User-Agent": "byty-index-cen/1.0"}


def stahni(url, pokusu=3, timeout=180):
    posledni = None
    for i in range(pokusu):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception as e:
            posledni = e
            print(f"Pokus {i + 1}/{pokusu} selhal ({url}): {e}", file=sys.stderr)
            time.sleep(5 * (i + 1))
    raise SystemExit(f"CHYBA: stažení se nepodařilo ({url}): {posledni}")


def zaklad():
    """CEN0401: byty, základ 2010 = 100, čtvrtletně, Praha a Středočeský kraj."""
    r = csv.DictReader(io.StringIO(stahni(URL_ZAKLAD).decode("utf-8-sig")))
    potrebne = {"Druh nemovitosti", "Typ údaje", "Území-Kraj", "Roky, čtvrtletí-Rok", "Roky, čtvrtletí-Čtvrtletí", "Hodnota"}
    if not potrebne <= set(r.fieldnames or []):
        raise SystemExit(f"CHYBA: DataStat změnil sloupce v CEN0401, chybí: {sorted(potrebne - set(r.fieldnames or []))}")
    out = {k: {} for k in KRAJE.values()}
    for x in r:
        if x["Druh nemovitosti"] != "Byty" or x["Typ údaje"] != "Bazický index (2010 = 100)":
            continue
        kraj = KRAJE.get(x["Území-Kraj"])
        m = re.match(r"(\d)\. čtvrtletí (\d{4})", x["Roky, čtvrtletí-Čtvrtletí"] or "")
        if not kraj or not m or not x["Hodnota"]:
            continue
        out[kraj][(int(m.group(2)), int(m.group(1)))] = float(x["Hodnota"])
    return out


def najdi_xlsx():
    """Najde nejnovější vydání „Indexy realizovaných cen bytů“ a v něm tabulku 2.1 (starší byty)."""
    dnes = datetime.date.today()
    kandidati = []
    rok, q = dnes.year, (dnes.month - 1) // 3 + 1
    for _ in range(6):
        kandidati.append((rok, q))
        q -= 1
        if q == 0:
            rok, q = rok - 1, 4
    for rok, q in kandidati:
        url = URL_STRANKA.format(q=q, rok=rok)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                stranka = r.read().decode("utf-8", "ignore")
        except Exception:
            continue  # vydání pro toto čtvrtletí ještě není
        for href, text in re.findall(r'<a[^>]+href="([^"]*\.xlsx[^"]*)"[^>]*>(.*?)</a>', stranka, flags=re.S):
            popis = html.unescape(re.sub(r"<[^>]+>", "", text)).strip()
            if popis.startswith("2.1") and "starších bytů" in popis:
                return url, URL_ROOT + html.unescape(href)
    raise SystemExit("CHYBA: nenašel jsem stránku „Indexy realizovaných cen bytů“ s tabulkou 2.1 (starší byty).")


def doplneni(url_xlsx):
    """Starší byty: sloupce Praha a ČR bez Prahy z prvního bloku (průměr 2010 = 100)."""
    wb = openpyxl.load_workbook(io.BytesIO(stahni(url_xlsx)), data_only=True)
    ws = wb[wb.sheetnames[0]]
    radky = list(ws.iter_rows(values_only=True))
    hlava = next((r for r in radky if "Praha" in r and "ČR bez Prahy" in r), None)
    if hlava is None:
        raise SystemExit("CHYBA: v tabulce starších bytů nenacházím sloupce Praha / ČR bez Prahy (změnil se formát?).")
    c_praha, c_bez = hlava.index("Praha"), hlava.index("ČR bez Prahy")
    out = {"praha": {}, "stredocesky": {}}
    for r in radky:
        m = re.fullmatch(r"(\d)q/(\d{4})", str(r[c_praha - 1]).strip()) if c_praha > 0 else None
        if not m:
            continue
        kv = (int(m.group(2)), int(m.group(1)))
        if isinstance(r[c_praha], (int, float)):
            out["praha"][kv] = float(r[c_praha])
        if isinstance(r[c_bez], (int, float)):
            out["stredocesky"][kv] = float(r[c_bez])  # Středočeský kraj: v čtvrtletní řadě je jen „ČR bez Prahy“
    return out


def seznam(d):
    return [{"r": r, "q": q, "idx": v} for (r, q), v in sorted(d.items())]


def over(serie, nazev):
    for kraj, d in serie.items():
        if len(d) < 20:
            raise SystemExit(f"CHYBA: {nazev} / {kraj}: jen {len(d)} čtvrtletí (čekám ≥ 20).")
        for (r, q), v in d.items():
            if not 50 <= v <= 800:
                raise SystemExit(f"CHYBA: {nazev} / {kraj}: nesmyslná hodnota {v} za {q}/{r}.")
        posledni = max(d)
        stari = (datetime.date.today() - datetime.date(posledni[0], posledni[1] * 3, 28)).days
        if stari > 900:
            raise SystemExit(f"CHYBA: {nazev} / {kraj}: poslední čtvrtletí {posledni[1]}/{posledni[0]} je příliš staré.")


def main():
    z = zaklad()
    over(z, "základ (DataStat CEN0401)")
    url_stranka, url_xlsx = najdi_xlsx()
    d = doplneni(url_xlsx)
    over(d, "doplnění (XLSX)")
    out = {
        "stazeno": datetime.date.today().isoformat(),
        "zdroj_zaklad": URL_ZAKLAD,
        "zdroj_doplneni": url_stranka,
        "popis": "Indexy realizovaných cen bytů, čtvrtletně, 2010 = 100. kraje = DataStat CEN0401 (Praha, Středočeský kraj); "
                 "doplneni = starší byty z XLSX (Praha; Středočeský kraj aproximován řadou ČR bez Prahy), jen na prodloužení základu.",
        "posledni_zaklad": "%d-Q%d" % max(z["praha"]),
        "posledni_doplneni": "%d-Q%d" % max(d["praha"]),
        "kraje": {k: seznam(v) for k, v in z.items()},
        "doplneni": {k: seznam(v) for k, v in d.items()},
    }
    os.makedirs(os.path.dirname(VYSTUP), exist_ok=True)
    with open(VYSTUP, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"OK: základ do {out['posledni_zaklad']}, doplnění do {out['posledni_doplneni']} ({url_stranka})")


if __name__ == "__main__":
    main()
