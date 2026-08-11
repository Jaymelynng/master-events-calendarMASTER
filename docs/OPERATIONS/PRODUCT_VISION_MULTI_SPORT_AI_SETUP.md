# Product vision — multi-sport readiness & AI-assisted setup

**Last updated:** April 8, 2026  
**Owner intent:** Jayme — research toward **other sports** and an **AI startup / product** that helps organizations **set up** this class of calendar + data-quality tool **without** requiring technical staff.

---

## 1. Why the current architecture fits “more than gymnastics”

| Layer | Today (gymnastics / iClassPro) | Generalizes to |
|-------|--------------------------------|----------------|
| **Collection** | Direct HTTP (or fallback) to a vendor portal | Other APIs, CSV import, or alternate LMS/registration exports — same downstream **event shape** where possible |
| **Identity / diff** | `event_url` + `eventComparison.js` | Any stable per-event URL or composite key |
| **Validation** | `validation_engine.py` compares **structured fields** vs **title/description** | Same **pattern** for camps, clinics, games, tournaments — wording and program types change per sport |
| **Per-tenant config** | `rules`, pricing tables, `gym_links` | Per org / per facility without forking Python per customer |

**Universal embedded rules** (case-insensitive text, month windows, time regex cleanup, CAMP day skip, etc.) are **one codebase for all gyms** on purpose. Different sports mainly change **vocabulary** (program types, synonyms, pricing rows), not the idea of “does the copy match the system?”

---

## 2. Planned direction: AI-assisted admin setup (not specified as shipped product yet)

**Differentiator (Jayme’s angle):** Most orgs won’t think of the **small operational details** that actually break calendar + marketing consistency — title/description vs registration system, month edge cases, time regex traps, day-range false positives, pricing tables, when to skip checks for camps, etc. Those came from **real pain points** discovered building this product. A future setup layer would bake in that **experience as defaults and guardrails**, then add **custom specialization suggestions** for the customer’s **sport or industry** (program wording, typical event types, synonym ideas, what to validate first) — not a generic checklist only.

**Goal:** An onboarding experience (human + AI) that helps a new customer:

- Understand **what** the system validates (plain language, linked to `AUDIT_DATA_ERROR_REFERENCE.md`).
- Complete **Pricing** (`camp_pricing`, `event_pricing`) and **Gym Rules** (`valid_price`, `valid_time`, `program_synonym`, check toggles).
- Configure **gym links** and basic **program type** mapping.
- Get **sport- or industry-aware suggestions** for rules and copy patterns (always with human review where it affects money or compliance).
- Avoid **operator-only** workflows (e.g. DevTools JWT capture) as a requirement for core value.

**Boundaries for any AI/automation product:**

- **Safe:** Guided data entry, explanations, checklists, draft `rules` rows for human approval, dry-run validation reports.
- **Requires explicit design:** Letting customers edit the **embedded** comparison logic (regex bundles) from the UI — that implies a **rules engine** or codegen pipeline with tests, not ad-hoc string edits.
- **Contract:** Price validation stays aligned with `PRICING_SOURCE_OF_TRUTH.md` until product intentionally changes it.

---

## 3. In-repo memory

High-level plan is also captured in **`memory/MEMORY.md`** so Cursor/Claude sessions that read the repo see the same story.

---

## 4. Related documentation

- [AUDIT_DATA_ERROR_REFERENCE.md](./AUDIT_DATA_ERROR_REFERENCE.md) — what each check does  
- [PRICING_SOURCE_OF_TRUTH.md](./PRICING_SOURCE_OF_TRUTH.md) — pricing tables + non-goals  
- [DATA_QUALITY_VALIDATION.md](./DATA_QUALITY_VALIDATION.md) — operator-facing narrative  
- [VALIDATION_RULES_ARCHITECTURE.md](../TECHNICAL/VALIDATION_RULES_ARCHITECTURE.md) — precoded vs DB-driven checks  

---

## 5. Changelog

| Date | Note |
|------|------|
| Apr 8, 2026 | First write — multi-sport + AI setup vision documented from Jayme’s direction |
| Apr 8, 2026 | Added differentiator: pain-point-derived defaults + sport/industry specialization suggestions |
