# 07 – Otevřené otázky

## 1. Přihlášení a uložení dat – ROZHODNUTO (30. 10. 2026)

**Rozhodnutí:** data budou za přihlášením. Přihlašuje se jednou, na
Rozcestníku, a ostatní weby uživatele poznají (single sign-on).

Technická omezení, ze kterých návrh vychází:

- Heslo v JavaScriptu statické stránky na GitHub Pages **není ochrana**.
  Zdrojový kód i data si stáhne kdokoli. Data musí vydávat služba, která
  přihlášení ověří na serveru.
- **Soukromé repo neschová web.** GitHub Pages ze soukromého repa vyžaduje
  placený plán (GitHub Pro) a publikovaný web je i tak veřejný. Řízení přístupu
  k Pages nabízí jen GitHub Enterprise. Soukromé repo tedy chrání jen zdrojový
  kód a historii, ne data.
- Rozcestník i většina webů běží na `jakubpechoucek-glitch.github.io/<repo>/`,
  tedy na **jednom originu**. Přihlášení uložené v prohlížeči proto vidí
  všechny tyto weby. Aplikace na `*.onrender.com` jsou jiný origin.

Návrh (čeká na potvrzení, viz otázky 1a–1c):

| Varianta | Jak | + | − |
|---|---|---|---|
| **A) Supabase Auth + databáze** (doporučeno) | přihlášení jménem (e-mailem) a heslem na Rozcestníku; data bytů v databázi Supabase s pravidly „čte jen přihlášený"; stránky zůstávají na GitHub Pages | zdarma, žádná vlastní doména ani server, skutečná ochrana dat, SSO mezi všemi weby na github.io zadarmo | weby na Render potřebují přihlášení zvlášť (nebo předání tokenu); HTML stránek samotné zůstává veřejné (bez dat) |
| **B) Cloudflare Access + vlastní doména** | všechny weby přesunout na subdomény (`byty.domena.cz`, …), Cloudflare před ně postaví přihlašovací zeď | chrání celé weby včetně HTML, bez úprav kódu, jedno přihlášení pro všechno | potřeba doména (~250 Kč/rok), přihlášení kódem z e-mailu nebo Google účtem, ne vlastním jménem a heslem |

### Otevřené dílčí otázky

- **1a)** Kdo bude mít přístup (jen majitel / rodina / účetní)? Mají všichni
  vidět všechno, nebo jen něco?
- **1b)** Varianta A, nebo B?
- **1c)** Které další weby z Rozcestníku mají jít za zeď
  (např. `assets_dashboard`)?

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
