-- ============================================================================
-- ADD MANAGER CONTACTS TO GYMS TABLE
-- ============================================================================
-- Adds manager_name and manager_email columns to the gyms table
-- for the email notification feature.
--
-- Created: February 23, 2026
-- ============================================================================

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS manager_name TEXT;
ALTER TABLE gyms ADD COLUMN IF NOT EXISTS manager_email TEXT;

UPDATE gyms SET manager_name = 'Cheryl', manager_email = 'cwisehart@powersgym.com' WHERE id = 'CCP';
UPDATE gyms SET manager_name = 'Megan', manager_email = 'mpina@powersgym.com' WHERE id = 'CPF';
UPDATE gyms SET manager_name = 'Xandria', manager_email = 'xshort@powersgym.com' WHERE id = 'CRR';
UPDATE gyms SET manager_name = 'Maryah', manager_email = 'mdominguez@powersgym.com' WHERE id = 'EST';
UPDATE gyms SET manager_name = 'Misty', manager_email = 'mherrera@powersgym.com' WHERE id = 'HGA';
UPDATE gyms SET manager_name = 'Kailey', manager_email = 'khengesbach@powersgym.com' WHERE id = 'OAS';
UPDATE gyms SET manager_name = 'Dena', manager_email = 'dcampbell@powersgym.com' WHERE id = 'RBA';
UPDATE gyms SET manager_name = 'Kristin', manager_email = 'kwest@powersgym.com' WHERE id = 'RBK';
UPDATE gyms SET manager_name = 'Sophia', manager_email = 'sficco@powersgym.com' WHERE id = 'TIG';
