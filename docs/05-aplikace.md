# 05 – Návrh aplikace

## Obrazovky

```
┌────────────────────────────────────────────────────────────┐
│  Přehled │ Karlín │ Chabry │ Kbely │ Chabry 2 │ Brandýs │ Finance │
└────────────────────────────────────────────────────────────┘
```

### Přehled

1. **Řádek KPI**: hodnota portfolia · pořizovací cena · zhodnocení ·
   roční nájemné · průměrný yield · IRR portfolia.
2. **Upozornění**: smlouvy končící do 3 měsíců, konec fixace hypotéky,
   byt bez nájemce.
3. **Tabulka bytů** (klik → detail): byt, dispozice, m², nájem/měsíc,
   pronajato do, hodnota, CAGR, yield, IRR.
4. **Graf**: hodnota portfolia v čase, skládaná po bytech.
5. **Graf**: roční nájemné po bytech.

### Detail bytu

Rozložení podle karty z Excelu, aby bylo povědomé:

- vlevo **Základní info** + odkazy (mapa, fotogalerie, smlouvy),
- vpravo **Pořízení a hodnota** (KPI dlaždice: cena, cena/m², odhad,
  zhodnocení, CAGR, yield, IRR),
- **Historie pronájmů** – časová osa + tabulka,
- **Hypotéka**,
- **Finance**: tabulka po letech (nájem, yield nom./reál., inflace,
  kumulované nájemné, hodnota, odpis) a graf.

### Finance (souhrn)

Tabulky z listů `CAGR` a `odpisy` pro všechny byty, legenda pásem IRR,
vysvětlení vzorců.

## Technické řešení (návrh)

V souladu s ostatními projekty v
[Rozcestníku](https://github.com/jakubpechoucek-glitch/rozcestnik):

- **Statická stránka** (HTML + JS), hosting GitHub Pages, výpočty v prohlížeči.
- Grafy: knihovna z CDN (např. Chart.js).
- Data: JSON (viz [03-datovy-model.md](03-datovy-model.md)) – **ne ve
  veřejném repu**. Možnosti uložení v [07-otevrene-otazky.md](07-otevrene-otazky.md).
- Import: skript, který z `Karty bytů.xlsx` vygeneruje JSON (jednorázově,
  případně opakovaně, dokud bude Excel primárním zdrojem).
- Responzivní – použitelné na telefonu.
- Po spuštění přidat dlaždici do Rozcestníku (sekce s nemovitostmi;
  v backlogu Rozcestníku už je nápad „Byty – přehled podobný Excelu").

## Fáze

1. **Dokumentace** (tento commit).
2. **Import + přehled** – JSON z Excelu, přehledová stránka.
3. **Detail bytu** – karty, historie pronájmů, odkazy.
4. **Finance** – CAGR, yield, XIRR, odpisy, grafy; porovnání s Excelem.
5. **Editace** – zadávání nového nájmu / odhadu přímo v aplikaci
   (pak už Excel není potřeba).
