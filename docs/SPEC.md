# CLAUDE.md — LearnTorah (בית המדרש הדיגיטלי) · Build Spec

This file is the single source of truth. It merges the approved planning dossier with all owner amendments and resolves every internal contradiction. Build from this file; do not consult PLANNING.html.

## 1. Product

A Hebrew-first digital Beit Midrash: a permanent, searchable archive of one private Torah study group's learning — Topics, Discussions, member opinions (Contributions), Summaries, Sources with citations, Articles, Notes, Tables, files, news feed. V1 serves one group; every row and route is shaped for a multi-tenant future.

**Principles:** Hebrew/RTL-native (never a translated skin) · archival permanence (versioned, soft-deleted, audited from day 1) · extensibility via seams, not scale (multi-tenant rows, service abstractions) · calm long-form reading · low-friction capture · typed + linked content, not document piles.

## 2. Stack (locked)

- Next.js App Router, React Server Components, Server Actions, TypeScript throughout
- PostgreSQL (single system of record) + Prisma (ORM + migrations)
- Auth.js (NextAuth v5), self-hosted, invite-only, email magic-link primary + optional password; Prisma adapter
- TipTap (ProseMirror). Canonical content = ProseMirror JSON (`contentJson`) + derived `contentText` (+ optional `contentHtml`). Derived rendering is a pure, tested function of the JSON — never hand-edited
- Cloudflare R2 (S3-compatible), presigned direct uploads; DB stores metadata + object keys only; `sharp` thumbnails server-side
- Search V1: Postgres `tsvector` (`simple` config) + `pg_trgm`, behind a `SearchService` abstraction (Meilisearch is a future swap behind the same seam)
- AI: none in V1 critical path. `AIService` abstraction stubbed; `pgvector` reserved. Future RAG must be cite-or-abstain
- Jobs: Postgres-backed job table behind a queue seam. **No Redis/BullMQ in V1** (future)
- Hosting: Vercel + Neon (pooled connection string from day 1) + R2. CI also builds a Docker image every release so a VPS path stays real
- Business logic lives in framework-agnostic service modules: SearchService, AIService, StorageService, SourceRefService (normalizer), TenancyGuard, ContentService. Module boundaries enforced with lint import rules

## 3. V1 scope — complete (owner decision: NO cuts)

Everything below ships in V1: auth + invitations; Group/Membership/RBAC; Topics, Categories, Tags; Discussions + Contributions + **flat text Comments (surfaced in UI)**; Summaries; Articles; Notes (private/group); TableBlock (inline + standalone); Attachments via R2; manual Sources + SourceCitations + **ref normalizer**; InternalLinks (TipTap node); News feed (**חדשות**, `/feed`); global search; home dashboard **with user-configurable widgets** (Hebrew date, zmanim/sunset, Shabbat times, Jewish calendar, weather, recent activity); **in-app notifications** (bell + unread count); Revisions, soft-delete, ActivityLog, EventLog; RTL design system, light/dark, deliberate mobile layout.

**Build order inside V1** (risk management — nothing here is deferred out of V1; all slices gate launch):
1. **Foundation:** Prisma schema + migrations, Auth.js invite/magic-link flows, TenancyGuard + Postgres RLS, Revision/ActivityLog/soft-delete, R2 presigned pipeline, purge + export flows.
2. **Core loop:** Topics/Categories/Tags, Discussions/Contributions/Comments, Summaries, Notes, Sources + normalizer + citations, search, quick-capture, in-app notifications.
3. **Editor completion:** SourceCitation node, Attachment node, InternalLink node, TableBlock (last).
4. **Periphery:** Articles, News feed, dashboard widgets, theming/polish.

**Explicitly future (not V1):** Sefaria API fetch, source sheets, study cards, paragraph-anchored + voice comments, transcription, email/push notification delivery, AI features (RAG/summaries/semantic search), additional groups, billing, non-Hebrew UI, Meilisearch (unless the search exit criterion fails — §8), Redis/BullMQ.

## 4. Data model

Conventions (apply to every entity unless noted): `id String @id @default(cuid())` (never auto-increment) · `groupId` on **every** content row, all composite indexes lead with it · `createdAt @default(now())`, `updatedAt @updatedAt` · soft delete via `deletedAt DateTime?` with a global read filter (hard delete prohibited outside the audited purge flow) · author FKs `onDelete: Restrict` · rich content = `contentJson Json` + `contentText String` (+ `contentHtml String?`) · closed sets are Postgres enums.

### Identity & tenancy
- **Group**: slug @unique, name, description?, settingsJson?. Parent of the whole content graph. V1 seeds exactly one.
- **User** (global, not group-scoped): email @unique, name?, hebrewName?, image?, locale @default("he"), passwordHash?, emailVerified?, status enum ACTIVE/SUSPENDED/DEACTIVATED. Plus Auth.js Account/Session/VerificationToken tables.
- **Membership** (User×Group×Role hinge — all RBAC hangs on it): userId, groupId, role enum `OWNER/ADMIN/EDITOR/MEMBER/GUEST`, status enum INVITED/ACTIVE/SUSPENDED, joinedAt?. `@@unique([userId, groupId])`.
- **Invitation**: groupId, email, role, token @unique (hashed, single-use), invitedById, expiresAt, acceptedAt?. `@@unique([groupId, email])` while pending → creates Membership on accept.

### Taxonomy
- **Category**: name, slug `@@unique([groupId, slug])`, parentId? (self-tree, max depth enforced in app), position Int.
- **Topic** (organizing spine): title, slug `@@unique([groupId, slug])`, description?, categoryId?, status enum DRAFT/PUBLISHED/ARCHIVED, authorId.
- **Tag**: name, slug `@@unique([groupId, slug])`. Tagging uses **per-type join tables with real FKs** (canonical — no polymorphic ContentTag): `TopicTag`, `DiscussionTag`, `ArticleTag`, `SourceTag`, `NoteTag`, each `@@id([xId, tagId])` + groupId.

### Discussion core
- **Discussion**: topicId (required), title (the question), contentJson/contentText (framing), status enum DRAFT/OPEN/RESOLVED/ARCHIVED, authorId.
- **Contribution** (one participant's opinion): discussionId, **authorId** (whose opinion) + **createdById** (who typed it — may differ; "edit own" RBAC checks createdById; UI shows both when they differ), contentJson/contentText, position Int, status.
- **Comment** — **V1: flat text replies on Contributions, surfaced in UI.** contributionId, authorId, body String, parentCommentId? (threading), `anchorJson Json?` + `voiceRecordingId String?` reserved nullable for Phase 2.5 (declared, unused).
- **Summary** — **1:many per Discussion** with `isCanonical Boolean @default(false)` (pinned/current version-of-record; enforce at most one canonical per discussion in service layer) + **`topicId String?`** so a curated summary can be pinned at Topic level. discussionId, contentJson/contentText, generatedByAI @default(false), authorId. (No `@unique` on discussionId.)

### Content bodies
- **Article**: title, slug `@@unique([groupId, slug])`, contentJson/contentText/contentHtml, topicId?, status, authorId, publishedAt?.
- **Note**: title?, contentJson/contentText, authorId, visibility enum `PRIVATE/GROUP`. **PRIVATE ⇒ author-only regardless of role**, enforced in guard layer; search rows carry visibility + authorId and SearchService filters mandatorily; future RAG inherits the filter. Attaches to other content via InternalLink, not hard FK.
- **TableBlock**: title?, dataJson `{columns, rows}`, authorId. Two modes: inline TipTap node inside another doc's contentJson (no row) or standalone row embeddable via InternalLink/citation. Versioned via Revision.
- **NewsPost** (feed, deliberately separate from Discussions): title, contentJson/contentText, type enum ANNOUNCEMENT/SOURCE/ARTICLE_REF/SCHEDULE/GENERAL, pinned @default(false), authorId, publishedAt?. Comment-free in V1. Label everywhere: **חדשות**; route `/feed`.

### Sources
- **Source** (Sefaria-aligned, group-scoped in V1): workTitle (e.g. Zevachim), workCategory enum `TALMUD_BAVLI/TANACH/MISHNAH/RAMBAM/SHULCHAN_ARUCH/MIDRASH/OTHER` (canonical value: TALMUD_BAVLI), ref (normalized string, e.g. `Zevachim 19a`), refStructured Json {work, section, subsection…}, hebrewRef? (זבחים י״ט ע״א), textHebrew? (cached), sefariaRef? (future sync), createdById. `@@unique([groupId, ref])` — citations reuse one row per ref.
- **SourceCitation** (polymorphic): sourceId, entityType enum `DISCUSSION/CONTRIBUTION/ARTICLE/NOTE/NEWSPOST/SUMMARY`, entityId (no DB FK — see polymorphism rule), selectionText?, selectionRange Json?, note?, createdById. `@@index([entityType, entityId])`, `@@index([sourceId])`.

### Polymorphism rule
SourceCitation, Attachment, InternalLink, Revision, Follow, Reaction, Notification use discriminator columns (entityType + entityId), **no DB-level FK on entityId**. Integrity holds because: (a) parents are only ever soft-deleted, (b) the service that soft-deletes a parent cascades to its polymorphic children in the same transaction, (c) a periodic integrity job flags orphans. One typed helper `resolveEntity(entityType, entityId)` — no hand-rolled switches. (Tags are the deliberate exception: thin links, small stable target set → real per-type FK tables.)

### Files
- **Attachment**: entityType enum `AttachmentTargetType` = DISCUSSION/CONTRIBUTION/ARTICLE/NOTE/NEWSPOST/TABLEBLOCK/SUMMARY, entityId, kind enum IMAGE/PDF/FILE, objectKey (R2 = blob source of truth), fileName, mimeType, sizeBytes, width?/height?, thumbnailKey?, uploadedById. `@@index([entityType, entityId])`.

### Cross-cutting
- **InternalLink** (directed content graph): fromType/fromId, toType/toId, relation? enum RELATED/REFERENCES/RESPONDS_TO/SUPERSEDES, createdById. `@@unique([fromType, fromId, toType, toId, relation])`, indexed both directions.
- **Revision** (one polymorphic table): entityType enum DISCUSSION/CONTRIBUTION/ARTICLE/NOTE/SUMMARY/TABLEBLOCK/NEWSPOST, entityId, version Int monotonic per entity, contentJson (full snapshot — not diffs), title?, editedById, changeNote?. `@@unique([entityType, entityId, version])`.
- **Follow**: userId, entityType TOPIC/DISCUSSION, entityId. `@@unique([userId, entityType, entityId])`.
- **Notification** (in-app in V1): userId, type enum REPLY/COMMENT/NEW_SOURCE/ANNOUNCEMENT/FOLLOWED_ACTIVITY/MENTION, entityType/entityId, actorId?, payloadJson? (denormalized preview), readAt?. `@@index([userId, readAt])`.
- **Reaction**: userId, entityType DISCUSSION/CONTRIBUTION/COMMENT/ARTICLE/NEWSPOST, entityId, type enum LIKE/AGREE/INSIGHT. `@@unique([userId, entityType, entityId, type])`.
- **ActivityLog** (append-only, never soft-deleted): actorId?, action string (`discussion.create`, `membership.role_change`…), entityType, entityId?, metadataJson? (before/after). `@@index([groupId, createdAt])`.
- **EventLog** (read-side metrics — searches, opens, revisits): userId?, event, entityType?, entityId?, metadataJson?, createdAt. Powers north-star metrics that ActivityLog (writes-only) cannot.

### Dashboard
- **Widget** (per-group catalog): key (`hebrew_date`, `shabbat_times`, `jewish_calendar`, `weather`, `recent_activity`…), name (Hebrew), defaultConfigJson?, enabled @default(true). `@@unique([groupId, key])`.
- **UserWidgetPref**: userId, widgetKey, visible @default(true), position Int, configJson? (location, units). `@@unique([userId, widgetKey])`.

### Reserved future entities (columns exist, tables do not — do NOT build)
VoiceRecording, Transcript, Embedding (pgvector), SourceSheet, StudyCard, AIConversation/AIMessage.

## 5. Routes & IA

RTL-first: CSS logical properties everywhere (`inline-start/end`); right rail = Topic/Category tree on desktop; bottom tab bar on mobile (בית / נושאים / חיפוש / חדשות / אזור-אישי); breadcrumbs read right→left with per-segment bidi isolation (`dir="auto"`). Slugs may contain Hebrew; a stable short id prefix guarantees uniqueness. `/g/[group]` prefix reserved but omitted in V1.

```
/                                    home dashboard (widgets + activity)
/topics                              index; ?category=&tag=
/topics/[slug]                       topic overview; tab in URL (/discussions /summaries /sources /notes /tables /files)
/topics/[slug]/discussions/[id]      discussion thread (canonical NESTED form — no top-level /discussions)
/topics/[slug]/summaries/[id]        ?rev= selects a Revision
/articles · /articles/[slug]
/sources · /sources/[ref]            [ref] = normalized ref, e.g. /sources/Zevachim.19a
/feed                                חדשות news feed
/search                              ?q= &type=
/me · /me/notifications · /me/settings
/admin · /admin/members · /admin/invitations · /admin/settings   (role-gated)
/auth/*                              Auth.js flows + invite acceptance
```

Topic secondary tabs: סקירה / דיונים / סיכומים / מקורות / הערות / טבלאות / קבצים. Sticky sub-header (title, follow, category/tag chips). Quick-capture on Home: one input "מה עלה בלימוד?" with chips הערה · מקור · דיון · קובץ — inline create without leaving Home.

## 6. AuthZ

Roles per group (Membership.role): OWNER > ADMIN > EDITOR > MEMBER > GUEST.

| Capability | owner | admin | editor | member | guest |
|---|---|---|---|---|---|
| View group content | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create Topic/Category/Tag | ✅ | ✅ | ✅ | ✅ | ➖ |
| Edit/delete Topic | ✅ | ✅ | ✅ | Own | ➖ |
| Post Contribution | ✅ | ✅ | ✅ | ✅ | ➖ |
| Edit/delete Contribution | ✅ | ✅ | ✅ | Own | Own |
| Create/edit Discussion, Summary, Article, Note, TableBlock | ✅ | ✅ | ✅ | Own | ➖ |
| Add Source/Citation | ✅ | ✅ | ✅ | ✅ | ➖ |
| Edit/delete Source | ✅ | ✅ | ✅ | Own | ➖ |
| Upload Attachment | ✅ | ✅ | ✅ | ✅ | ➖ |
| NewsPost CRUD | ✅ | ✅ | ✅ | ➖ | ➖ |
| React / Follow | ✅ | ✅ | ✅ | ✅ | ✅ |
| Moderate (others' content, pin, lock) | ✅ | ✅ | content only | ➖ | ➖ |
| Invite users | ✅ | ✅ | ➖ | ➖ | ➖ |
| Manage members/roles | ✅ | ✅ (not owners) | ➖ | ➖ | ➖ |
| Group settings / widget defaults | ✅ | ✅ | ➖ | ➖ | ➖ |
| Transfer ownership / delete Group | ✅ | ➖ | ➖ | ➖ | ➖ |
| View ActivityLog | ✅ | ✅ | ➖ | ➖ | ➖ |

Overrides: "Own" = createdById match; editor/admin/owner can always moderate Own-rows; admin can never modify/promote an owner; PRIVATE Notes are author-only for **everyone** including owner; all deletes are soft.

Enforcement — four layers, each failing closed; middleware is a coarse gate, never the boundary:
1. Edge middleware: unauthenticated → `/signin`; no anonymous access anywhere.
2. Every server action/route handler: `requireMembership(groupId)` then `assertCan(role, action, resource)` via one central `can()` helper.
3. Tenant-scoped Prisma client (`$extends`) injecting `where: { groupId }` on every query by construction.
4. **Postgres RLS policies on every content table — MANDATORY, not optional.** CI includes a cross-tenant read/write must-fail test; merges blocked without it.

Sessions: secure-cookie; magic-link short TTL; SPF/DKIM/DMARC on transactional email; **TOTP 2FA required for OWNER/ADMIN**, optional for members.

## 7. Storage, editing, versioning

- Presigned R2 uploads with enforced key prefix `groupId/…`, max size, allowed content-types; server-side post-upload validation + thumbnail generation; never trust client metadata; private-by-default reads via signed URLs.
- TipTap custom nodes in V1, exactly four: SourceCitation, Attachment, InternalLink, TableBlock. TableBlock uses the official TipTap table extension only — no custom table logic; isolated in its own editor module; explicit RTL acceptance test (mixed Hebrew/Latin cells, column resize).
- Assign stable IDs to block-level ProseMirror nodes now (Phase 2.5 comment anchoring hooks onto them without migration).
- **Revision policy:** autosave writes to a `draftJson` column only (ephemeral, excluded from search). A Revision row is written on explicit save, or on a 3-minute debounce during active editing — whichever first. All explicit revisions kept.
- **Concurrent edits:** optimistic concurrency — every save carries `baseRevisionId`; stale base ⇒ 409 + client-side diff/merge prompt. Last-write-wins is not acceptable for Summaries/Tables.
- **Purge & export (build in Foundation):** admin-only audited hard-purge (entity + revisions + R2 objects + search rows) distinct from soft-delete; per-group JSON + files export.
- Backups: Neon PITR + R2 object versioning; write a restore runbook and verify one restore before real content.

## 8. Search

- Searchable set (canonical): **Topic, Discussion, Contribution, Summary, Article, Note, Source, NewsPost.** Index rows carry groupId + visibility + authorId; tenancy and private-note filters are mandatory in SearchService.
- One **IMMUTABLE** SQL function `bm_normalize(text)` (nikud strip + diacritic fold) used by ALL `GENERATED ALWAYS … STORED` tsvector/trigram columns. Never use `unaccent()` (STABLE) inside generated columns — it will not compile.
- `tsvector` on `simple` config + `pg_trgm` GIN indexes for fuzzy/partial Hebrew.
- **Exit criterion before launch:** load ≥50 real Hebrew items; test morphological queries (ו/ה/ב/כ/ל/מ/ש prefixes, plural/gender variants) against an expected-hits list. <80% pass ⇒ Meilisearch enters V1 behind the SearchService seam. Measured, not assumed.

## 9. Ref normalizer (named V1 deliverable — SourceRefService)

Tractate/work name table (Hebrew + transliteration variants: Zevachim/Zvachim/זבחים → one canonical), daf/amud validation for Talmud, chapter:verse for Tanach, nested addressing for Rambam. No raw free-text ref field anywhere in the UI — entry goes through the normalizer; store structured parts + normalized string + hebrewRef. Every stored citation inherits its correctness; treat it as versioned so future Sefaria sync can correct legacy rows.

## 10. Acceptance criteria (launch gates)

1. Cross-tenant read/write fails in CI (RLS + guard test).
2. PRIVATE note invisible to any other user in UI **and** search.
3. Hebrew search exit criterion measured and passed (or Meilisearch promoted).
4. Ref normalizer rejects/normalizes the variant-spelling test set.
5. Restore-from-backup verified once.
6. TableBlock RTL acceptance test passes.
7. Concurrent-edit 409 path works on Summary.
8. Purge flow removes entity + revisions + R2 objects + search rows, with audit entry.
9. Full feature list of §3 present — nothing deferred.

## 11. Owner decisions (locked)

Vercel+Neon+R2 (Docker image in CI keeps VPS reversible) · login-gated public internet · tens of members, one group · audited purge + export built in V1 · manual refs + normalizer now, Sefaria API Phase 2 · voice/AI future · FTS-first with measured exit criterion · 2FA required for owner/admin.
