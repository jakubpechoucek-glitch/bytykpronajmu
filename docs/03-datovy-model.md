# 03 – Datový model

Návrh struktury, do které se převedou data z Excelu. Klíčová změna proti
Excelu: **měsíční nájmy se nezadávají ručně**, odvozují se z historie
pronájmů (a případně se přepíšou výjimkou – sleva, neuhrazený měsíc, změna
nájmu v průběhu smlouvy).

## Entity

```
Byt 1───* Pronajem
Byt 1───* OdhadCeny
Byt 1───0..* Hypoteka
Byt 1───* Odkaz
Byt 1───* PlatbaVyjimka      (volitelné korekce měsíčních nájmů)
Inflace                      (číselník rok → % )
```

### Byt

| Atribut | Typ | Pozn. |
|---|---|---|
| `id` | string | `karlin`, `chabry`, `kbely`, `chabry-2`, `brandys` |
| `nazev` | string | „Karlín" |
| `adresa` | string | volitelné |
| `dispozice` | string | „3+kk" |
| `plocha_m2` | number | |
| `patro` | string | „2. NP" |
| `garazova_stani` | int | |
| `sklep_m2` | number \| null | |
| `vybaveni` | string | „NE" / „ANO" / volný text |
| `posledni_vymalba` | int (rok) | |
| `porizeni_datum` | date | |
| `porizeni_cena` | number (Kč) | vč. vedlejších nákladů |
| `odpisy_vstupni_cena` | number (Kč) | obvykle = pořizovací cena |

### OdhadCeny

| Atribut | Typ | Pozn. |
|---|---|---|
| `byt_id` | ref | |
| `datum` | date | |
| `cena_m2` | number | z Atlasu cen |
| `zdroj` | string | „Atlas cen" |

Odhad celkem = `cena_m2 × plocha_m2`. Historie odhadů umožní skutečnou
křivku hodnoty místo lineární interpolace.

### Pronajem

| Atribut | Typ | Pozn. |
|---|---|---|
| `byt_id` | ref | |
| `poradi` | int | |
| `najemce` | string | **osobní údaj** |
| `kontakt` | string | **osobní údaj** |
| `od` | date | |
| `do` | date \| null | null = na dobu neurčitou / běží |
| `najem_mesic` | number | |
| `zmeny_najmu` | list `{od, najem_mesic}` | valorizace během smlouvy |
| `kauce` | number | |
| `splatnost_den` | int | den v měsíci |
| `ucet` | string | čí účet (jméno) |

### Hypoteka

`byt_id`, `vyse`, `splatka_mesic`, `sazba`, `fixace_let`, `konec_fixace`,
`splacena` (bool).

### Odkaz

`byt_id`, `typ` (`mapa` / `fotogalerie` / `smlouvy` / jiný), `url`.

### PlatbaVyjimka

`byt_id`, `mesic` (YYYY-MM), `castka` – přepíše odvozený nájem pro daný měsíc.

### Inflace

`rok`, `procento` – zdroj ČSÚ (průměrná roční míra inflace).

## Formát uložení

Navrženo jako JSON (jeden soubor nebo soubor na byt), např.:

```json
{
  "id": "karlin",
  "nazev": "Karlín",
  "dispozice": "3+kk",
  "plocha_m2": 117.1,
  "porizeni": { "datum": "2010-12-01", "cena": 0 },
  "odhady": [{ "datum": "2026-01-01", "cena_m2": 0, "zdroj": "Atlas cen" }],
  "pronajmy": [
    { "od": "2012-03-15", "do": "2013-03-14", "najem_mesic": 0, "kauce": 0 }
  ],
  "hypoteka": { "splacena": true },
  "odkazy": { "mapa": "", "fotogalerie": "", "smlouvy": "" }
}
```

Hodnoty `0` a prázdné řetězce jsou zástupné – skutečná data do veřejného
repozitáře nepatří (viz [07-otevrene-otazky.md](07-otevrene-otazky.md)).
