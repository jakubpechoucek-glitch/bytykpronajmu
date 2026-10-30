# 07 – Otevřené otázky

## 1. Kde budou data? (blokuje implementaci)

Repozitář je veřejný a GitHub Pages také. Data obsahují osobní údaje
nájemníků (GDPR) a citlivé finanční informace.

| Varianta | + | − |
|---|---|---|
| **a) Excel zůstává zdrojem, stránka ho načte z Dropboxu přes přihlášení** | žádná migrace, Excel dál funguje | složitější přihlášení, parsování xlsx v prohlížeči |
| **b) JSON v soukromém úložišti** (soukromé repo / Dropbox), stránka po přihlášení | jednoduché, verzování | data se musí synchronizovat s Excelem |
| **c) Aplikace s backendem a databází** (např. Render + Postgres, přihlášení) | editace v aplikaci, víc uživatelů | víc práce a provozu |
| **d) Repo přepnout na soukromé**, data v něm | nejjednodušší | GitHub Pages ze soukromého repa vyžaduje placený plán |

Doporučení: začít **b)** – import Excelu → JSON v soukromém úložišti,
stránka bez dat je veřejná, data se načtou až po přihlášení. Později
případně přejít na **c)**, až se bude chtít editovat v aplikaci.

## 2. Zůstane Excel primárním zdrojem?

Pokud ano → import se pouští opakovaně a aplikace je jen „pohled".
Pokud ne → po importu se data udržují v aplikaci.

## 3. Interpolace hodnoty v čase

Lineární (jako dnes v Excelu) vs. geometrická (konzistentní s CAGR) vs.
po bodech, pokud se budou evidovat historické odhady.

## 4. Náklady

Evidovat i náklady (fond oprav, pojištění, daň z nemovitosti, opravy,
výmalba, provize RK, daň z příjmu)? Umožní čistý yield a přesnější IRR.

## 5. Jak zacházet se jmény nájemníků

Ukládat celé jméno a kontakt, nebo v aplikaci jen iniciály a kontakt
nechat ve smlouvě (Dropbox)?

## 6. List KATASTR

Prázdný – plánoval se tam výpis z katastru (LV, parcela, podíl na pozemku)?
Podíl na pozemku je relevantní i pro odpisy.
