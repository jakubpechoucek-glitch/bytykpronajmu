-- Byty k pronájmu – databázové schéma pro Supabase.
-- Spustit jednou v Supabase → SQL Editor. Skript je idempotentní
-- (lze ho pustit znovu, existující data nemaže).
--
-- Přístup: číst i zapisovat smí jen přihlášený uživatel, jehož e-mail je
-- v tabulce `clenove` (rodina). Ostatní (anon, cizí účty) nevidí nic.

-- ---------------------------------------------------------------- členové
create table if not exists public.clenove (
  email text primary key,
  jmeno text not null
);

-- Je přihlášený uživatel člen rodiny? (security definer: čte `clenove`
-- i bez práva na tabulku; používají ho pravidla RLS i weby přes RPC)
create or replace function public.je_clen()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clenove
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Jméno přihlášeného člena (pro „Přihlášen: …" v hlavičce webů)
create or replace function public.moje_jmeno()
returns text
language sql stable security definer
set search_path = public
as $$
  select jmeno from public.clenove
  where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- ---------------------------------------------------------------- byty
create table if not exists public.byty (
  id                  text primary key,          -- 'karlin', 'chabry-2', …
  poradi              int  not null default 0,
  nazev               text not null,
  adresa              text,
  dispozice           text,
  plocha_m2           numeric(8,2),
  patro               text,
  garazova_stani      int,
  sklep_m2            numeric(8,2),
  vybaveni            text,
  posledni_vymalba    int,
  porizeni_datum      date,
  porizeni_cena       numeric(14,2),
  odpisy_vstupni_cena numeric(14,2),             -- prázdné = pořizovací cena
  odkaz_mapa          text,
  odkaz_fotogalerie   text,
  odkaz_smlouvy       text,
  poznamka            text
);

-- byt, který se bude prodávat: v menu a přehledech se řadí úplně dole
alter table public.byty add column if not exists k_prodeji boolean not null default false;

-- Odhady tržní ceny (Atlas cen apod.); poslední = aktuální hodnota bytu
create table if not exists public.odhady (
  id      bigint generated always as identity primary key,
  byt_id  text not null references public.byty(id) on delete cascade on update cascade,
  datum   date not null,
  cena_m2 numeric(12,2) not null,
  zdroj   text,
  odkaz   text
);

-- Nájemní smlouvy
create table if not exists public.pronajmy (
  id            bigint generated always as identity primary key,
  byt_id        text not null references public.byty(id) on delete cascade on update cascade,
  najemce       text not null,
  kontakt       text,
  od            date not null,
  "do"          date,
  najem_mesic   numeric(12,2),
  kauce         numeric(12,2),
  splatnost_den int,
  ucet          text,
  poznamka      text,
  -- jeden řádek = jedna smlouva nebo dodatek (prodloužení, změna nájemného)
  typ           text not null default 'smlouva' check (typ in ('smlouva','dodatek')),
  dokument      text,  -- cesta k souboru v Dropboxu nebo URL
  zaloha_mesic  numeric(12,2)  -- měsíční záloha na služby (voda, teplo, SVJ…)
);
-- pro databáze založené starší verzí skriptu
alter table public.pronajmy add column if not exists typ text not null default 'smlouva' check (typ in ('smlouva','dodatek'));
alter table public.pronajmy add column if not exists dokument text;
-- inflační doložka: nájem lze po prvním roce zvýšit o inflaci (docs/11-inflacni-dolozka.md)
alter table public.pronajmy add column if not exists inflacni_dolozka boolean not null default false;
alter table public.pronajmy add column if not exists zvyseni_od date;   -- prázdné = první výročí začátku smlouvy
alter table public.pronajmy add column if not exists zaloha_mesic numeric(12,2);

-- Skutečně inkasované nájemné po měsících (mesic = 1. den měsíce)
create table if not exists public.najemne (
  byt_id text not null references public.byty(id) on delete cascade on update cascade,
  mesic  date not null check (extract(day from mesic) = 1),
  castka numeric(12,2) not null,
  primary key (byt_id, mesic)
);

-- Vyúčtování záloh na služby nájemníkovi (jednou ročně).
-- `polozky` = pole položek (měřiče, denní sazby, pevné částky, odečty – např.
-- Fond oprav); výpočet dělá web (js/vyuctovani.js), v databázi jsou vstupy.
create table if not exists public.vyuctovani (
  id             bigint generated always as identity primary key,
  byt_id         text not null references public.byty(id) on delete cascade on update cascade,
  rok            int  not null,
  od             date not null,
  "do"           date not null,
  najemce        text,                 -- jméno nájemce v době vyúčtování
  zaloha_mesic   numeric(12,2),
  mesicu         numeric(5,2),         -- za kolik měsíců se zálohy platily
  zalohy_celkem  numeric(12,2),        -- prázdné = záloha × měsíců (vyplnit, když se záloha v roce měnila)
  polozky        jsonb not null default '[]'::jsonb,
  odeslano       date,                 -- kdy bylo vyúčtování odesláno nájemníkovi
  poznamka       text
);
create index if not exists vyuctovani_byt_idx on public.vyuctovani(byt_id, rok);

-- Hypotéky
create table if not exists public.hypoteky (
  id            bigint generated always as identity primary key,
  byt_id        text not null references public.byty(id) on delete cascade on update cascade,
  vyse          numeric(14,2),
  splatka_mesic numeric(12,2),
  sazba         numeric(7,5),                    -- 0.0139 = 1,39 %
  fixace_let    int,
  konec_fixace  date,
  splacena      boolean not null default false,
  poznamka      text
);

-- Průměrná roční inflace (ČSÚ), 0.022 = 2,2 %
create table if not exists public.inflace (
  rok  int primary key,
  mira numeric(7,5) not null
);

-- Tržní nájemné za m² z externích zdrojů (Deloitte Rent Index, cenová mapa MF…);
-- zapisuje se jednou za čtvrtletí, slouží jako podklad pro nové nájemné
create table if not exists public.najem_trh (
  id      bigint generated always as identity primary key,
  byt_id  text not null references public.byty(id) on delete cascade on update cascade,
  datum   date not null,                         -- ke kterému dni údaj platí / kdy byl zjištěn
  zdroj   text not null check (zdroj in ('deloitte','mf','jiny')),
  kc_m2   numeric(10,2) not null,
  poznamka text
);

-- Návrh nového nájemného (konzultace s Janou) – jeden řádek = jedno prodloužení
create table if not exists public.najem_navrhy (
  id        bigint generated always as identity primary key,
  byt_id    text not null references public.byty(id) on delete cascade on update cascade,
  plati_od  date not null,                       -- od kdy má nové nájemné platit
  navrh     numeric(12,2) not null,
  stav      text not null default 'navrh' check (stav in ('navrh','schvaleno','odeslano')),
  poznamka  text,
  upravil   text,                                -- kdo naposledy změnil
  upraveno  timestamptz not null default now(),
  schvalil  text,
  schvaleno timestamptz
);

create index if not exists odhady_byt_idx   on public.odhady(byt_id, datum);
create index if not exists pronajmy_byt_idx on public.pronajmy(byt_id, od);
create index if not exists hypoteky_byt_idx on public.hypoteky(byt_id);
create index if not exists najem_trh_byt_idx on public.najem_trh(byt_id, datum);
create index if not exists najem_navrhy_byt_idx on public.najem_navrhy(byt_id, plati_od);

-- ---------------------------------------------------------------- RLS
alter table public.clenove  enable row level security;
alter table public.byty     enable row level security;
alter table public.odhady   enable row level security;
alter table public.pronajmy enable row level security;
alter table public.najemne  enable row level security;
alter table public.hypoteky enable row level security;
alter table public.vyuctovani enable row level security;
alter table public.inflace  enable row level security;
alter table public.najem_trh    enable row level security;
alter table public.najem_navrhy enable row level security;

do $$
declare t text;
begin
  -- členové: číst smí jen členové, měnit jen přes SQL Editor
  drop policy if exists clen_cte on public.clenove;
  create policy clen_cte on public.clenove
    for select to authenticated using (public.je_clen());

  foreach t in array array['byty','odhady','pronajmy','najemne','hypoteky','inflace','vyuctovani','najem_trh','najem_navrhy'] loop
    execute format('drop policy if exists rodina on public.%I', t);
    execute format(
      'create policy rodina on public.%I for all to authenticated
         using (public.je_clen()) with check (public.je_clen())', t);
  end loop;
end $$;

revoke all on function public.je_clen()    from public, anon;
revoke all on function public.moje_jmeno() from public, anon;
grant execute on function public.je_clen()    to authenticated;
grant execute on function public.moje_jmeno() to authenticated;
