-- Purely cosmetic per-account defaults, picked once at signup:
--   • theme_accent: man -> emerald, woman/unspecified -> rose
--   • gender itself is stored so the client can also seed a default Mali
--     companion (fox "Hadithi" for a man, bunny "Haraka" for a woman/
--     unspecified) the first time that account's browser has no saved
--     companion choice — see MaliAnimalAvatar's seedAnimalFromGender.
-- Both remain fully user-changeable afterward (Settings accent picker,
-- Mali's own companion picker) — this only sets the STARTING point.
alter table public.profiles
  add column if not exists gender text check (gender is null or gender in ('male', 'female'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_role user_role;
  v_raw_role TEXT;
  v_gender TEXT;
BEGIN
  v_raw_role := COALESCE(new.raw_user_meta_data->>'role', 'buyer');

  IF v_raw_role NOT IN ('buyer', 'seller', 'admin') THEN
    v_raw_role := 'buyer';
  END IF;

  IF v_raw_role = 'admin' THEN
    v_raw_role := 'buyer';
  END IF;

  v_role := v_raw_role::user_role;

  v_gender := new.raw_user_meta_data->>'gender';
  IF v_gender NOT IN ('male', 'female') THEN
    v_gender := NULL;
  END IF;

  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    avatar_url,
    wallet_balance,
    points,
    tier,
    region,
    gender,
    theme_accent,
    created_at
  ) VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    v_role,
    new.raw_user_meta_data->>'avatar_url',
    0,
    0,
    'Bronze',
    'Dar es Salaam',
    v_gender,
    CASE WHEN v_gender = 'male' THEN 'emerald' ELSE 'rose' END,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

  IF v_role = 'seller' THEN
    INSERT INTO public.vendor_profiles (
      seller_id,
      store_name,
      delivery_fee,
      is_verified,
      is_active,
      created_at
    ) VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'store_name', split_part(new.email, '@', 1) || '''s Store'),
      2500,
      false,
      true,
      NOW()
    ) ON CONFLICT (seller_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$function$;
