# 04 – Finanční ukazatele

> Implementace: `js/finance.js`, testy `tools/test_finance.js`.

Vzorce odvozené z Excelu (ověřené zpětným přepočtem hodnot v listech).
U každého je poznámka, zda ho v aplikaci převzít beze změny, nebo upravit.

Značení: `P` = pořizovací cena, `t0` = datum pořízení, `V` = odhad současné
hodnoty, `t1` = datum odhadu, `n` = počet let mezi `t0` a `t1`.

## Cena za m²

```
cena_m2_porizeni = P / plocha
V = cena_m2_odhad × plocha            (cena_m2_odhad z Atlasu cen)
```

## Prosté roční zhodnocení (karta, buňka bez popisku)

```
prosté_zhodnocení_pa = (V / P − 1) / n
```

Excel bere `n` jako rozdíl kalendářních let → u bytu koupeného v roce odhadu
vyjde `n = 0` a `#DIV/0!` (Brandýs).
**V aplikaci**: `n` počítat z přesných dat (`(t1 − t0) / 365,25`), ukazatel
zobrazit jen pro `n ≥ 1`, jinak „—".

## CAGR – průměrný roční růst hodnoty

```
CAGR = (V / P)^(1/n) − 1
```

Excel opět používá celé roky. Pro byt držený < 1 rok dává zavádějící
hodnotu (Brandýs ~27 % – ve skutečnosti růst za ~1 rok, a navíc jde hlavně
o rozdíl mezi kupní cenou a odhadem Atlasu).
**V aplikaci**: přesné `n`, pro `n < 1` zobrazit celkové zhodnocení místo CAGR.

### Vývoj hodnoty po letech

Excel interpoluje hodnotu lineárně: `V(rok) = P + (V − P) × (rok − rok0) / n`.
**V aplikaci**: pokud bude více odhadů, interpolovat mezi nimi; jinak
geometricky (konzistentní s CAGR) nebo lineárně – viz otevřené otázky.

## Yield (nájemní výnos)

```
roční_nájem(rok)   = Σ měsíčních nájmů v roce
yield_nominální    = roční_nájem / P
yield_reálný       = (1 + yield_nominální) / (1 + inflace) − 1
```

Na kartě se zobrazuje **reálný yield posledního roku**.

Poznámky:
- Yield se počítá z **pořizovací** ceny (yield on cost). Doplnit i yield
  z **aktuální hodnoty** (`roční_nájem / V`) – lépe vypovídá o tom, zda byt
  dnes „vydělává" vzhledem k tomu, kolik je v něm vázáno.
- Neúplný rok (pořízení / první nájem v půlce roku) dává nízký yield –
  v aplikaci annualizovat nebo označit jako neúplný rok.
- Hrubý yield (bez nákladů). Do budoucna možno doplnit čistý yield
  (− fond oprav, pojištění, daň z nemovitosti, opravy, neobsazenost).

## Kumulované nájemné

Průběžný součet ročního nájmu od pořízení.

## IRR bytu (list `Yield-<byt>`)

Peněžní toky po letech:

```
CF(rok pořízení)     = −P (+ nájem v roce pořízení)
CF(další roky)       = roční nájem
CF(rok po odhadu)    = V                 (hypotetický prodej za odhad)
IRR: Σ CF_i / (1+IRR)^i = 0
```

**V aplikaci**: počítat **XIRR** z měsíčních toků s přesnými daty
(nájmy chodí měsíčně, nákup i odhad mají konkrétní datum). Výsledky se proti
Excelu mírně posunou.

Pásma pro výklad (z Excelu):

| IRR | Výklad | Typicky |
|---|---|---|
| < 4 % | nízké, často horší než spořicí účet / státní dluhopisy | slabý nájem, přepálená cena |
| 4–6 % | konzervativní, relativně bezpečné | prémiové byty ve velkých městech |
| 6–9 % | solidní výnos u dlouhodobých pronájmů | běžné investiční byty s hypotékou |
| 10–12 % | výborný výnos | dobře koupené nemovitosti, vyšší páka |
| > 12 % | skvělé, ale obvykle vyšší riziko | Airbnb, spekulace, přestavby |

(Excel nemá pásmo 9–10 % – sjednotit na hranice 4 / 6 / 9 / 12 %.)

## IRR portfolia (list `CAGR`)

Toky: nákupy bytů (záporně) v letech pořízení, na konci hodnota celého
portfolia. **Nezahrnuje nájmy** → je to vlastně CAGR portfolia vážený
časem investic.
**V aplikaci**: zobrazit dvě čísla – *IRR z hodnoty* (jako Excel) a
*celkové IRR* (hodnota + nájmy, tj. XIRR přes všechny toky všech bytů).

## Hypotéka / páka (doplnit)

Excel eviduje hypotéky, ale ve výpočtech je nepoužívá. Ukazatele
(zatím všechny byty splacené / bez hypotéky, proto nízká priorita):
cash-on-cash výnos, IRR vlastního kapitálu, LTV.

## Daňové odpisy

Rovnoměrné odpisy, odpisová skupina 5, 30 let:

```
odpis(1. rok)       = vstupní_cena × 1,4 %
odpis(2.–30. rok)   = vstupní_cena × 3,4 %
```

Přehled po letech pro každý byt + součet za všechny byty. Pozn.: odpisuje
se jen stavba, ne pozemek / podíl na pozemku – ověřit, zda vstupní cena
v Excelu odpovídá (dnes = celá pořizovací cena).
