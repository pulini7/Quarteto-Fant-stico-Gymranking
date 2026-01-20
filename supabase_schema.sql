-- ATENÇÃO: Copie e cole este código no SQL Editor do seu projeto Supabase e clique em RUN.

-- 1. Criação/Atualização das Tabelas
create table if not exists public.users (
    id text primary key,
    name text not null,
    avatar_seed int,
    custom_avatar text,
    score int default 0,
    streak int default 0,
    password text,
    weekly_plan jsonb default '{}'::jsonb
);

-- Migração segura: Adiciona coluna weekly_plan se não existir
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'weekly_plan') then
        alter table public.users add column weekly_plan jsonb default '{}'::jsonb;
    end if;
end
$$;

create table if not exists public.check_ins (
    id text primary key,
    user_id text references public.users(id),
    date text not null,
    timestamp text not null,
    photo text,
    caption text,
    likes jsonb default '[]'::jsonb,
    videos jsonb default '[]'::jsonb
);

-- Migração segura: Adiciona coluna videos se não existir
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'check_ins' and column_name = 'videos') then
        alter table public.check_ins add column videos jsonb default '[]'::jsonb;
    end if;
end
$$;

create table if not exists public.comments (
    id text primary key,
    check_in_id text references public.check_ins(id) on delete cascade,
    user_id text references public.users(id),
    text text not null,
    timestamp text not null
);

create table if not exists public.notifications (
    id text primary key,
    user_id text references public.users(id),
    from_user_id text references public.users(id),
    type text not null,
    message text,
    read boolean default false,
    timestamp text not null
);

-- 2. SEGURANÇA: Habilitar RLS (Row Level Security)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de políticas antigas
drop policy if exists "Public users read" on public.users;
drop policy if exists "Public users insert" on public.users;
drop policy if exists "Public users update" on public.users;
drop policy if exists "Public checkins read" on public.check_ins;
drop policy if exists "Public checkins insert" on public.check_ins;
drop policy if exists "Public checkins update" on public.check_ins;
drop policy if exists "Public comments read" on public.comments;
drop policy if exists "Public comments insert" on public.comments;
drop policy if exists "Public notifications read" on public.notifications;
drop policy if exists "Public notifications insert" on public.notifications;
drop policy if exists "Public notifications delete" on public.notifications;

-- 4. DEFINIÇÃO DE POLÍTICAS (Policies)
create policy "Public users read" on public.users for select using (true);
create policy "Public users insert" on public.users for insert with check (true);
create policy "Public users update" on public.users for update using (true);

create policy "Public checkins read" on public.check_ins for select using (true);
create policy "Public checkins insert" on public.check_ins for insert with check (true);
create policy "Public checkins update" on public.check_ins for update using (true);
-- Permite delete público (controlado pelo app via lógica de negócio, mas aberto no banco para permitir a função do admin)
create policy "Public checkins delete" on public.check_ins for delete using (true);

create policy "Public comments read" on public.comments for select using (true);
create policy "Public comments insert" on public.comments for insert with check (true);

create policy "Public notifications read" on public.notifications for select using (true);
create policy "Public notifications insert" on public.notifications for insert with check (true);
create policy "Public notifications delete" on public.notifications for delete using (true);

-- 5. Seed Inicial (se necessário)
insert into public.users (id, name, avatar_seed, score, streak)
values 
('1', 'Aline', 501, 0, 0),
('2', 'Samila', 502, 0, 0),
('3', 'Pâmela', 503, 0, 0),
('4', 'Taís', 504, 0, 0)
on conflict (id) do nothing;