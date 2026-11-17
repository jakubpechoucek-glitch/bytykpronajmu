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
- **Vnitřní termíny** (smlouva žádné nezná): *začít řešit* 3 měsíce před datem zvýšení,
  *odeslat oznámení / dodatek* 2 měsíce před (pro zvýšení k 1. 1. tedy do 1. 11.).
- Termín je **vyřešený**, když k datu zvýšení existuje schválený nebo odeslaný návrh, nebo
  už platí dodatek od tohoto data. Nechceš-li zvyšovat, zapiš návrh se stejnou částkou jako
  nynější nájem a schval ho.
- Na stránce **Termíny** (`#/terminy`) jsou na jedné ose konec smluv, termíny doložky,
  konec fixace hypotéky a čtvrtletní tržní data. Zmeškané nevyřešené termíny jsou červené.
- Upozornění: červená / žlutá položka v Přehledu a u bytu, počet v menu u „Nový nájem“.
- V podkladu k bytu (Nový nájem) jsou **obě inflace vedle sebe** a vysvětlení rozdílu.

## Inflace nájmů, nebo obecná inflace?

Doložka mluví o **inflaci vyhlášené ČSÚ nebo ČNB**, tedy o obecné inflaci. Aplikace
dosud počítala s inflací nájmů (index „Nájemné za bydlení“), která vychází výš
(10/2026: nájmy +6,4 %, obecná +2,4 %). Proto se ukazují obě a u bytu s doložkou je
upozornění. Nejde o právní radu; u nových smluv (Karlín od 2027) lze znění doložky upřesnit.

Obecnou inflaci stahuje stejný skript jako index nájmů (`tools/stahni_inflaci_najmu.py`,
klíč `obecna` v `indexy/najemne-cpi.json`): řádek „Úhrn“, meziroční index, Česko, domácnosti
celkem. Ověřeno proti stejnému souboru: nájmy za 8/2026 = 6,1 % (sedí s dosavadními
podklady), obecná inflace za 8/2026 = 1,9 %.

## Databáze

`pronajmy.inflacni_dolozka` (boolean) a `pronajmy.zvyseni_od` (date) – `supabase/schema.sql`.
