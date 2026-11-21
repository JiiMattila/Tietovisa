-- NETLIFY TIETOVISA — suorita tämä Supabase > SQL Editorissa (Run).
-- Kaikki pelitoiminnot kulkevat Netlify Functionin kautta. Älä koskaan julkaise service_role-avainta.

create extension if not exists pgcrypto;

create table if not exists public.quiz_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_id uuid,
  status text not null default 'lobby' check (status in ('lobby','question','reveal','finished')),
  question_total integer not null check (question_total between 5 and 30),
  timer_seconds integer not null check (timer_seconds between 10 and 60),
  topic text not null,
  difficulty text not null,
  question_source text not null check (question_source in ('ai','demo')),
  questions jsonb not null,
  round_index integer not null default -1,
  question_started_at timestamptz,
  reveal_started_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.quiz_rooms(id) on delete cascade,
  name text not null,
  secret_hash text not null,
  score integer not null default 0,
  joined_at timestamptz not null default now(),
  unique (room_id, name)
);

alter table public.quiz_players add column if not exists ready boolean not null default false;

create table if not exists public.quiz_answers (
  room_id uuid not null references public.quiz_rooms(id) on delete cascade,
  player_id uuid not null references public.quiz_players(id) on delete cascade,
  round_index integer not null,
  choice integer not null check (choice between 0 and 4),
  points integer not null default 0,
  answered_at timestamptz not null default now(),
  primary key (room_id, player_id, round_index)
);

create index if not exists quiz_players_room_idx on public.quiz_players(room_id);
create index if not exists quiz_answers_round_idx on public.quiz_answers(room_id,round_index);

alter table public.quiz_rooms enable row level security;
alter table public.quiz_players enable row level security;
alter table public.quiz_answers enable row level security;
revoke all on public.quiz_rooms, public.quiz_players, public.quiz_answers from anon, authenticated;
grant select, insert, update, delete on public.quiz_rooms, public.quiz_players, public.quiz_answers to service_role;


-- Atominen huoneen luonti. Ensimmäinen pelaaja on aina myös isäntä.
create or replace function public.quiz_create_room(
  p_code text, p_name text, p_secret_hash text, p_total integer,
  p_timer integer, p_topic text, p_difficulty text,
  p_question_source text, p_questions jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_room_id uuid; v_player_id uuid;
begin
  if p_code !~ '^[A-Z2-9]{6}$' or length(trim(p_name)) not between 1 and 20
     or length(p_secret_hash) <> 64 or p_total not between 5 and 30
     or p_timer not between 10 and 60 or p_question_source not in ('ai','demo','mixed','bank')
     or jsonb_typeof(p_questions) is distinct from 'array'
     or jsonb_array_length(p_questions) <> p_total then
    raise exception 'Virheelliset pelin asetukset';
  end if;
  insert into public.quiz_rooms (code,question_total,timer_seconds,topic,difficulty,question_source,questions)
    values (p_code,p_total,p_timer,p_topic,p_difficulty,p_question_source,p_questions)
    returning id into v_room_id;
  insert into public.quiz_players(room_id,name,secret_hash)
    values(v_room_id,trim(p_name),p_secret_hash)
    returning id into v_player_id;
  update public.quiz_rooms set host_id=v_player_id where id=v_room_id;
  return jsonb_build_object('code',p_code,'playerId',v_player_id);
end;
$$;

-- Huoneen rivin lukitus estää sen, että kaksi samanaikaista liittymistä ylittäisi 10 pelaajan rajan.
create or replace function public.quiz_join_room(
  p_code text, p_name text, p_secret_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.quiz_rooms%rowtype; v_player_id uuid;
begin
  select * into r from public.quiz_rooms where code=upper(trim(p_code)) for update;
  if not found then raise exception 'Pelikoodia ei löytynyt'; end if;
  if r.status <> 'lobby' then raise exception 'Peli on jo käynnissä'; end if;
  if length(trim(p_name)) not between 1 and 20 or length(p_secret_hash) <> 64 then
    raise exception 'Virheellinen pelaajan nimi'; end if;
  if (select count(*) from public.quiz_players where room_id=r.id) >= 10 then
    raise exception 'Pelihuone on täynnä (10 pelaajaa)'; end if;
  if exists (select 1 from public.quiz_players where room_id=r.id and lower(name)=lower(trim(p_name))) then
    raise exception 'Nimimerkki on jo käytössä'; end if;
  insert into public.quiz_players(room_id,name,secret_hash)
    values (r.id,trim(p_name),p_secret_hash) returning id into v_player_id;
  return jsonb_build_object('code',r.code,'playerId',v_player_id);
end;
$$;

-- Kysymykset etenevät automaattisesti kaikkien vastattua tai ajan päätyttyä.
-- Pistettä lisätään vasta paljastusvaiheessa, jotta oikea vastaus ei paljastu pisteistä.
create or replace function public.quiz_advance_room(p_room_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.quiz_rooms%rowtype; v_now timestamptz;
begin
  select * into r from public.quiz_rooms where id=p_room_id for update;
  if not found then return; end if;
  v_now := clock_timestamp();
  if r.status = 'question' and (
       v_now >= r.question_started_at + pg_catalog.make_interval(secs => r.timer_seconds)
       or (select count(*) from public.quiz_answers where room_id=r.id and round_index=r.round_index)
          >= (select count(*) from public.quiz_players where room_id=r.id)
     ) then
    update public.quiz_players p
       set score=p.score+coalesce((select a.points from public.quiz_answers a
                                  where a.room_id=r.id and a.round_index=r.round_index
                                    and a.player_id=p.id),0)
     where p.room_id=r.id;
    update public.quiz_rooms set status='reveal', reveal_started_at=v_now where id=r.id;
  elsif r.status='reveal' and v_now >= r.reveal_started_at + interval '6 seconds' then
    if r.round_index+1 >= r.question_total then
      update public.quiz_rooms set status='finished' where id=r.id;
    else
      update public.quiz_rooms set status='question', round_index=r.round_index+1,
        question_started_at=v_now, reveal_started_at=null where id=r.id;
    end if;
  end if;
end;
$$;

create or replace function public.quiz_set_ready(
  p_code text, p_player_id uuid, p_secret_hash text, p_ready boolean
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.quiz_rooms%rowtype;
begin
  select * into r from public.quiz_rooms where code=upper(trim(p_code)) for update;
  if not found or not exists
    (select 1 from public.quiz_players where id=p_player_id and room_id=r.id and secret_hash=p_secret_hash)
  then raise exception 'Pelaajaa ei löytynyt'; end if;
  if r.status <> 'lobby' then raise exception 'Peli on jo käynnissä'; end if;
  if p_ready is null then raise exception 'Virheellinen valmiustieto'; end if;

  update public.quiz_players set ready=p_ready where room_id=r.id and id=p_player_id;
  if not exists (select 1 from public.quiz_players where room_id=r.id and not ready) then
    update public.quiz_rooms set status='question',round_index=0,
      question_started_at=clock_timestamp() where id=r.id;
  end if;
  return jsonb_build_object('ok',true);
end;
$$;

-- Vanhan käyttöliittymän aloituspyyntö merkitsee pyytäjän valmiiksi.
create or replace function public.quiz_start_room(
  p_code text, p_player_id uuid, p_secret_hash text
) returns jsonb language sql security invoker set search_path = '' as $$
  select public.quiz_set_ready(p_code,p_player_id,p_secret_hash,true);
$$;

create or replace function public.quiz_submit_answer(
  p_code text, p_player_id uuid, p_secret_hash text, p_choice integer, p_round_index integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare r public.quiz_rooms%rowtype; v_now timestamptz; v_elapsed numeric; v_points integer;
begin
  select * into r from public.quiz_rooms where code=upper(trim(p_code)) for update;
  if not found or not exists
     (select 1 from public.quiz_players where room_id=r.id and id=p_player_id and secret_hash=p_secret_hash)
    then raise exception 'Pelaajaa ei löytynyt'; end if;
  if r.status <> 'question' or (p_round_index is not null and r.round_index <> p_round_index) then
    raise exception 'Vastausaika on päättynyt';
  end if;
  if p_choice is null or p_choice not between 0 and 4 then raise exception 'Virheellinen vastaus'; end if;
  v_now := clock_timestamp();
  v_elapsed := extract(epoch from (v_now - r.question_started_at));
  if v_elapsed >= r.timer_seconds then raise exception 'Vastausaika on päättynyt'; end if;
  if (r.questions -> r.round_index ->> 'answerIndex')::integer = p_choice then
     v_points := 600 + floor(400 * greatest(0,1-v_elapsed/r.timer_seconds))::integer;
  else v_points := 0; end if;
  insert into public.quiz_answers as a (room_id,player_id,round_index,choice,points,answered_at)
    values(r.id,p_player_id,r.round_index,p_choice,v_points,v_now)
    on conflict (room_id,player_id,round_index) do update
      set choice=excluded.choice, points=excluded.points, answered_at=excluded.answered_at
      where a.choice <> excluded.choice;
  perform public.quiz_advance_room(r.id);
  return jsonb_build_object('accepted',true);
end;
$$;

-- Palvelee myös asiakkaita, jotka eivät vielä lähetä kierrosnumeroa.
create or replace function public.quiz_submit_answer(
  p_code text, p_player_id uuid, p_secret_hash text, p_choice integer
) returns jsonb language sql security invoker set search_path = '' as $$
  select public.quiz_submit_answer(p_code,p_player_id,p_secret_hash,p_choice,null::integer);
$$;

-- Oikea vastaus ja pelaajien valinnat jaetaan vasta paljastusvaiheessa.
create or replace function public.quiz_get_state(
  p_code text, p_player_id uuid, p_secret_hash text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.quiz_rooms%rowtype; v_q jsonb; v_public_q jsonb := null;
begin
  select * into r from public.quiz_rooms where code=upper(trim(p_code));
  if not found or not exists
    (select 1 from public.quiz_players where room_id=r.id and id=p_player_id and secret_hash=p_secret_hash)
    then raise exception 'Pelaajaa ei löytynyt tai tunniste ei kelpaa'; end if;
  perform public.quiz_advance_room(r.id);
  select * into r from public.quiz_rooms where id=r.id;
  if r.status in ('question','reveal') then
    v_q := r.questions -> r.round_index;
    v_public_q := jsonb_build_object('text',v_q->>'text','options',v_q->'options','category',v_q->>'category');
    if r.status='reveal' then
      v_public_q := v_public_q || jsonb_build_object(
        'answerIndex',(v_q->>'answerIndex')::integer,'explanation',v_q->>'explanation');
    end if;
  end if;
  return jsonb_build_object(
    'code',r.code, 'status',r.status, 'hostId',r.host_id, 'meId',p_player_id,
    'roundIndex',r.round_index, 'total',r.question_total, 'timer',r.timer_seconds,
    'topic',r.topic, 'difficulty',r.difficulty, 'source',r.question_source,
    'startedAt',r.question_started_at, 'revealAt',r.reveal_started_at,
    'serverNow',clock_timestamp(), 'question',v_public_q,
    'myAnswer',(select a.choice from public.quiz_answers a where a.room_id=r.id
                 and a.round_index=r.round_index and a.player_id=p_player_id),
    'players',(select coalesce(jsonb_agg(jsonb_build_object(
      'id',p.id,'name',p.name,'score',p.score,
      'isHost',p.id=r.host_id,
      'answered',a.player_id is not null
    ) || case r.status
      when 'lobby' then jsonb_build_object('ready',p.ready)
      when 'reveal' then jsonb_build_object('choice',a.choice)
      else '{}'::jsonb
    end
      order by p.score desc, p.joined_at),'[]'::jsonb)
      from public.quiz_players p
      left join public.quiz_answers a on a.room_id=p.room_id and a.player_id=p.id
        and a.round_index=r.round_index
      where p.room_id=r.id)
  );
end;
$$;

-- Vain service_role saa kutsua funktioita. Avainta käytetään ainoastaan Netlifyn palvelimella.
revoke all on function public.quiz_create_room(text,text,text,integer,integer,text,text,text,jsonb) from public, anon, authenticated;
revoke all on function public.quiz_join_room(text,text,text) from public, anon, authenticated;
revoke all on function public.quiz_set_ready(text,uuid,text,boolean) from public, anon, authenticated;
revoke all on function public.quiz_start_room(text,uuid,text) from public, anon, authenticated;
revoke all on function public.quiz_submit_answer(text,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.quiz_submit_answer(text,uuid,text,integer,integer) from public, anon, authenticated;
revoke all on function public.quiz_get_state(text,uuid,text) from public, anon, authenticated;
revoke all on function public.quiz_advance_room(uuid) from public, anon, authenticated;
grant execute on function public.quiz_create_room(text,text,text,integer,integer,text,text,text,jsonb) to service_role;
grant execute on function public.quiz_join_room(text,text,text) to service_role;
grant execute on function public.quiz_set_ready(text,uuid,text,boolean) to service_role;
grant execute on function public.quiz_start_room(text,uuid,text) to service_role;
grant execute on function public.quiz_submit_answer(text,uuid,text,integer) to service_role;
grant execute on function public.quiz_submit_answer(text,uuid,text,integer,integer) to service_role;
grant execute on function public.quiz_get_state(text,uuid,text) to service_role;
grant execute on function public.quiz_advance_room(uuid) to service_role;

-- Tietokantafunktioiden API-skeeman päivitys PostgRESTille.
notify pgrst, 'reload schema';

-- KYSYMYSPANKKI: suorita tämä osuus myös vanhaan Supabase-projektiin päivityksen yhteydessä.
create index if not exists quiz_rooms_recent_idx on public.quiz_rooms(created_at desc,id desc);

create or replace function public.quiz_recent_questions()
returns jsonb language sql stable security invoker set search_path = '' as $$
  with recent_rooms as (
    select id, created_at, questions
    from public.quiz_rooms
    order by created_at desc, id desc
    limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'text', q.item->>'text',
    'answer', q.item->'options'->>((q.item->>'answerIndex')::integer)
  ) order by r.created_at desc, r.id desc, q.position), '[]'::jsonb)
  from recent_rooms r
  cross join lateral jsonb_array_elements(r.questions) with ordinality as q(item, position);
$$;

revoke all on function public.quiz_recent_questions() from public, anon, authenticated;
grant execute on function public.quiz_recent_questions() to service_role;

create table if not exists public.quiz_question_bank (
  fingerprint text primary key,
  topic text not null,
  difficulty text not null check (difficulty in ('helppo','keskitaso','vaikea')),
  question jsonb not null,
  created_at timestamptz not null default now(),
  used_count bigint not null default 0
);
create index if not exists quiz_bank_topic_idx on public.quiz_question_bank(topic,difficulty,used_count);
alter table public.quiz_question_bank enable row level security;
revoke all on public.quiz_question_bank from anon, authenticated;
grant select, insert, update on public.quiz_question_bank to service_role;

create or replace function public.quiz_bank_save(p_topic text, p_difficulty text, p_items jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare item jsonb; inserted integer := 0; v_count integer;
begin
  if length(p_topic) not between 1 and 80 or p_difficulty not in ('helppo','keskitaso','vaikea')
     or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 40 then
    raise exception 'Virheelliset pankin asetukset';
  end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if (item->>'fingerprint') !~ '^[0-9a-f]{64}$'
       or length(item->>'text') not between 8 and 300
       or jsonb_typeof(item->'options') <> 'array'
       or jsonb_array_length(item->'options') <> 5
       or (item->>'answerIndex')::integer not between 0 and 4 then
      raise exception 'Virheellinen pankkikysymys';
    end if;
    insert into public.quiz_question_bank(fingerprint,topic,difficulty,question)
      values(item->>'fingerprint',p_topic,p_difficulty,item - 'fingerprint')
      on conflict (fingerprint) do nothing;
    get diagnostics v_count = row_count;
    inserted := inserted + v_count;
  end loop;
  return inserted;
end;
$$;

create or replace function public.quiz_bank_pick(
  p_topic text, p_difficulty text, p_limit integer, p_exclude text[] default '{}'
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare selected jsonb;
begin
  if p_limit not between 0 and 30 or p_difficulty not in ('helppo','keskitaso','vaikea')
     or length(p_topic) not between 1 and 80 or cardinality(p_exclude) > 400 then
    raise exception 'Virheellinen pankkihaku';
  end if;
  -- FOR UPDATE SKIP LOCKED estää samanaikaisen varauksen törmäykset.
  with candidates as (
    select fingerprint, question from public.quiz_question_bank
    where lower(topic)=lower(p_topic) and difficulty=p_difficulty
      and not (fingerprint = any(p_exclude))
    order by used_count asc, random()
    limit p_limit for update skip locked
  ), updated as (
    update public.quiz_question_bank b set used_count=b.used_count+1
    from candidates c where b.fingerprint=c.fingerprint
    returning c.question
  ) select coalesce(jsonb_agg(question),'[]'::jsonb) into selected from updated;
  return selected;
end;
$$;

create or replace function public.quiz_bank_pick_varied(
  p_topics text[], p_difficulty text, p_limit integer, p_exclude text[], p_recent text[]
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare selected jsonb;
begin
  if p_limit not between 1 and 30 or p_difficulty not in ('helppo','keskitaso','vaikea')
     or cardinality(p_topics) not between 1 and 15 or cardinality(p_exclude) > 40
     or cardinality(p_recent) > 300 then
    raise exception 'Virheelliset aihevalikoiman asetukset';
  end if;

  with eligible as (
    select b.fingerprint, lower(b.topic) as category, b.used_count,
      array_position(p_recent,b.fingerprint) as recent_position
    from public.quiz_question_bank b
    where lower(b.topic)=any(p_topics) and b.difficulty=p_difficulty
      and not (b.fingerprint=any(p_exclude))
  ), ranked as (
    select e.*, row_number() over (
      partition by e.category
      order by (e.recent_position is not null), e.recent_position desc nulls last, e.used_count, random()
    ) as turn
    from eligible e
  ), candidates as (
    select b.fingerprint
    from ranked r join public.quiz_question_bank b on b.fingerprint=r.fingerprint
    order by (r.recent_position is not null), r.turn, random()
    limit p_limit for update of b skip locked
  ), updated as (
    update public.quiz_question_bank b set used_count=b.used_count+1
    from candidates c where b.fingerprint=c.fingerprint
    returning b.question || jsonb_build_object('category',b.topic) as question
  ) select coalesce(jsonb_agg(question),'[]'::jsonb) into selected from updated;
  return selected;
end;
$$;

-- 'mixed' ja 'bank' sallitaan uusissa huoneissa.
alter table public.quiz_rooms drop constraint if exists quiz_rooms_question_source_check;
alter table public.quiz_rooms add constraint quiz_rooms_question_source_check
  check (question_source in ('ai','demo','mixed','bank'));

revoke all on function public.quiz_bank_save(text,text,jsonb) from public, anon, authenticated;
revoke all on function public.quiz_bank_pick(text,text,integer,text[]) from public, anon, authenticated;
revoke all on function public.quiz_bank_pick_varied(text[],text,integer,text[],text[]) from public, anon, authenticated;
grant execute on function public.quiz_bank_save(text,text,jsonb) to service_role;
grant execute on function public.quiz_bank_pick(text,text,integer,text[]) to service_role;
grant execute on function public.quiz_bank_pick_varied(text[],text,integer,text[],text[]) to service_role;
notify pgrst, 'reload schema';
