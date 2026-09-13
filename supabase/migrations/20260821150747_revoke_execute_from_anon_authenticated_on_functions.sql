
-- Revoke EXECUTE explicitly from anon and authenticated on trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_role_update() FROM anon;
REVOKE EXECUTE ON FUNCTION public.prevent_role_update() FROM authenticated;

-- Revoke EXECUTE from anon on get_my_role (keep for authenticated since RLS policies use it)
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM anon;
