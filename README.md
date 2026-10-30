# Byty k pronájmu

Evidence a finanční přehled investičních bytů určených k pronájmu.
Projekt nahrazuje (a později doplňuje) dosavadní Excel **„Karty bytů.xlsx"**
(Dropbox: `/Data z Dellu/Nemovitosti/Karty bytů.xlsx`).

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
| [docs/07-otevrene-otazky.md](docs/07-otevrene-otazky.md) | Rozhodnutí, která je potřeba udělat |

## Ochrana dat

Repozitář je **veřejný**. Do gitu proto nepatří osobní údaje nájemníků
(jména, e-maily, telefony), čísla účtů, smlouvy ani přesné finanční údaje.
Skutečná data drží `data/` (v `.gitignore`) nebo externí úložiště – viz
[docs/07-otevrene-otazky.md](docs/07-otevrene-otazky.md).

## Stav

- [x] Rozbor Excelu a dokumentace
- [ ] Rozhodnutí o uložení dat a hostingu
- [ ] Import dat z Excelu
- [ ] Přehled všech bytů
- [ ] Detail bytu
- [ ] Finanční ukazatele a grafy
- [ ] Dlaždice v [Rozcestníku](https://github.com/jakubpechoucek-glitch/rozcestnik)
