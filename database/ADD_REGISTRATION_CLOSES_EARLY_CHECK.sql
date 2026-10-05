-- ============================================================================
-- New system check: Registration Closes Before Last Day  (Oct 5, 2026)
-- ============================================================================
-- Jayme's rule: online registration must stay open through the event's LAST
-- day. Single-day event -> closes that day. Multi-day camp -> closes on its
-- last day. If iClass's "Allowed Registration Dates" end date is earlier,
-- no family can sign up after it.
--
-- Found by: Oasis camp 978 (Ninja School Closure Camp, May 12 2027) had
-- registration ending Feb 12 2027. On Oct 5 2026, 44 upcoming events closed
-- registration before they started.
--
-- Code: automation/validation_engine.py check_registration_closes_early
-- (reads only iClass registrationEndDate vs the last real meeting day).
-- Turn off / scope to gyms from Admin > Gym Rules like any other check.
-- ============================================================================

insert into rules (rule_type, value, label, description, gym_ids, program, scope,
                   is_permanent, is_active, is_system, created_by)
select 'check_registration_closes_early', 'system_check',
       'Registration Closes Before Last Day',
       'Flags events whose iClass Allowed Registration end date is before the event''s last day. Nobody can sign up online after that date. Single-day events must close on that day; multi-day camps on their last day. Added Oct 2026.',
       array['ALL'], 'ALL', 'all_events', true, true, true, 'system'
where not exists (select 1 from rules where rule_type = 'check_registration_closes_early');
