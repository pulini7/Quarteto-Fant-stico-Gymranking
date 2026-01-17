-- ATENÇÃO: Copie e cole este código no SQL Editor do seu projeto Supabase e clique em RUN.

-- 1. Criação/Atualização das Tabelas
create table if not exists public.users (
    id text primary key,
    name text not null,
    avatar_seed int,
    custom_avatar text,
    score int default 0,
    streak int default 0,
    password text
);

create table if not exists public.check_ins (
    id text primary key,
    user_id text references public.users(id),
    date text not null,
    timestamp text not null,
    photo text,
    caption text,
    likes jsonb default '[]'::jsonb
);

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
-- Isso garante que nenhuma operação aconteça sem uma política explícita.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Limpeza de políticas antigas (para evitar duplicação ao rodar o script novamente)
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
-- Como estamos usando uma autenticação customizada no frontend e não o Supabase Auth,
-- precisamos permitir acesso à role 'anon' (API Key pública), mas controlando os tipos de operações.

-- TABELA USERS
-- Permitir leitura pública (Ranking/Feed)
create policy "Public users read" on public.users for select using (true);
-- Permitir criação de usuários (Login inicial)
create policy "Public users insert" on public.users for insert with check (true);
-- Permitir atualização (Scores, Streak, Avatar, Password)
create policy "Public users update" on public.users for update using (true);
-- NOTA: NÃO criamos política de DELETE. Ninguém pode apagar usuários via API.

-- TABELA CHECK_INS
create policy "Public checkins read" on public.check_ins for select using (true);
create policy "Public checkins insert" on public.check_ins for insert with check (true);
create policy "Public checkins update" on public.check_ins for update using (true); -- Para Likes
-- NOTA: NÃO criamos política de DELETE. Ninguém pode apagar check-ins.

-- TABELA COMMENTS
create policy "Public comments read" on public.comments for select using (true);
create policy "Public comments insert" on public.comments for insert with check (true);

-- TABELA NOTIFICATIONS
create policy "Public notifications read" on public.notifications for select using (true);
create policy "Public notifications insert" on public.notifications for insert with check (true);
-- Permitir deletar APENAS notificações (necessário para a função 'Limpar Notificações' do app)
create policy "Public notifications delete" on public.notifications for delete using (true);

-- 5. Seed Inicial (Garante que as usuárias existam)
insert into public.users (id, name, avatar_seed, score, streak)
values 
('1', 'Aline', 501, 0, 0),
('2', 'Samila', 502, 0, 0),
('3', 'Pâmela', 503, 0, 0),
('4', 'Taís', 504, 0, 0)
on conflict (id) do nothing;
