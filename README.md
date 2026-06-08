# 🚪 Referendum: izbacujemo li dule484?

Smešan, **anonimni** poll sajt za Discord ekipu — glasa se da li dule484 ide napolje sa servera.

## Kako radi
- Uđeš na sajt → izabereš **ko si** (6 ljudi: spale, Aca, CikaJohnny, Goku, Ivanko, lazar; dule ne glasa jer je on tema 🙂).
- Glasaš **ZA** (izbaci) ili **PROTIV** (ostaje) — **samo jednom**.
- Čim glasaš, tvoje ime **nestane** sa spiska za biranje.
- Rezultati pokazuju **samo brojeve** ZA / PROTIV i spisak imena koja su glasala.

## Anonimnost (stvarna, ne na reč)
Na bazi postoje **dve odvojene tabele**:
- `dule_poll_voters` — samo **imena** onih koji su glasali (da se spreči duplo glasanje).
- `dule_poll_tally` — samo **brojači** za/protiv (bez ijednog imena).

Nigde ne postoji red koji spaja ime i glas → **ni baza ne zna ko je kako glasao.** Vidi se samo *ko* je glasao, nikad *kako*.

## Stack
- Frontend: čist HTML/CSS/JS (bez build koraka) — hostuje se na **GitHub Pages**.
- Backend: **Supabase** (Postgres + PostgREST). Pisanje ide isključivo kroz `SECURITY DEFINER` funkciju `dule_poll_cast_vote`, uz RLS.
- `config.js` sadrži samo Supabase URL i **anon** ključ (javni po dizajnu, zaštićen RLS-om).

Šema je u `supabase/migrations/`.
