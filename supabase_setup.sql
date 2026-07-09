-- Supabase Setup SQL for Orioncare PMS

-- 1. Create tables
create table if not exists profiles (
  id uuid primary key references auth.users(id),
  username text not null unique,
  name text not null,
  role text not null default 'normal',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists patients (
  id text primary key,
  patient_id text not null,
  full_name text not null,
  dob date,
  age int,
  sex text,
  phone text,
  insurance_type text,
  insurance_no text,
  wound_cause text,
  wound_status text,
  days_since_injury int,
  gp_consultation text,
  notes text,
  date text,
  date_iso text,
  time_seen text,
  shift text,
  owner uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patients_owner on patients(owner);
create index if not exists idx_patients_date_iso on patients(date_iso);
create index if not exists idx_patients_patient_id on patients(patient_id);

create table if not exists custom_insurance (
  name text primary key,
  created_at timestamptz not null default now()
);

create table if not exists custom_causes (
  name text primary key,
  created_at timestamptz not null default now()
);

-- 2. Enable row level security
alter table if exists profiles enable row level security;
alter table if exists patients enable row level security;
alter table if exists custom_insurance enable row level security;
alter table if exists custom_causes enable row level security;

-- 3. Policies for profiles
drop policy if exists profiles_can_read_own_profile on profiles;
drop policy if exists profiles_can_modify_own_profile on profiles;
create policy profiles_can_read_own_profile
  on profiles
  for select
  using (id = auth.uid() or exists (
    select 1 from profiles p2
    where p2.id = auth.uid() and p2.role = 'admin' and p2.active
  ));

create policy profiles_can_modify_own_profile
  on profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 4. Policies for patients
drop policy if exists patients_admin_access on patients;
drop policy if exists patients_owner_access on patients;
create policy patients_admin_access
  on patients
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
        and profiles.active
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
        and profiles.active
    )
  );

create policy patients_owner_access
  on patients
  for all
  using (owner = auth.uid())
  with check (owner = auth.uid());

-- 5. Policies for admin-only settings
drop policy if exists admin_only_insurance on custom_insurance;
drop policy if exists admin_only_causes on custom_causes;
create policy admin_only_insurance
  on custom_insurance
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
        and profiles.active
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
        and profiles.active
    )
  );

create policy admin_only_causes
  on custom_causes
  for all
  using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
        and profiles.active
    )
  )
  with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
        and profiles.active
    )
  );
