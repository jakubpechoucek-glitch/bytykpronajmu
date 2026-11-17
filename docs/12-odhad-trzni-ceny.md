# 12 – Odhad tržní ceny bytu

Cíl: aby tržní hodnota bytů (odhady v kartě bytu, počítá se z nich hodnota, zhodnocení,
CAGR a IRR) byla aktuální bez ručního hledání každý měsíc.

## Co je volně dostupné (ověřeno 17. 11. 2026)

Žádný volný zdroj neumí „cenu konkrétního bytu podle adresy a plochy“ strojově:

| Zdroj | Stav |
|---|---|
| REAS / Atlas cen | web s mapou, API ani stažitelná data jsem nenašel; v roce 2020 katastr zpochybnil zveřejňování cen z katastru (jen zpracované, např. Kč/m²) |
| Katastr (ČÚZK) | otevřená data jsou mapy a registr adres, ceny nemovitostí ne |
| Sreality, Bezrealitky | oficiální API není; jde o nabídkové ceny; podmínky nebyly ověřeny → nepoužívat |
| **ČSÚ, indexy cen bytů** | **zdarma, čtvrtletně, XLSX ke stažení** (níže) |

### ČSÚ – použitelné řady (XLSX na csu.gov.cz)

| Řada | Území | Od | Poslední (ověřeno) | Vydání |
|---|---|---|---|---|
| Indexy realizovaných cen **starších bytů** (2010 = 100) | Praha, ČR bez Prahy, ČR | 1Q 2008 | 2Q 2026 | ~2,5 měsíce po konci čtvrtletí (14. 9.) |
| Indexy realizovaných cen **nových bytů** | Praha | 1Q 2008 | 2Q 2026 | stejné vydání |
| Indexy **nabídkových** cen bytů (2010 = 100) | Praha, ČR bez Prahy, ČR | 2010 | 3Q 2026 | ~1 týden po konci čtvrtletí (5. 10.) |
| Ceny nemovitostí (roční publikace) | **kraje**, okresy, velikost obce | 2023–2025 | rok 2025 | jednou ročně (červenec) |

Strany: `csu.gov.cz/produkty/indexy-realizovanych-cen-bytu-N-ctvrtleti-RRRR` (tabulky
1.1 nové byty Praha, 2.1 starší byty) a `csu.gov.cz/produkty/ceny_bytu` (nabídkové ceny).
Odkaz na soubor obsahuje při každém vydání nové ID, skript by ho musel najít na stránce.
**Čtvrtletní řady nemají Středočeský kraj** (jen Praha / ČR bez Prahy / ČR); kraje jsou jen
v roční publikaci.

### ČSÚ DataStat (API a otevřená data) – stabilní adresa

Dokumentace: `csu.gov.cz/zakladni-informace-pro-pouziti-api-datastatu`. Katalog všech datových sad
je na `https://data.csu.gov.cz/api/katalog/v1/sady` (JSON, ~1 000 sad); celou sadu lze stáhnout jako
CSV na stálé adrese `https://data.csu.gov.cz/opendata/sady/<KÓD>/distribuce/csv` (stejně jako sada
s inflací, kterou už aplikace používá, bez hledání ID souborů).

| Sada | Obsah | Území | Ověřeno |
|---|---|---|---|
| **CEN0401** Indexy cen nemovitostí – data ČÚZK (od 2015) | indexy cen **bytů** a rodinných domů, čtvrtletně (základ 2010 i 2015, meziroční) | ČR a **všechny kraje včetně Prahy a Středočeského kraje** | data končí **4Q 2025** (sada se zřejmě aktualizuje jednou ročně, v létě) |
| **CEN0402** Průměrné kupní ceny nemovitostí (od 2019) | **průměrná cena Kč/m²** bytů | ČR, kraje, **okresy**, velikost obce | roční, poslední rok 2025 |

CEN0401 je tedy pro automatizaci nejlepší základ (stabilní adresa, kraje), ale **nejnovější čtvrtletí
(1Q a 2Q 2026) jsou zatím jen v XLSX** výše (Praha / ČR bez Prahy). CEN0402 dává úroveň cen podle
okresu a velikosti obce; jsou to průměry všech bytů, takže nové byty bývají výrazně nad nimi
(vhodné jen jako kontrola věrohodnosti, ne jako odhad konkrétního bytu).

## Možnost 1 – automatický odhad z indexu (návrh, zatím nepostaveno)

`odhad(měsíc) = poslední kotva (Kč/m²) × index(měsíc) / index(měsíc kotvy)`

- **Kotva** = poslední zadaný odhad bytu (ručně z Atlasu cen, viz možnost 2).
- Index je čtvrtletní → pro měsíc se bere lineárně mezi čtvrtletími.
- **Navržené napojení řad:** základ z DataStatu (CEN0401, kraj bytu); čtvrtletí, která v něm ještě
  chybějí, se doplní růstem z XLSX (Praha starší / nové, ČR bez Prahy pro středočeské byty).
  Po posledním známém čtvrtletí se drží poslední hodnota a odhad se označí „poslední známé“.
- Každý byt má vybranou řadu: Praha starší / Praha nové / ČR bez Prahy (Praha-východ a podobně).
- Výsledek se zapisuje do `odhady` se zdrojem „Automatický odhad (index ČSÚ)“, aby se
  odlišil od ruční kotvy. GitHub Actions měsíčně, jako u indexu nájmů.
- **Omezení:** index říká jen o kolik se trh hýbe, ne jaká je cena konkrétního bytu
  (stav, patro, dům). Závisí tedy na kvalitě kotvy. Zpoždění realizovaných cen je zhruba
  čtvrtletí; rychlejší (ale nabídkový) je index nabídkových cen.
- **Riziko:** ČSÚ mění tvar souborů i adresy (série 014017 byla od 2026 nahrazena publikací
  014016). Skript musí při změně tvaru selhat nahlas a nepřepsat data (jako u indexu nájmů).

## Možnost 2 – ruční kotva jednou za čtvrtletí (postaveno)

V okně **Zapsat čtvrtletní data** je u každého bytu políčko **Atlas cen – cena bytu k prodeji
[Kč/m²]**. Uloží se jako odhad (tabulka `odhady`, zdroj „Atlas cen“, k zadanému datu);
druhý zápis ve stejný den stejný odhad přepíše. Tržní hodnota bytu se počítá z posledního
odhadu. Termín je stejný jako u ostatních čtvrtletních dat (20. 2., 5., 8., 11.).

## Otevřené otázky k možnosti 1

1. Které řady pro které byty (Praha starší / nové / ČR bez Prahy)?
2. Zdroj změny trhu: realizované ceny (přesnější, zpoždění ~čtvrtletí), nebo nabídkové
   (rychlejší, odráží požadavky prodávajících)?
3. Ručně zadanou kotvu přepisovat jen novějším ručním odhadem, nebo ji po čase zastarat?
