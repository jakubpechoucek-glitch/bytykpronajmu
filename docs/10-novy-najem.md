# 09 – Podklad pro nový nájem

Záložka **Nový nájem** (`#/najem`, u jednoho bytu `#/najem/<id>`) nahrazuje ruční
Word dokumenty „… – nové nájemné od …“. Pro každý byt (seřazeno podle konce
smlouvy) ukáže:

| Řádek | Odkud |
|---|---|
| Nynější nájem | poslední / běžící smlouva v aplikaci |
| Inflace nájmů | nynější nájem × meziroční index „Nájemné za bydlení“ (ČSÚ) – **stahuje se samo** |
| Deloitte Rent Index | Kč/m² × plocha bytu – zapisuje se **ručně jednou za čtvrtletí** |
| Cenová mapa MF | Kč/m² × plocha bytu – zapisuje se **ručně jednou za čtvrtletí** |
| Tvůj návrh | zapíšeš ty, druhý člen rodiny ho schválí přímo v aplikaci |

Návrh má stavy **návrh → schváleno → odesláno nájemníkovi**; ukládá se, kdo ho
naposledy upravil a kdo schválil. Změna částky schváleného návrhu ho vrátí zpět
na „návrh“. Do záložky v menu se píše počet bytů, které je potřeba řešit
(smlouva končí do 120 dnů nebo už skončila a nemají schválený návrh).

## Co se stahuje automaticky a co ne (ověřeno 17. 11. 2026)

| Zdroj | Stav | Proč |
|---|---|---|
| ČSÚ – index nájmů | **automaticky** | Otevřená data (CSV, ~70 MB): `data.csu.gov.cz/opendata/sady/CEN0101E/distribuce/csv`. Skript vybere řádky `041` (nájemné za bydlení), `IR` (meziroční index), Česko, domácnosti celkem. Srpen 2026 = 106,1 %, souhlasí s ČSÚ i s dosavadními dokumenty. |
| Cenová mapa MF | ručně | Kalkulačka je webový formulář chráněný reCAPTCHA (ochrana proti automatům) a jiný ke stažení jsem nenašel. Ochranu neobcházíme. |
| Deloitte Rent Index | ručně | Vychází jako PDF s infografikou; adresu nové zprávy nejde předem odvodit a rozložení se mění. |
| Sreality, Bezrealitky | nestahuje se | Podmínky webů jsem neověřoval; cenová mapa MF z těchto inzerátů stejně vychází. |

Ruční zápis je jediné okno **Zapsat čtvrtletní data**: datum, a pro každý byt dvě
čísla (Deloitte, MF). U políček je vidět, co bylo zapsáno naposled. Prázdné pole
= beze změny. Údaje starší než 135 dní se označí „zastaralé“.

## Kdy zapisovat čtvrtletní data

**Do 20. února, května, srpna a listopadu.** Ministerstvo financí zveřejňuje cenovou
mapu nejpozději 45 dnů po konci čtvrtletí (vyhláška 456/2024 Sb.), tedy do 14.–15. dne
těchto měsíců; 20. je termín s rezervou. U Deloitte Rent Indexu pevné datum vydání
neznám, proto se řídí stejným termínem (předpoklad).

Aplikace na stránce Nový nájem v panelu „Zdroje dat“ ukazuje, kdy je další zápis, a když
termín nastal a poslední zápis je starší (nebo žádný), zobrazí varování. Zápis do 14 dnů
před termínem se ještě počítá za nynější kolo. V Google Kalendáři je opakovaná událost
na 20. 2., 5., 8. a 11.

Termíny a inflační doložka (zvýšení nájmu po prvním roce) viz [11](11-inflacni-dolozka.md).

## Stahování z ČSÚ

- Skript `tools/stahni_inflaci_najmu.py` (jen standardní Python) vytvoří
  `indexy/najemne-cpi.json` – jen veřejná čísla, žádná osobní data.
- Spouští ho GitHub Actions `.github/workflows/indexy.yml` 12. a 20. v měsíci
  (ČSÚ zveřejňuje kolem 10.) a jde pustit ručně: GitHub → Actions → „Index nájmů
  z ČSÚ“ → Run workflow. Změněný soubor sám commitne do `main`.
- Při chybě (síť, změna formátu CSV, nesmyslné hodnoty, příliš staré údaje)
  skript skončí chybou a **soubor nepřepíše**; GitHub pošle e-mail o neúspěšném
  běhu a aplikace ukáže „Data ČSÚ jsou stará N dní“.

## Databáze

Dvě nové tabulky v `supabase/schema.sql`: `najem_trh` (tržní Kč/m² podle bytu,
zdroje a data) a `najem_navrhy` (návrh, stav, kdo upravil / schválil). Stejná
pravidla přístupu jako ostatní tabulky (`je_clen()`). Dokud tabulky v databázi
nejsou, aplikace funguje dál a záložka Nový nájem ukáže červené upozornění.
**Jednorázově je potřeba spustit nový `schema.sql`** (Supabase → SQL Editor, viz
[08](08-nastaveni-supabase.md)); skript je idempotentní.

## Soubory

```
js/najem.js                       výpočty podkladu (bez DOM), testy: node tools/test_najem.js
indexy/najemne-cpi.json           index nájmů z ČSÚ (vytváří Actions)
tools/stahni_inflaci_najmu.py     stažení a kontrola dat ČSÚ
.github/workflows/indexy.yml      měsíční úloha
```

## Možné pokračování

- Upozornění e-mailem 3 měsíce před koncem smlouvy (teď jen v aplikaci: červená
  položka v Přehledu, odznak v menu).
- Koncept e-mailu nájemníkovi v Gmailu po schválení.
