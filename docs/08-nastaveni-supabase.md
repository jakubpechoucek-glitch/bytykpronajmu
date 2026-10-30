# 08 – Nastavení Supabase a přihlášení (jednorázově)

Přihlášení je společné pro všechny weby na `jakubpechoucek-glitch.github.io`.
Přihlašuje se na [Rozcestníku](https://jakubpechoucek-glitch.github.io/rozcestnik/).
Chráněné weby (Byty, Financování RD) nepřihlášeného pošlou tam a po přihlášení
ho vrátí zpět.

```
Rozcestník (přihlášení) ──┐  localStorage „rodina-auth" (stejný origin)
Byty k pronájmu ──────────┼── rozcestnik/auth.js ── Supabase Auth
Financování RD ───────────┘                   └──── Supabase DB (RLS: jen clenove)
```

## 1. Projekt

1. [supabase.com](https://supabase.com) → **New project** (plán Free,
   region Frankfurt `eu-central-1`).
2. **Project Settings → API**: zkopírovat **Project URL** a **anon / publishable
   key** a vložit je do `rozcestnik/auth.js` (`SUPABASE_URL`, `SUPABASE_KEY`).
   Anon klíč je veřejný, data chrání pravidla v databázi.
   *(service_role / secret klíč nikdy nikam nevkládat ani neposílat.)*

## 2. Databáze

**SQL Editor → New query**, vložit a spustit:

1. `supabase/schema.sql` (tabulky, pravidla přístupu),
2. `import.sql` (data z Excelu, vygenerované `tools/import_excel.py`;
   obsahuje osobní údaje, proto **není v repu**),
3. členy rodiny:

```sql
insert into public.clenove (email, jmeno) values
  ('jakub@…',   'Jakub'),
  ('…@…',       '…'),
  ('…@…',       '…'),
  ('…@…',       '…');
```

Člena odebere `delete from public.clenove where email = '…';`. Přestane
vidět data okamžitě, i když je zrovna přihlášený.

## 3. Přihlašování

**Authentication → Sign In / Providers**

- **Allow new users to sign up: vypnout.** Účty zakládá jen správce.
- **Email**: zapnuto.

**Authentication → Users → Add user → Create new user**: pro každého člena
zadat e-mail, heslo a zaškrtnout *Auto Confirm User*. Heslo si pak každý
může změnit na Rozcestníku („Změnit heslo").

**Authentication → URL Configuration**

- Site URL: `https://jakubpechoucek-glitch.github.io/rozcestnik/`
- Redirect URLs: `https://jakubpechoucek-glitch.github.io/**`

## 4. Přihlášení přes Google (volitelné)

1. [Google Cloud Console](https://console.cloud.google.com) → nový projekt →
   **APIs & Services → OAuth consent screen**: External, název „Rodina",
   e-mail podpory. Stačí režim *Testing* s přidanými 4 e-maily jako
   *Test users*, nebo aplikaci publikovat (pro základní rozsah e-mail/profil
   není potřeba ověření Googlem).
2. **Credentials → Create credentials → OAuth client ID** → *Web application*
   - Authorized JavaScript origins: `https://jakubpechoucek-glitch.github.io`
   - Authorized redirect URIs: `https://<projekt>.supabase.co/auth/v1/callback`
     (přesnou adresu ukazuje Supabase u providera Google).
3. Supabase → **Authentication → Sign In / Providers → Google**: zapnout,
   vložit *Client ID* a *Client Secret*.

Google účet člena se spáruje s jeho uživatelem podle e-mailu. Uživatel
proto musí existovat (krok 3) se **stejnou adresou, jakou má Google účet**.
Přístup pak hlídá tabulka `clenove`.

## 5. Zveřejnění

Weby se publikují z větve `main` (GitHub Pages). Po sloučení změn do `main`
v repech `rozcestnik`, `bytykpronajmu` a `assets_dashboard`:

- `bytykpronajmu` → **Settings → Pages → Deploy from a branch → `main` / root**
  (zatím Pages zapnuté nemá).

## Ukázkový režim

`…/bytykpronajmu/?demo` – smyšlená data v paměti, bez přihlášení. Slouží
k vyzkoušení a testům, nic neukládá.
