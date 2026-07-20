-- A tag vocabulary must not silently fork: the slug embeds each row's own id
-- prefix, so two tags named "קדשים" get different slugs and the existing slug
-- unique never fires. Bind the NAME instead, for live rows only (ADR 0002).
CREATE UNIQUE INDEX "Tag_groupId_name_active_key" ON "Tag"("groupId", "name")
  WHERE "deletedAt" IS NULL;
