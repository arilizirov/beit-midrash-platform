-- Row-level security on the tenancy hinge (SPEC §6, enforcement layer 4).
--
-- The tenant context is set per-transaction by src/platform/tenancy
-- (set_config('app.group_id', <id>, true)). current_setting(..., true)
-- returns NULL when unset, so with no context NO rows are visible or
-- writable: fail-closed by construction.
--
-- ENABLE binds non-owners; FORCE additionally binds the table owner.
-- NOTE (deliberate): superusers are NEVER bound by RLS — the application and
-- its tests must connect as a non-superuser role. The test suite provisions
-- one (see src/platform/tenancy/rls.test.ts globalSetup); production uses a
-- dedicated app role on Neon.

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;

CREATE POLICY "membership_tenant_isolation" ON "Membership"
  FOR ALL
  USING ("groupId" = current_setting('app.group_id', true))
  WITH CHECK ("groupId" = current_setting('app.group_id', true));
