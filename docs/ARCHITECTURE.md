# ARCHITECTURE.md — the birds-eye map (builder keeps this current)

Project: **LearnTorah — בית המדרש הדיגיטלי**. Spec: [`docs/SPEC.md`](./SPEC.md).
The auditor reads THIS first. `boundaries.yaml` + the import graph are ground
truth for connections; this file adds the human-readable "why".

> STATUS: Foundation in progress. **Live modules: `app`, `shared_kernel`,
> `platform` (db + tenancy + auth)** — Prisma 7 tenancy core (Group/User/Membership),
> Postgres RLS on Membership with the SPEC §10.1 cross-tenant must-fail suite
> (verified falsifiable: dropping the policy fails 5 tests). Remaining modules
> go live when their slice is stamped with `python bigbrainGenerator/new_domain.py
> <name>` and registered in `boundaries.yaml`.

## Modules

| Module | Purpose (one line) | Depends on | Spec ref |
|---|---|---|---|
| `app` | Next.js App Router — routes, server actions; the composition root that wires everything | all domains + platform, ui | §5 |
| `platform` | db (Prisma), auth (Auth.js), storage (R2), jobs (Postgres queue), tenancy (TenancyGuard + RLS), telemetry (ActivityLog/EventLog), purge (audited hard delete) | — | §2, §6 |
| `ui` | RTL design-system primitives; pure presentation, no domain logic | — | §5 |
| `shared_kernel` | ids (cuid), Result/errors, Hebrew bidi + nikud helpers, shared enums | — (imports nothing) | §4 |
| `features/identity` | Group, User, Membership, Invitation, and the central `can()` RBAC helper | platform, ui | §4, §6 |
| `features/taxonomy` | Topic, Category, Tag + the per-type tag join tables | platform, ui, identity, search | §4 |
| `features/discussions` | Discussion → Contribution → Comment, and Summary (1:many, `isCanonical`) | platform, ui, identity, taxonomy, search, notifications | §4 |
| `features/content` | Article, Note, TableBlock, Revision, ContentService (ProseMirror JSON + derived text) | platform, ui, identity, taxonomy, search | §4, §7 |
| `features/sources` | Source, SourceCitation, and SourceRefService — the ref normalizer | platform, ui, identity, search | §4, §9 |
| `features/files` | Attachment + the presigned R2 upload/download flow | platform, ui, identity | §4, §7 |
| `features/search` | SearchService — tsvector + pg_trgm over `bm_normalize`; tenancy + private-note filters are mandatory | platform | §8 |
| `features/feed` | NewsPost — the חדשות feed, deliberately separate from Discussions | platform, ui, identity, search | §4, §5 |
| `features/notifications` | Notification, Follow, Reaction (in-app only in V1) | platform, ui, identity | §4 |
| `features/dashboard` | Widget catalog + UserWidgetPref (Hebrew date, zmanim, Shabbat times, weather…) | platform, ui, identity | §4 |
| `features/editor` | The four TipTap nodes: SourceCitation, Attachment, InternalLink, TableBlock | platform, ui, content, sources, files | §7 |

## Connections (the shape)

- **Layering.** `app` composes; domains hold business logic; `platform` owns
  infrastructure and depends on no domain; `ui` and `shared_kernel` are leaves.
- **No sideways coupling** between domains except where the spec forces it — a
  Discussion needs its Topic, so `discussions → taxonomy`; the editor renders
  citations/attachments, so `editor → sources, files, content`.
- **Indexing and notifying are push-based.** A domain calls `search` /
  `notifications`; neither ever imports a domain back. That keeps `search` a
  leaf instead of a hub depending on all eight things it indexes.
- **Tenancy is not a domain concern.** Every read is scoped by the tenant-scoped
  Prisma client in `platform`, with Postgres RLS underneath it as the wall.

## Notes

- Reserved-but-unbuilt (SPEC §4): VoiceRecording, Transcript, Embedding,
  SourceSheet, StudyCard, AIConversation/AIMessage. Columns may exist; **tables
  and modules must not be created.**
- `AIService` exists as a stubbed seam only — no AI in the V1 critical path.
- Build order (SPEC §3) crosses these modules rather than following them:
  Foundation → Core loop → Editor completion → Periphery. Expect `platform` and
  `identity` to become real first; `editor` and `dashboard` last.
