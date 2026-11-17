#!/usr/bin/env python3
"""Stáhne z otevřených dat ČSÚ meziroční index cen „Nájemné za bydlení“
(COICOP 04.1, Česko, domácnosti celkem) a uloží ho do indexy/najemne-cpi.json.

Zdroj: https://data.csu.gov.cz/opendata/sady/CEN0101E/distribuce/csv (~70 MB)
Spouští ho měsíčně GitHub Actions (.github/workflows/indexy.yml), jde pustit
i ručně:  python3 tools/stahni_inflaci_najmu.py

Soubor obsahuje jen veřejná čísla, žádná osobní data. Při chybě (síť,
změna formátu, nesmyslná čísla) skript skončí s chybou a původní soubor
nepřepíše – Actions pak pošle e-mail o neúspěšném běhu a aplikace ukáže,
že data ČSÚ jsou stará.
"""
import csv
import datetime
import io
import re
import json
import os
import sys
import time
import urllib.request

URL = "https://data.csu.gov.cz/opendata/sady/CEN0101E/distribuce/csv"
VYSTUP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "indexy", "najemne-cpi.json")

SKUPINA = "041"       # Nájemné za bydlení (042 = imputované nájemné vlastníků, to nechceme)
TYP = "IR"            # meziroční index (předchozí rok = 100)
UZEMI = "CZ"
SKUPINA_DOMACNOSTI = "0"  # domácnosti celkem


def stahni(pokusu=3):
    posledni = None
    for i in range(pokusu):
        try:
            req = urllib.request.Request(URL, headers={"User-Agent": "byty-najem-index/1.0"})
            with urllib.request.urlopen(req, timeout=180) as r:
                return r.read()
        except Exception as e:  # síť, 5xx …
            posledni = e
            print(f"Pokus {i + 1}/{pokusu} selhal: {e}", file=sys.stderr)
            time.sleep(5 * (i + 1))
    raise SystemExit(f"CHYBA: stažení z ČSÚ se nepodařilo: {posledni}")


def zpracuj(surova):
    text = io.StringIO(surova.decode("utf-8-sig"))
    r = csv.DictReader(text)
    potrebne = {"TYPUDAJE4A", "CZCOICOP2.CZCOP23", "UZ02P", "EKAKTIOCDS", "CASMKMQRM12", "Hodnota"}
    if not potrebne <= set(r.fieldnames or []):
        raise SystemExit(f"CHYBA: ČSÚ změnil sloupce v CSV, chybí: {sorted(potrebne - set(r.fieldnames or []))}")
    mesice = {}
    for x in r:
        if (x["CZCOICOP2.CZCOP23"] == SKUPINA and x["TYPUDAJE4A"] == TYP
                and x["UZ02P"] == UZEMI and x["EKAKTIOCDS"] == SKUPINA_DOMACNOSTI):
            m = x["CASMKMQRM12"]
            # jen čisté měsíce YYYY-MM (řádky „YYYY-MMK“ jsou kumulace, „YYYY-Qn“ čtvrtletí)
            if re.fullmatch(r"\d{4}-\d{2}", m) and x["Hodnota"]:
                mesice[m] = float(x["Hodnota"])
    return dict(sorted(mesice.items()))


def over(mesice):
    if len(mesice) < 100:
        raise SystemExit(f"CHYBA: v datech ČSÚ je jen {len(mesice)} měsíců (čekám ≥ 100).")
    for m, v in mesice.items():
        if not 80 <= v <= 160:
            raise SystemExit(f"CHYBA: nesmyslná hodnota indexu {v} za {m}.")
    posledni = datetime.date.fromisoformat(max(mesice) + "-01")
    stari = (datetime.date.today() - posledni).days
    if stari > 120:
        raise SystemExit(f"CHYBA: nejnovější měsíc v datech ČSÚ je {max(mesice)} (starý {stari} dní).")


def main():
    mesice = zpracuj(stahni())
    over(mesice)
    # od roku 2018 stačí, soubor zůstane malý
    mesice = {m: v for m, v in mesice.items() if m >= "2018-01"}
    out = {
        "zdroj": URL,
        "nazev": "Index spotřebitelských cen – Nájemné za bydlení (COICOP 04.1), meziroční index, Česko",
        "stazeno": datetime.date.today().isoformat(),
        "posledni_mesic": max(mesice),
        "mesice": [{"m": m, "idx": v} for m, v in mesice.items()],
    }
    os.makedirs(os.path.dirname(VYSTUP), exist_ok=True)
    with open(VYSTUP, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"OK: {len(mesice)} měsíců, poslední {out['posledni_mesic']}: {mesice[out['posledni_mesic']]}")


if __name__ == "__main__":
    main()
