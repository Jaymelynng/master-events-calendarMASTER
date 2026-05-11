# iClassPro Platform Knowledge — Embedded Reference

**Purpose:** Make sure every AI agent that opens this project knows the foundational facts about iClassPro BEFORE proposing anything that involves the platform. This folder is a checked-in copy of the user-level `iclasspro-kb` skill, embedded here so the project is self-contained.

## The single most important fact

**iClassPro has NO public REST API.** This is why this entire tool exists. The repo's `f12_collect_and_import.py` scraper, the manual `camp_pricing` / `event_pricing` tables, all of it — they exist BECAUSE iClassPro deliberately does not expose data programmatically.

Do not propose "let's just use iClassPro's API" or "let's connect via Zapier" or "let's email iClass for a partner API." It does not exist. It will not exist. This is documented as a deliberate platform decision since 2008.

## Read in this order

1. **`PLATFORM_OVERVIEW.md`** — the canonical iClassPro KB (originally the SKILL.md content). Read this first. It covers: what iClass can do, what it can't, narrow native integrations that DO exist (MailChimp / QBO / Stripe / ADP / Power BI), tier-based pricing, autopilot workflows, reports.

2. **`reference/api-and-integrations.md`** — technical architecture, every integration point that exists, every one that doesn't, Data Warehouse details.

3. **`reference/limitations-and-workarounds.md`** — every known platform pain point with context, plus strategic opportunities and product ideas.

4. **`reference/platform-deep-dive.md`** — full feature details, billing mechanics, settings paths, enrollment system, attendance, skills tracking.

5. **`reference/article-index.md`** — full index of all 569 iClassPro support KB articles, organized by section, with direct URLs. Use this to look up specific procedures.

6. **`reference/competitors.md`** — competitive landscape, feature comparison matrix.

7. **`reference/support-and-urls.md`** — all official iClassPro links, support KB structure, settings navigation paths.

## What's NOT in this folder

- `_full-kb-dump.md` (3.3MB) — full text of all 569 KB articles from the 2026-04-30 scrape. Lives in the user-level skill folder at `C:\Users\Jayme\.claude\skills\iclasspro-kb\reference\_full-kb-dump.md`. Grep there for specific article body text when needed; we don't ship that file in this repo because of size.

## When to refresh

The original skill notes "Last KB refresh: 2026-04-30." When the user-level skill gets re-scraped, this embedded copy goes stale. Process:

1. User re-runs the iclasspro-kb scrape in the skill folder
2. Re-copy SKILL.md → `PLATFORM_OVERVIEW.md` and all `reference/*.md` (except `_full-kb-dump.md`) into this folder
3. Commit. The project stays current.

## Relationship to the project doc-map hook

`.claude/settings.json` includes this folder in the UserPromptSubmit hook so every session for this project sees "PLATFORM / ICLASSPRO / API GAPS → docs/ICLASSPRO/PLATFORM_OVERVIEW.md" in the doc-map message. That guarantees a fresh AI agent reads it before suggesting anything iClass-related.
