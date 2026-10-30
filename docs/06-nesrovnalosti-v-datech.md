# 06 – Nesrovnalosti nalezené v Excelu

Zjištěno při rozboru (stav souboru k 15. 2. 2026). Při importu je potřeba
je vyřešit nebo potvrdit.

## Výpočty

| # | Kde | Problém | Návrh |
|---|---|---|---|
| 1 | karta BRANDÝS | prosté zhodnocení p.a. = `#DIV/0!` (pořízení i odhad v témže roce) | přesné `n`, pro `n < 1` nezobrazovat |
| 2 | karta BRANDÝS / `CAGR` | CAGR ~27 % za necelý rok – zavádějící | pro `n < 1` zobrazit celkové zhodnocení |
| 3 | karta BRANDÝS | YIELD záporný – nájem jen 3 měsíce, dělený celou cenou a očištěný o roční inflaci | annualizovat / označit neúplný rok |
| 4 | `CAGR` | IRR portfolia nezahrnuje nájmy | doplnit celkové IRR |
| 5 | `Yield-*` | IRR po celých letech, ne XIRR | XIRR s daty |
| 6 | `Yield-*` | legenda IRR nemá pásmo 9–10 % | hranice 4 / 6 / 9 / 12 % |
| 7 | karty | datum odhadu se liší (Karlín 1/2026, ostatní 4/2025), ale CAGR počítá s rokem 2025 u všech | počítat z přesného data odhadu |

## Data

| # | Kde | Problém |
|---|---|---|
| 8 | karta KARLÍN vs. `Yield-Karlín` | nájem na kartě u posledního nájemce neodpovídá částkám v listu Yield (valorizace během smlouvy nejsou na kartě) → model počítá se `zmeny_najmu` |
| 9 | karta KARLÍN vs. `Yield-Karlín` | Yield list začíná nájmem už v 12/2010, karta uvádí prvního nájemce od 3/2012 |
| 10 | karta CHABRY vs. `Yield-Chabry` | první nájem na kartě od 6/2018, ale byt pořízen 2015 – roky 2015–2017 bez nájmu? (yield 0 %) |
| 11 | karta CHABRY | nájemce č. 2 „3 roky" vs. interval 9/2020–5/2022; nájemce č. 3 „2 roky" vs. 6/2022–5/2025 |
| 12 | karta BLERIOT KBELY | nájemce č. 1 „2 roky" vs. 9/2020–12/2023; částka bez „Kč"; Yield list uvádí nájem 16 000 → 19 000, karta 19 000 |
| 13 | karta BRANDÝS | interval nájmu `1.10.2025-30.9.2025` – konec je před začátkem (správně asi 30.9.2026) |
| 15 | karty | „V pronájmu již N let" = rok dneška − rok pořízení, ne skutečná doba pronájmu |
| 16 | karty | formát pole „datum" u pronájmu nejednotný (datum / interval s tečkami / interval s pomlčkou a mezerami) |
| 17 | karty | hypotéky u Karlína a Chabry mají fixaci, která skončila (2020, 2022), a poznámku „Splacená" – potvrdit, že jsou splacené |
| 18 | `odpisy` | záhlaví sloupců neodpovídají obsahu („byt Brandýs" nad částkou bytu Kbely, „byt Polaneckého" = Kbely?) |
| 19 | `odpisy` | u bytu Chabry vychází 1. rok odpisu na 2014, byt ale pořízen 2015; u Karlína a Chabry chybí v listu roky před 2021 |
| 20 | `KATASTR` | prázdný list – co tam mělo být? |
| 21 | karty | hypertextové odkazy (mapa, fotogalerie, smlouvy) – ověřit, že vedou na správná místa |
