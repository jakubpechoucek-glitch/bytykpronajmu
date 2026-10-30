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

Varianty:

| Varianta | Jak | + | − |
|---|---|---|---|
| **A) Supabase Auth + databáze** (doporučeno) | přihlášení jménem (e-mailem) a heslem na Rozcestníku; data bytů v databázi Supabase s pravidly „čte jen přihlášený"; stránky zůstávají na GitHub Pages | zdarma, žádná vlastní doména ani server, skutečná ochrana dat, SSO mezi všemi weby na github.io zadarmo | weby na Render potřebují přihlášení zvlášť (nebo předání tokenu); HTML stránek samotné zůstává veřejné (bez dat) |
| **B) Cloudflare Access + vlastní doména** | všechny weby přesunout na subdomény (`byty.domena.cz`, …), Cloudflare před ně postaví přihlašovací zeď | chrání celé weby včetně HTML, bez úprav kódu, jedno přihlášení pro všechno | potřeba doména (~250 Kč/rok), přihlášení kódem z e-mailu nebo Google účtem, ne vlastním jménem a heslem |

**Rozhodnuto (30. 10. 2026):**

- Varianta **A – Supabase**, přihlášení e-mailem a heslem nebo účtem Google.
- Přístup: celá rodina (4 lidé), všichni vidí a upravují vše.
- Za zeď jde i **Financování RD** (`assets_dashboard`).
- Repa zůstávají veřejná, data v nich nejsou.
- Postup nastavení: [08-nastaveni-supabase.md](08-nastaveni-supabase.md).

**Pozor – Financování RD:** stránka teď vyžaduje přihlášení, ale data čte
z Google Sheetu sdíleného „kdokoli s odkazem". ID sheetu je ve veřejném kódu,
takže data samotná chráněná nejsou. Řešení: přesunout data do Supabase,
nebo sheet zneveřejnit a číst ho přes Google účet. Čeká na rozhodnutí.

## 2. Zůstane Excel primárním zdrojem? – ROZHODNUTO

Ne. Excel byl jen na jednorázový import, dál se vše eviduje na webu.

## 3. Interpolace hodnoty v čase

Zatím **lineárně mezi body** (pořízení a jednotlivé odhady). Při jednom
odhadu je to totéž co Excel, s více odhady se křivka zpřesňuje. Alternativa:
geometricky (konzistentní s CAGR).

## 4. Náklady

Evidovat i náklady (fond oprav, pojištění, daň z nemovitosti, opravy,
výmalba, provize RK, daň z příjmu)? Umožní čistý yield a přesnější IRR.

## 5. Jak zacházet se jmény nájemníků

Ukládat celé jméno a kontakt, nebo v aplikaci jen iniciály a kontakt
nechat ve smlouvě (Dropbox)?

## 6. List KATASTR

Prázdný – plánoval se tam výpis z katastru (LV, parcela, podíl na pozemku)?
Podíl na pozemku je relevantní i pro odpisy.
