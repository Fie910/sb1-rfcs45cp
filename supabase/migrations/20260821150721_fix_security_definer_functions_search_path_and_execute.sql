
-- 1. Fix handle_new_user: add search_path, it's a trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.gurus (id, email, nama_lengkap, nip, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nama_lengkap', 'Guru Baru'),
    COALESCE(NEW.raw_user_meta_data->>'nip', '-'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'guru')
  );
  RETURN NEW;
END;
$function$;

-- 2. Fix prevent_role_update: add search_path, it's a trigger function
CREATE OR REPLACE FUNCTION public.prevent_role_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND public.get_my_role() != 'admin' THEN
    RAISE EXCEPTION 'Hanya Admin yang dapat mengubah hak akses.';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Revoke EXECUTE from PUBLIC on trigger functions (they should never be called via RPC)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prevent_role_update() FROM PUBLIC;

-- 4. Restrict get_my_role to authenticated only (needed by RLS policies, not by anon)
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
