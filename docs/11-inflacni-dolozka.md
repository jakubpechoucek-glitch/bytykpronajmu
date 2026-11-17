# 11 – Inflační doložka a hlídání termínů

Nájemní smlouvy na 2 roky mají doložku (čl. 4.5): **nájem je pevný první rok, po každém
dalším roce může pronajímatel zvýšit nájem o inflaci** „vyhlášenou ČSÚ nebo ČNB“.
Změna se dělá číselným dodatkem podepsaným oběma stranami (čl. 9.2). Smlouva
**nestanoví lhůtu** pro oznámení zvýšení.

Znění jsem ověřil u smlouvy Karlín 2025–2026. Že mají stejné znění i ostatní 2leté smlouvy
(Chabry, Chabry 2, Brandýs), uvedl majitel; samotné smlouvy se nečetly.

## Co aplikace dělá

- U smlouvy jsou dvě pole: **Inflační doložka** (ano/ne) a **Zvýšení lze uplatnit od**.
  Prázdné datum = první výročí začátku smlouvy (smlouva od 1. 1. 2026 → 1. 1. 2027,
  od 1. 6. 2026 → 1. 6. 2027). Smlouva říká „první kalendářní rok“, u smluv začínajících
  uprostřed roku proto datum ověř a případně zadej ručně.
- Zvýšení se hlídá jen do konce smlouvy: smlouva na 2 roky má jedno možné zvýšení.
- **Vnitřní termíny** (smlouva žádné nezná; rozhodnuto 17. 11. 2026): *začít řešit* a upozornit
  **60 dní** před datem zvýšení, *odeslat oznámení / dodatek* nejpozději **30 dní** před ním
  (zvýšení k 1. 1. 2027: řešit od 2. 11., odeslat do 2. 12.). Čísla jsou konstanty
  `DNI_ZACIT` a `DNI_ODESLAT` v `js/najem.js`.
- Termín je **vyřešený**, když k datu zvýšení existuje schválený nebo odeslaný návrh, nebo
  už platí dodatek od tohoto data. Nechceš-li zvyšovat, zapiš návrh se stejnou částkou jako
  nynější nájem a schval ho.
- Na stránce **Termíny** (`#/terminy`) jsou na jedné ose konec smluv, termíny doložky,
  konec fixace hypotéky a čtvrtletní tržní data. Zmeškané nevyřešené termíny jsou červené.
- Upozornění: červená / žlutá položka v Přehledu a u bytu, počet v menu u „Nový nájem“.
- V podkladu k bytu (Nový nájem) je u smlouvy s doložkou blok s daty a nad ním v tabulce
  varianta „Inflace nájmů“ (nynější nájem × meziroční index nájmů ČSÚ).

## Podle jaké inflace se počítá

**Jen podle inflace nájmů** (index ČSÚ „Nájemné za bydlení“; rozhodnuto 17. 11. 2026).
Poznámka k rozhodnutí: text doložky mluví o „inflaci vyhlášené ČSÚ nebo ČNB“, tedy
obecně. Obecná inflace byla v 10/2026 2,4 %, nájmy +6,4 %. U nových smluv (Karlín od 2027)
lze znění upřesnit na „inflace nájemného z bytu podle ČSÚ“. Nejde o právní radu.

## Databáze

`pronajmy.inflacni_dolozka` (boolean) a `pronajmy.zvyseni_od` (date) – `supabase/schema.sql`.
