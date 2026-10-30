# 01 – Zadání

## Výchozí stav

Veškerá evidence je v jednom Excelu („Karty bytů.xlsx"). Každý byt má svůj
list – „kartu" – se základními údaji, historií pronájmů, hypotékou a odkazy.
Finanční ukazatele se počítají v pomocných listech (`CAGR`, `Yield-*`, `odpisy`)
a na kartu se přebírají.

Slabiny současného stavu:

- chybí souhrnný pohled přes všechny byty (portfolio),
- měsíční nájmy se ručně opisují do listů `Yield-*`, historie pronájmů na kartě
  s nimi nemusí souhlasit,
- vzorce jsou v každém listu zvlášť (různé rozsahy, ruční odkazy) → chyby,
  viz [06-nesrovnalosti-v-datech.md](06-nesrovnalosti-v-datech.md),
- na telefonu se s tím pracuje špatně.

## Co má aplikace umět

### A. Přehled všech bytů (úvodní obrazovka)

- Souhrn portfolia: pořizovací cena celkem, odhadovaná tržní hodnota celkem,
  zhodnocení, roční nájemné, průměrný yield, IRR portfolia.
- Tabulka / karty bytů: název, dispozice, plocha, aktuální nájemce (jen
  příznak „pronajato do …"), měsíční nájem, hodnota, CAGR, yield, IRR.
- Upozornění: končící nájemní smlouvy, konec fixace hypotéky, dlouho
  neprovedená výmalba.
- Graf vývoje hodnoty portfolia v čase (po bytech, skládaný).

### B. Detail bytu (záložka pro každý byt)

- **Základní info**: dispozice, plocha, patro, garážová stání, sklep,
  vybavení, poslední výmalba.
- **Odkazy**: mapa (Google), fotogalerie, složka se smlouvami.
- **Pořízení a hodnota**: datum a cena pořízení, cena za m², odhad současné
  ceny (Atlas cen) a jeho datum, zhodnocení.
- **Historie pronájmů**: nájemce, délka smlouvy, od–do, nájem, kauce,
  splatnost, na jaký účet; počet let v pronájmu.
- **Hypotéka**: výše, splátka, sazba, délka fixace, konec fixace, stav (splacená).
- **Finance**: CAGR, yield nominální a reálný po letech, IRR, kumulované
  nájemné, daňové odpisy – tabulky i grafy.

### C. Finanční výpočty

Definice v [04-financni-ukazatele.md](04-financni-ukazatele.md). Výpočty
se dělají z dat, ne ručně – měsíční nájmy se odvozují z historie pronájmů.

## Mimo rozsah (zatím)

- Účetnictví, daňové přiznání (odpisy jen jako přehled).
- Párování plateb s bankovním výpisem.
- Správa nájemníků (komunikace, upomínky).
