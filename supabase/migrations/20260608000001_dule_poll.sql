-- =====================================================================
-- dule484 referendum — šema
--
-- Anonimnost po dizajnu: "ko je glasao" (imena) i "kako je glasano"
-- (za/protiv) žive u DVE ODVOJENE tabele. Nigde ne postoji red koji
-- povezuje ime sa glasom, pa ni sama baza ne može da kaže ko je kako
-- glasao. Vidi se samo: spisak imena koja su glasala + zbirni brojevi.
-- =====================================================================

-- 1) Zbirni, anonimni rezultat (samo brojači, bez ikakvog imena)
create table if not exists public.dule_poll_tally (
  choice text primary key check (choice in ('za','protiv')),
  count  integer not null default 0
);

insert into public.dule_poll_tally (choice, count)
values ('za', 0), ('protiv', 0)
on conflict (choice) do nothing;

-- 2) Ko je glasao (samo imena, bez glasa) — sprečava duplo glasanje
create table if not exists public.dule_poll_voters (
  name     text primary key,
  voted_at timestamptz not null default now()
);

-- 3) Atomsko glasanje: validira ime + izbor, upiše ime, uveća brojač.
--    SECURITY DEFINER -> jedini dozvoljeni način pisanja za anon korisnike.
create or replace function public.dule_poll_cast_vote(p_name text, p_choice text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed text[] := array['spale','Aca','CikaJohnny','Goku','Ivanko','lazar'];
begin
  if p_choice not in ('za','protiv') then
    return 'invalid_choice';
  end if;
  if not (p_name = any(allowed)) then
    return 'invalid_name';
  end if;

  -- zabeleži da je ova osoba glasala (pukne ako je već glasala)
  begin
    insert into public.dule_poll_voters (name) values (p_name);
  exception when unique_violation then
    return 'already_voted';
  end;

  -- uvećaj anonimni brojač (odvojeno od imena -> veza ne postoji)
  update public.dule_poll_tally set count = count + 1 where choice = p_choice;

  return 'ok';
end;
$$;

-- 4) RLS: anon sme da ČITA brojeve i imena, ali NE sme direktno da piše.
alter table public.dule_poll_tally  enable row level security;
alter table public.dule_poll_voters enable row level security;

grant usage on schema public to anon;
grant select on public.dule_poll_tally  to anon;
grant select on public.dule_poll_voters to anon;

drop policy if exists dule_poll_tally_read on public.dule_poll_tally;
create policy dule_poll_tally_read on public.dule_poll_tally
  for select to anon using (true);

drop policy if exists dule_poll_voters_read on public.dule_poll_voters;
create policy dule_poll_voters_read on public.dule_poll_voters
  for select to anon using (true);

-- Pisanje ide ISKLJUČIVO kroz funkciju (nema insert/update/delete policy za anon).
revoke insert, update, delete on public.dule_poll_tally  from anon;
revoke insert, update, delete on public.dule_poll_voters from anon;

grant execute on function public.dule_poll_cast_vote(text, text) to anon;
