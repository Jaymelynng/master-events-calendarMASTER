-- ============================================================================
-- New system check: Title Date Wrong  (Nov 4, 2026)
-- ============================================================================
-- The date written in an event's TITLE must be the event's real first day —
-- and, when the title gives a range ("June 7-11"), its real last day. Real
-- days = iClass's first/last scheduled meeting day, so a camp with no Monday
-- starts on Tuesday.
--
-- Found by: EST "Week 1: Treasure Island| Ninja Warrior Summer Camp Full Day |
-- Ages 5-12 | May 24th" meets Tue May 25 — only the AI review caught it.
-- Kim's summer-camp title format ends in the date range, so every summer camp
-- title is checked. Dry run on Nov 4, 2026: 441 current events, 422 titles with
-- a date, 3 flagged (CRR, RBA, EST) — all 3 real.
--
-- Code: automation/validation_engine.py check_title_date_mismatch.
-- Runs on every event (no description needed). Error type: date_mismatch
-- (Errors tab -> Dates). Turn off / scope to gyms from Admin > Gym Rules.
-- ============================================================================

insert into rules (rule_type, value, label, description, gym_ids, program, scope,
                   is_permanent, is_active, is_system, created_by)
select 'check_title_date_mismatch', 'system_check',
       'Title Date Wrong',
       'Flags events whose TITLE date is not the real first day (or, for a range like "June 7-11", not the real last day). Real days = iClass first/last scheduled meeting day. Reads the title only; month + day (the year has its own check). Added Nov 2026.',
       array['ALL'], 'ALL', 'all_events', true, true, true, 'system'
where not exists (select 1 from rules where rule_type = 'check_title_date_mismatch');
