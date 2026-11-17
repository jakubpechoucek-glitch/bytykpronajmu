# 09 – Vyúčtování záloh nájemníkovi

Dosud se vyúčtování počítalo v Excelu „Vyúčtování záloh za služby spojené
s využíváním bytu" (jeden soubor na byt a rok). Teď je součástí detailu bytu
(sekce **Vyúčtování záloh**). Skutečná čísla a jména jsou jen v databázi,
tady je popis postupu.

## Jak vyúčtování vzniká

1. Správce domu / SVJ pošle roční vyúčtování – obvykle **dva dokumenty**:
   - *obecné* (náklady na jednotku po složkách: odvoz odpadu, výtahy,
     úklid, fond oprav, …, výsledek proti platbám vlastníka),
   - *podrobné* (měřiče: spotřeba teplé a studené vody a tepla, jednotkové ceny).
2. Z nich se pro nájemníka složí vyúčtování: měřiče × ceny + ostatní
   náklady, případně **odečet** položek, které nájemník neplatí (Fond oprav).
3. Výsledek = zálohy zaplacené nájemníkem − náklady. Kladné = přeplatek
   (vracíme), záporné = nedoplatek (doplácí).

## Datový model

- `pronajmy.zaloha_mesic` – měsíční záloha na služby podle smlouvy/dodatku
  (kauce už tam byla jako `kauce`). Změna zálohy = nový řádek typu dodatek.
- `vyuctovani` – jedno vyúčtování: `rok`, `od`, `do`, `najemce`,
  `zaloha_mesic`, `mesicu`, `zalohy_celkem` (přepis, když se záloha v roce
  měnila), `odeslano`, `poznamka`, `polozky` (JSON).

Položky (`polozky`) mají typ:

| typ | k čemu | náklad |
|---|---|---|
| `meridlo` | teplá/studená voda, teplo | (stav do − stav od, nebo ručně zadaná spotřeba) × cena za jednotku |
| `den` | denní sazba (ostatní náklady) | sazba × počet dní |
| `castka` | pevná částka (např. náklady SVJ na byt) | částka |
| `odpocet` | **odečet** (Fond oprav, …) | −částka |

Dva měřiče téhož druhu (např. dva vodoměry) = dvě položky se stejnou cenou.
Odečty jsou samostatné řádky, takže je vidět, co se odečetlo. Vzorce:
`js/vyuctovani.js`, testy: `node tools/test_vyuctovani.js`.

## Postup na webu

1. **+ Nové vyúčtování** – rok se navrhne, zálohy a nájemce se doplní ze smluv,
   položky se zkopírují z minulého roku (koncový stav měřiče = nový počáteční).
2. Doplnit stavy měřičů, ceny a částky z dokumentů správce.
3. **Tisk / PDF** – čistá listina pro nájemníka.
4. Po odeslání vyplnit datum „Odesláno".

## Praxe se liší podle bytu

Z vyúčtování za rok 2025 (zkontrolováno: Karlín, Chabry; ostatní byty dle Excelů
zatím jen namátkou):

| | Karlín | Chabry |
|---|---|---|
| Dokumenty od správce | jedno vyúčtování domu (SVJ) obsahuje vše včetně měřičů | **dva různé subjekty**: správce domu (poplatky SVJ) a měřicí firma (teplo, voda) |
| Voda a teplo | spotřeba z měřičů v bytě (2× teplá, 2× studená voda, teplo), ceny = náklad SVJ / spotřeba | měřiče 1× teplá, studená, teplo; cena teplé vody zahrnuje i ohřev; teplo se přepočítává koeficienty (zadat jako „spotřeba ručně") |
| „Ostatní náklady" | náklady SVJ na jednotku **minus** voda a teplo (jedna částka) | denní sazba × dny, nebo částka ze SVJ bez voda/teplo |
| Fond oprav | je součástí nákladů jednotky ve vyúčtování SVJ; v Excelu se **neodečítá** (k ověření, viz níže) | v Excelu za 2024 se **neodečítal** (je v ostatních nákladech) |
| Délka období | celý rok | celý rok i část roku (nový nájemník od června) |

## Úplný přehled praxe podle importu z Excelů (2023–2026)

- **Fond oprav se odečítá jen u Kbel (Bleriot)** – tam je odečten už při výpočtu
  ostatních nákladů. Karlín a Chabry (2024) ho mají v nákladech nájemníka.
  Chabry 2 a Brandýs: ostatní náklady jsou zadané jako denní sazba/částka,
  z Excelu není vidět, zda Fond oprav obsahují.
- **Ukončení nájmu** (Kbely 2026): k vyúčtování se přidává vyrovnání kauce –
  kauce včetně úroků − nedoplatek minulého roku − srážky (oprava, výmalba)
  = částka k vrácení. Web na to má typy položek *Kauce* a *Srážka z kauce*.
- **Dva měřiče téhož druhu** (Karlín, Chabry 2): spotřeba se sečte a zadá
  jednou „Spotřeba ručně“.
- **Přesná částka z dokladu:** u měřiče a denní sazby je pole „Částka ručně“,
  které přepíše výpočet (Excel počítá s neokrouhlenými cenami).
- **Starší Excely počítaly 364 dní** (rok), část roku jinak; web nově 365.

## Otevřené otázky

1. **Karlín 2025 – Fond oprav**: v Excelu pro nájemníka je „ostatní náklady"
   odvozené z celkových nákladů jednotky včetně Fondu oprav. U ostatních bytů
   se Fond oprav odečítá. Je to záměr (smlouva), nebo chyba?
2. **Počet dní**: Excel počítá celý rok jako 364 dní (rozdíl dat), web 365
   (včetně obou krajních dnů). Pokud má zůstat 364, stačí dny přepsat.
3. Byty Kbely (Bleriot), Chabry 2 a Brandýs je potřeba projít po jednom –
   zatím vychází, že se vejdou do stejných čtyř typů položek.
