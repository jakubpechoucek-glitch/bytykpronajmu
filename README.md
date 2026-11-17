# Byty k pronájmu

Evidence a finanční přehled investičních bytů určených k pronájmu.
Webová aplikace nahrazuje dosavadní Excel **„Karty bytů.xlsx"**
(Dropbox: `/Data z Dellu/Nemovitosti/Karty bytů.xlsx`). Excel posloužil
k jednorázovému importu, dál se vše eviduje a upravuje přímo na webu.

- Web: https://jakubpechoucek-glitch.github.io/bytykpronajmu/ (jen pro přihlášené členy rodiny)
- Ukázka se smyšlenými daty: https://jakubpechoucek-glitch.github.io/bytykpronajmu/?demo

## Cíl

1. **Přehled (high-level)** – všechny byty na jedné stránce: hodnota portfolia,
   aktuální nájmy, obsazenost, souhrnné CAGR / yield / IRR, blížící se termíny
   (konec nájmu, konec fixace hypotéky).
2. **Detail bytu** – samostatná záložka pro každý byt: základní údaje, historie
   pronájmů, hypotéka, odkazy (mapa, fotogalerie, smlouvy) a finanční ukazatele
   s grafy.
3. **Finance** – výpočty, které dnes žijí v pomocných listech Excelu
   (CAGR, yield nominální/reálný, IRR, daňové odpisy).

## Byty v portfoliu

| Byt | Pořízen | Dispozice | Plocha |
|---|---|---|---|
| Karlín | 2010 | 3+kk | 117,1 m² |
| Chabry | 2015 | 3+kk | 78,2 m² |
| Bleriot Kbely | 2020 | 2+kk | 56,7 m² |
| Chabry 2 | 2021 | 2+kk | 52,0 m² |
| Brandýs n. L. | 2025 | 2+kk | 65,1 m² |

## Dokumentace

| Dokument | Obsah |
|---|---|
| [docs/01-zadani.md](docs/01-zadani.md) | Zadání, rozsah, co aplikace má umět |
| [docs/02-zdrojovy-excel.md](docs/02-zdrojovy-excel.md) | Rozbor stávajícího Excelu list po listu |
| [docs/03-datovy-model.md](docs/03-datovy-model.md) | Entity, atributy, formát dat |
| [docs/04-financni-ukazatele.md](docs/04-financni-ukazatele.md) | Vzorce: cena/m², CAGR, yield, IRR, odpisy |
| [docs/05-aplikace.md](docs/05-aplikace.md) | Návrh obrazovek a technického řešení |
| [docs/06-nesrovnalosti-v-datech.md](docs/06-nesrovnalosti-v-datech.md) | Chyby a nejasnosti nalezené v Excelu |
| [docs/07-otevrene-otazky.md](docs/07-otevrene-otazky.md) | Rozhodnutí a otevřené otázky |
| [docs/08-nastaveni-supabase.md](docs/08-nastaveni-supabase.md) | Jednorázové nastavení databáze a přihlášení |
| [docs/10-novy-najem.md](docs/10-novy-najem.md) | Podklad pro nový nájem: inflace z ČSÚ, tržní data, návrh a schválení |
| [docs/11-inflacni-dolozka.md](docs/11-inflacni-dolozka.md) | Inflační doložka u 2letých smluv, hlídání termínů, stránka Termíny |
| [docs/12-odhad-trzni-ceny.md](docs/12-odhad-trzni-ceny.md) | Odhad tržní ceny bytů: zdroje, automatický odhad z indexu ČSÚ (návrh), ruční Atlas cen |
| [docs/09-vyuctovani.md](docs/09-vyuctovani.md) | Vyúčtování záloh nájemníkovi, zálohy a kauce |

## Struktura

```
index.html            aplikace (přehled · detail bytu · finance)
css/app.css
js/finance.js         výpočty (CAGR, yield, XIRR, odpisy, upozornění) – bez DOM
js/najem.js           podklad pro nový nájem (inflace, trh, návrh) – bez DOM
js/odhad.js           automatický odhad ceny bytu z indexu ČSÚ – bez DOM
indexy/               index nájmů z ČSÚ (stahuje GitHub Actions)
.github/workflows/    měsíční stažení indexu nájmů
js/vyuctovani.js      výpočet vyúčtování záloh (měřiče, odečty, přeplatek/nedoplatek) – bez DOM
js/data.js            úložiště: Supabase, nebo paměť (?demo)
js/demo-data.js       smyšlená ukázková data
js/app.js             obrazovky a editace
supabase/schema.sql   tabulky + pravidla přístupu (RLS)
tools/import_excel.py import Excelu → SQL (výstup necommitovat)
tools/test_finance.js testy výpočtů: node tools/test_finance.js
tools/test_najem.js   testy podkladu nájmu: node tools/test_najem.js
tools/test_odhad.js   testy automatického odhadu ceny: node tools/test_odhad.js
tools/stahni_index_cen_bytu.py  stažení indexů cen bytů z ČSÚ
tools/stahni_inflaci_najmu.py  stažení indexu nájmů z ČSÚ
tools/test_vyuctovani.js testy vyúčtování: node tools/test_vyuctovani.js
```

Při změně CSS/JS zvýšit `?v=…` u odkazů v `index.html` (stačí krátký hash
commitu), jinak mobilní prohlížeče drží starou verzi z cache.

Přihlášení zajišťuje společný skript `rozcestnik/auth.js`
(repo [rozcestnik](https://github.com/jakubpechoucek-glitch/rozcestnik)).

## Ochrana dat

Repozitář je **veřejný**, kód neobsahuje žádná data. Skutečná data jsou
v databázi Supabase a číst/zapisovat je smí jen přihlášený člen rodiny
(e-mail v tabulce `clenove`). Ověřuje to databáze, ne stránka. Do gitu
nepatří osobní údaje nájemníků ani vygenerovaný `import.sql` (`data/`,
`*.sql` mimo `supabase/` jsou v `.gitignore`).

## Stav

- [x] Rozbor Excelu a dokumentace
- [x] Rozhodnutí: data za přihlášením, jedno přihlášení na Rozcestníku (Supabase, rodina 4 lidé)
- [x] Databáze, pravidla přístupu, import z Excelu
- [x] Přehled, detail bytu, finance, editace na webu
- [x] Dlaždice v Rozcestníku, Financování RD za přihlášením
- [x] Založit projekt Supabase a vložit klíče (viz docs/08)
- [x] Sloučit do `main` a zapnout GitHub Pages
- [x] Přihlášení přes Google
- [x] Nový nájem: inflace nájmů z ČSÚ se stahuje sama, tržní data zápisem jednou za čtvrtletí, návrh a schválení druhým členem rodiny (docs/10)
- [x] Tabulky `najem_trh`, `najem_navrhy`, `vyuctovani` a sloupce `k_prodeji`, `region_indexu` jsou v databázi (supabase/schema.sql)
- [x] Měsíční stahování indexů z ČSÚ na GitHubu (Actions „Indexy z ČSÚ“) běží
- [x] Zálohy u smluv a vyúčtování záloh s tiskem (docs/09) – po nasazení spustit nový `supabase/schema.sql`
- [ ] Projít po jednom Kbely, Chabry 2, Brandýs a převést starší vyúčtování z Excelů
- [x] Inflační doložka u 2letých smluv, stránka Termíny, čtvrtletní data (docs/11) – po nasazení ověřit na ostrých datech
- [x] Automatický odhad tržní ceny bytů z indexu ČSÚ od 1. 1. 2026 + pole Atlas cen v čtvrtletních datech (docs/12)
