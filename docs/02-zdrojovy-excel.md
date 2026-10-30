# 02 – Rozbor zdrojového Excelu

Soubor: `Karty bytů.xlsx` (Dropbox, `/Data z Dellu/Nemovitosti/`),
naposledy upraven 15. 2. 2026. Listy:

| List | Typ | Obsah |
|---|---|---|
| `KARLÍN`, `CHABRY`, `BLERIOT KBELY`, `CHABRY 2`, `BRANDÝS` | karta bytu | údaje o jednom bytu |
| `odpisy` | výpočet | daňové odpisy všech bytů po letech |
| `KATASTR` | – | prázdný |
| `CAGR` | výpočet | vývoj hodnoty bytů po letech, CAGR, IRR portfolia |
| `Yield-Karlín`, `Yield-Chabry`, `Yield-Kbely`, `Yield-Chabry 2`, `Yield-Brandys` | výpočet | měsíční nájmy, yield, IRR jednoho bytu |

## Karta bytu

Všechny karty mají stejné rozložení:

**Hlavička** – `<BYT> - <rok>`, datum pořízení a datum odhadu, pořizovací cena
a odhad současné ceny.

**Pořízení**

| Pole | Příklad formátu | Poznámka |
|---|---|---|
| cena | Kč | pořizovací cena vč. nákladů |
| datum | datum | datum pořízení |
| cena za m² | Kč | = cena / plocha |
| odhad stávající ceny (Atlas cen) | Kč, datum | = cena za m² dle Atlasu × plocha |
| na m² | Kč | tržní cena za m² (ručně z Atlasu cen) |
| % p.a. (bez popisku) | % | prosté (nesložené) roční zhodnocení |
| CAGR | % | z listu `CAGR` |
| YIELD | % | reálný yield posledního roku z listu `Yield-*` |

**Pronájem** – tabulka s řádky 1.–5.(6.):

| Sloupec | Poznámka |
|---|---|
| jméno nájemce | osobní údaj |
| na jak dlouho | text („1 rok", „0,5 roku", „3 roky") |
| datum | různé formáty: jedno datum, nebo interval `d.m.rrrr-d.m.rrrr` |
| částka | měsíční nájem |
| kontakt | e-mail – osobní údaj |
| na účet | čí účet (jméno) |
| ke dni | splatnost v měsíci („do 25.", „25", „1.") |
| kauce | Kč |

Pod tabulkou „V pronájmu již N let/roků".

**Základní info** – dispozice, plocha [m²], patro, garážová stání,
sklep [m²], vybavený (ANO/NE nebo text), poslední výmalba (rok).
Vedle odkazy: *mapy GOOGLE*, *fotogalerie*, *složka se smlouvou*
(hypertextové odkazy – textovou extrakcí nejsou vidět, nutno přečíst ze souboru).

**Hypotéka** – hypotéka celkem, výše splátky, úroková sazba, datum konce
fixace, fixace (roky); případně poznámka „Splacená".

## List `CAGR`

- Řádky = konce let (31. 12. 2010 … 2033), sloupce = byty.
- Hodnota bytu v roce se **lineárně interpoluje** mezi pořizovací cenou
  a dnešním odhadem.
- Sloupec *Celkem* = hodnota portfolia.
- Sloupec *IIR* (tj. IRR) = peněžní toky portfolia: nákupy záporně,
  v posledním roce hodnota portfolia kladně → **IRR portfolia** (horní buňka,
  „průměrné roční tempo růstu").
- Pravá tabulka: CAGR jednotlivých bytů k danému roku.
- Poslední řádek: CAGR každého bytu + celkové.

Pozn.: IRR v tomto listu počítá jen se změnou hodnoty, **bez nájmů**.

## Listy `Yield-<byt>`

- Řádky = roky, sloupce = měsíce leden–prosinec s inkasovaným nájmem.
- Součet za rok, **yield nominální** = roční nájem / pořizovací cena.
- **Inflace** (ručně, ČSÚ) a **yield reálný**.
- Kumulované nájemné.
- Peněžní toky pro **IRR**: −pořizovací cena, roční nájmy, v roce po
  posledním odhadu kladná hodnota bytu dle odhadu.
- Legenda „Co to znamená?" – pásma IRR (< 4 %, 4–6 %, 6–9 %, 10–12 %, > 12 %)
  s výkladem.

## List `odpisy`

Daňové odpisy rovnoměrné, 30 let (odpisová skupina 5): 1. rok 1,4 %,
další roky 3,4 % ze vstupní ceny. Pro každý byt sloupce *odpisy / pořadí roku /
rok* a průběžný součet *Celkem* za všechny byty v daném roce.
