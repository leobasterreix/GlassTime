-- À exécuter dans le SQL Editor du dashboard Supabase (comme le reste du
-- schéma "profiles", aucune migration n'était versionnée jusqu'ici).
--
-- Ajoute le statut d'abonnement Premium (Lemon Squeezy) sur les profils, et
-- une table d'audit des événements webhook.

alter table profiles
  add column if not exists subscription_plan text not null default 'free'
    check (subscription_plan in ('free', 'premium')),
  add column if not exists subscription_status text,
  add column if not exists lemonsqueezy_customer_id text,
  add column if not exists lemonsqueezy_subscription_id text,
  add column if not exists subscription_renews_at timestamptz,
  add column if not exists subscription_ends_at timestamptz;

create table if not exists subscription_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

-- Protection : seul le service_role (donc le webhook serveur) peut modifier
-- le statut d'abonnement. Sans ce trigger, un utilisateur pourrait s'auto-
-- attribuer le statut Premium via un simple appel
-- supabase.from('profiles').update({subscription_plan:'premium'}) depuis la
-- console du navigateur, car la policy RLS existante l'autorise déjà à
-- modifier sa propre ligne profiles (first_name, avatar_url, etc.).
create or replace function protect_subscription_columns()
returns trigger language plpgsql as $$
begin
  if auth.role() <> 'service_role' then
    new.subscription_plan := old.subscription_plan;
    new.subscription_status := old.subscription_status;
    new.lemonsqueezy_customer_id := old.lemonsqueezy_customer_id;
    new.lemonsqueezy_subscription_id := old.lemonsqueezy_subscription_id;
    new.subscription_renews_at := old.subscription_renews_at;
    new.subscription_ends_at := old.subscription_ends_at;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_subscription_columns on profiles;
create trigger protect_subscription_columns
  before update on profiles
  for each row execute function protect_subscription_columns();
