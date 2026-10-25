-- Supabase Schema for Lighter Badminton Cost App
-- Compliant with BA_SPEC.md

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Groups
create table if not exists groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null default 'Lighter Badminton',
  tube_price int not null default 340000,
  shuttles_per_tube int not null default 12,
  done_tolerance int not null default 1000,
  transfer_rounding int not null default 1,
  treasurer_member_id uuid,
  default_settle_mode text not null default 'min_transactions',
  created_at timestamptz not null default now()
);

-- 2. Members
create table if not exists members (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  display_name text not null,
  default_weight smallint not null default 1 check (default_weight between 1 and 4),
  user_id uuid unique references auth.users(id) on delete set null,
  role text not null default 'member' check (role in ('admin', 'member')),
  is_active boolean not null default true,
  sort_order int not null default 0,
  avatar_color text default '#10b981',
  bank_name text,
  bank_account_no text,
  bank_account_holder text,
  qr_image_path text,
  created_at timestamptz not null default now()
);

-- Circular reference foreign key for treasurer
alter table groups
  drop constraint if exists fk_groups_treasurer;
alter table groups
  add constraint fk_groups_treasurer foreign key (treasurer_member_id) references members(id) on delete set null;

-- 3. Member Invites
create table if not exists member_invites (
  id uuid primary key default uuid_generate_v4(),
  member_id uuid not null references members(id) on delete cascade,
  token text unique not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references members(id),
  created_at timestamptz not null default now()
);

-- 4. Sessions
create table if not exists sessions (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  date date not null,
  type text not null default 'badminton' check (type in ('badminton', 'event')),
  title text,
  note text,
  status text not null default 'open' check (status in ('open', 'locked')),
  created_by uuid references members(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 5. Session Participants
create table if not exists session_participants (
  session_id uuid not null references sessions(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  weight smallint not null default 1 check (weight >= 1),
  primary key (session_id, member_id)
);

-- 6. Expenses
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  title text not null,
  category text not null default 'court' check (category in ('court', 'shuttle', 'drink', 'food', 'transport', 'gift', 'personal', 'other')),
  amount bigint not null check (amount > 0),
  paid_by uuid not null references members(id),
  split_method text not null default 'weighted' check (split_method in ('weighted', 'exact', 'shuttle')),
  shuttle_qty int,
  tube_price_snapshot int,
  note text,
  receipt_path text,
  created_by uuid references members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- 7. Expense Shares
create table if not exists expense_shares (
  expense_id uuid not null references expenses(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  weight smallint,
  amount bigint not null check (amount >= 0),
  primary key (expense_id, member_id)
);

-- 8. Transfers
create table if not exists transfers (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  from_member uuid not null references members(id),
  to_member uuid not null references members(id),
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected')),
  note text,
  proof_path text,
  settlement_id uuid,
  created_by uuid references members(id),
  created_at timestamptz not null default now(),
  confirmed_by uuid references members(id),
  confirmed_at timestamptz,
  reject_reason text,
  constraint chk_transfers_distinct_members check (from_member <> to_member)
);

-- 9. Opening Balances
create table if not exists opening_balances (
  member_id uuid primary key references members(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  amount bigint not null default 0,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

-- 10. Settlements
create table if not exists settlements (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  mode text not null default 'min_transactions',
  treasurer_member_id uuid references members(id),
  balances jsonb not null default '{}'::jsonb,
  created_by uuid references members(id),
  created_at timestamptz not null default now(),
  note text
);

-- 11. Settlement Items
create table if not exists settlement_items (
  id uuid primary key default uuid_generate_v4(),
  settlement_id uuid not null references settlements(id) on delete cascade,
  from_member uuid not null references members(id),
  to_member uuid not null references members(id),
  amount bigint not null,
  transfer_id uuid references transfers(id) on delete set null
);

-- 12. Audit Logs
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  actor_member_id uuid references members(id),
  action text not null,
  entity text not null,
  entity_id text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- 13. Legacy Sheets Archive
create table if not exists legacy_sheets (
  id uuid primary key default uuid_generate_v4(),
  sheet_name text not null,
  period_date date,
  raw jsonb not null,
  imported_at timestamptz not null default now()
);

-- 14. View: Member Balances (Calculated continuous ledger)
create or replace view member_balances as
select
  m.id as member_id,
  m.group_id,
  m.display_name,
  coalesce(ob.amount, 0) as opening_balance,
  coalesce(paid_agg.total_paid, 0) as total_paid,
  coalesce(owed_agg.total_owed, 0) as total_owed,
  coalesce(sent_agg.total_sent, 0) as total_sent,
  coalesce(rcv_agg.total_received, 0) as total_received,
  (
    coalesce(ob.amount, 0) +
    coalesce(paid_agg.total_paid, 0) -
    coalesce(owed_agg.total_owed, 0) +
    coalesce(sent_agg.total_sent, 0) -
    coalesce(rcv_agg.total_received, 0)
  ) as balance
from members m
left join opening_balances ob on ob.member_id = m.id
left join (
  select paid_by, sum(amount) as total_paid
  from expenses
  where deleted_at is null
  group by paid_by
) paid_agg on paid_agg.paid_by = m.id
left join (
  select es.member_id, sum(es.amount) as total_owed
  from expense_shares es
  join expenses e on e.id = es.expense_id
  where e.deleted_at is null
  group by es.member_id
) owed_agg on owed_agg.member_id = m.id
left join (
  select from_member, sum(amount) as total_sent
  from transfers
  where status = 'confirmed'
  group by from_member
) sent_agg on sent_agg.from_member = m.id
left join (
  select to_member, sum(amount) as total_received
  from transfers
  where status = 'confirmed'
  group by to_member
) rcv_agg on rcv_agg.to_member = m.id;
