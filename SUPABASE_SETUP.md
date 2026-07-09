# Supabase Setup for Orioncare PMS

This document describes the recommended Supabase database schema, security policies, and migration path for the Minor Surgery Ward patient management app.

## 1. Recommended database tables

### `profiles`
Stores authenticated users and roles.

```sql
create table if not exists profiles (
  id uuid primary key references auth.users(id),
  username text not null unique,
  name text not null,
  role text not null default 'normal',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
```

### `patients`
Stores patient encounter data. The `owner` column should reference `profiles.id`.

```sql
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
```

### `custom_insurance`
Stores admin-managed insurance options.

```sql
create table if not exists custom_insurance (
  name text primary key,
  created_at timestamptz not null default now()
);
```

### `custom_causes`
Stores admin-managed wound causes.

```sql
create table if not exists custom_causes (
  name text primary key,
  created_at timestamptz not null default now()

);
```

## 2. Recommended row-level security

### Enable RLS

```sql
alter table if exists profiles enable row level security;
alter table if exists patients enable row level security;
alter table if exists custom_insurance enable row level security;
alter table if exists custom_causes enable row level security;
```

### Supabase Auth requirement

These policies assume the app uses Supabase Auth and a `profiles` row for each authenticated user. The app must sign in users through Supabase Auth and set `auth.uid()`.

### `profiles` policy

```sql
create policy "profiles_can_read_own_profile"
  on profiles
  for select
  using (id = auth.uid() or exists (
    select 1 from profiles p2
    where p2.id = auth.uid() and p2.role = 'admin' and p2.active
  ));

create policy "profiles_can_modify_own_profile"
  on profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());
```

### `patients` policies

```sql
create policy "patients_admin_access"
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

create policy "patients_owner_access"
  on patients
  for all
  using (owner = auth.uid())
  with check (owner = auth.uid());
```

### `custom_insurance` and `custom_causes` policies

```sql
create policy "admin_only_insurance"
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

create policy "admin_only_causes"
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
```

## 3. Supabase migration notes

### Recommended auth flow

1. Use Supabase Auth for user sign-in and sign-up.
2. On user creation, insert a `profiles` row using the authenticated user's `id`.
3. Store `role` and `active` in `profiles` rather than using client-side local storage.
4. In the app, use `auth.uid()` to determine the current user and `profiles.role` to drive admin UI.

### Client-side changes needed

- Replace local password hashing and login checks with Supabase Auth sign-in.
- Replace `SESSION_KEY` local storage session state with Supabase session state.
- Use `profiles.id` as the patient `owner` value.

## 4. How to use this file

1. Open Supabase SQL editor.
2. Run the table creation SQL blocks above.
3. Enable row-level security.
4. Apply the policy blocks.
5. Create an initial admin user through Supabase Auth or by inserting a `profiles` row.

## 5. App configuration and auth setup

1. In Supabase, go to `Settings > API` and copy:
   - `Project URL` (for your project it is `https://uxsrtzgxtvqmauhqqqzj.supabase.co`)
   - `anon public` key
2. Open `index.html` and replace the placeholder values:
   ```html
   const SUPABASE_URL = 'https://uxsrtzgxtvqmauhqqqzj.supabase.co';
   const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
   ```
3. In Supabase Auth, enable `Email` sign-in provider.
4. If you want the built-in signup flow to work immediately, turn off email confirmation in `Auth > Settings`.
5. The app maps usernames to auth emails using `username@msw.local`.
   - Example: `admin` becomes `admin@msw.local`
6. Create the first admin account by signing up through the app or by creating a Supabase user and matching `profiles` row.

### Initial admin user via SQL

If you create an admin auth user manually, insert a profile row with the auth user `id`:

```sql
insert into profiles (id, username, name, role, active)
values ('<auth-user-id>', 'admin', 'Admin User', 'admin', true);
```

## 6. Important security notes

- Do not use the Supabase anon key for sensitive row operations unless the policies enforce access correctly.
- Keep Session Replay disabled in Sentry for this app.
- Use `auth.uid()`-based RLS; do not trust client-side role flags.
