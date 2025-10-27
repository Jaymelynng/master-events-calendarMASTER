-- INSERT STATEMENTS FOR MISSING OCTOBER 1-21 EVENTS
-- These events were in your database before but are missing now because iClassPro doesn't show past events

-- Based on the data I extracted from your saved files and what you pasted earlier:

INSERT INTO "public"."events" ("gym_id", "title", "date", "time", "price", "day_of_week", "type", "event_url", "start_date", "end_date", "availability_status") VALUES 

-- CCP October 1-21 Events
('CCP', 'Pumpkin Palooza | School Year Camp | Ages 4-13 | Thursday, October 16, 2025 | 9 am-3 pm | $67/day', '2025-10-16', '9:00 AM - 3:00 PM', '67', 'Thursday', 'CAMP', 'https://portal.iclasspro.com/capgymavery/camp-details/1178', '2025-10-16', '2025-10-16', 'available'),
('CCP', 'Pumpkin Palooza | School Year Camp | Ages 4-13 | Friday, October 17, 2025 | 9 am-3 pm | $67/day', '2025-10-17', '9:00 AM - 3:00 PM', '67', 'Friday', 'CAMP', 'https://portal.iclasspro.com/capgymavery/camp-details/1142', '2025-10-17', '2025-10-17', 'available'),
('CCP', 'Spooky (Not So Scary) Camp | School Year Camp | Ages 4-13 | Monday, October 20, 2025 | 9 am-3 pm | $67/day', '2025-10-20', '9:00 AM - 3:00 PM', '67', 'Monday', 'CAMP', 'https://portal.iclasspro.com/capgymavery/camp-details/1143', '2025-10-20', '2025-10-20', 'available'),
('CCP', 'Cartwheel Clinic | Ages 6+ | Friday, October 17, 2025 | 6:15pm-7:15pm', '2025-10-17', '6:15 PM - 7:15 PM', null, 'Friday', 'CLINIC', 'https://portal.iclasspro.com/capgymavery/camp-details/1196', '2025-10-17', '2025-10-17', 'available'),
('CCP', 'Gym Fun Fridays | Open Gym | Ages 1-5 | October 17, 2025 | 10:30am -12:00pm', '2025-10-17', '10:30 AM - 12:00 PM', null, 'Friday', 'OPEN GYM', 'https://portal.iclasspro.com/capgymavery/camp-details/1170', '2025-10-17', '2025-10-17', 'available'),

-- CPF October 1-21 Events
('CPF', 'No School Day Camp | October 17th | Half Day (9-12) | $45', '2025-10-17', '9:00 AM - 12:00 PM', '45', 'Friday', 'CAMP', 'https://portal.iclasspro.com/capgymhp/camp-details/2444', '2025-10-17', '2025-10-17', 'available'),
('CPF', 'No School Day Camp | October 20th | Half Day (9-12) | $45', '2025-10-20', '9:00 AM - 12:00 PM', '45', 'Monday', 'CAMP', 'https://portal.iclasspro.com/capgymhp/camp-details/2447', '2025-10-20', '2025-10-20', 'available'),
('CPF', 'No School Day Camp | October 17th | Full Day (9-3) | $60', '2025-10-17', '9:00 AM - 3:00 PM', '60', 'Friday', 'CAMP', 'https://portal.iclasspro.com/capgymhp/camp-details/2453', '2025-10-17', '2025-10-17', 'available'),
('CPF', 'No School Day Camp | October 20th | Full Day (9-3) | $60', '2025-10-20', '9:00 AM - 3:00 PM', '60', 'Monday', 'CAMP', 'https://portal.iclasspro.com/capgymhp/camp-details/2454', '2025-10-20', '2025-10-20', 'available'),
('CPF', 'Homeschool Open Gym | October 15th | 10:00-11:30am | $10', '2025-10-15', '10:00 AM - 11:30 AM', '10', 'Wednesday', 'OPEN GYM', 'https://portal.iclasspro.com/capgymhp/camp-details/2494', '2025-10-15', '2025-10-15', 'available'),
('CPF', 'Gym Fun Fridays | October 17th | 10:00-11:30am | $10', '2025-10-17', '10:00 AM - 11:30 AM', '10', 'Friday', 'OPEN GYM', 'https://portal.iclasspro.com/capgymhp/camp-details/2487', '2025-10-17', '2025-10-17', 'available'),
('CPF', 'October 17:: Open Gym: Ages 6:30pm-8:30pm ($15)', '2025-10-17', '6:30 PM - 8:30 PM', '15', 'Friday', 'OPEN GYM', 'https://portal.iclasspro.com/capgymhp/camp-details/2498', '2025-10-17', '2025-10-17', 'available'),

-- CRR October 1-21 Events  
('CRR', 'Schools Out Camp RRISD | FULL DAY | Ages 4+ |Oct 20th', '2025-10-20', '9:00 AM - 3:00 PM', null, 'Monday', 'CAMP', 'https://portal.iclasspro.com/capgymroundrock/camp-details/1586', '2025-10-20', '2025-10-20', 'available'),
('CRR', 'Beg and Int Bars Clinic | Clinic | Ages 5+ | October 17th', '2025-10-17', '6:30 PM - 7:30 PM', null, 'Friday', 'CLINIC', 'https://portal.iclasspro.com/capgymroundrock/camp-details/1585', '2025-10-17', '2025-10-17', 'available'),

-- EST October 1-21 Events
('EST', 'Homeschool Open Gym| Tuesday, October 21st', '2025-10-21', '1:00 PM - 2:00 PM', null, 'Tuesday', 'OPEN GYM', 'https://portal.iclasspro.com/estrellagymnastics/camp-details/564', '2025-10-21', '2025-10-21', 'available'),

-- HGA October 1-21 Events
('HGA', 'Beam Clinic | Ages 5-17 | Oct 18 | 12pm', '2025-10-18', '12:00 PM - 1:00 PM', null, 'Saturday', 'CLINIC', 'https://portal.iclasspro.com/houstongymnastics/camp-details/867', '2025-10-18', '2025-10-18', 'available'),
('HGA', 'Open Gym | Ages 7-17 | Oct 17th', '2025-10-17', '6:00 PM - 7:00 PM', null, 'Friday', 'OPEN GYM', 'https://portal.iclasspro.com/houstongymnastics/camp-details/835', '2025-10-17', '2025-10-17', 'available'),
('HGA', 'Flip into Fall | Kids Night Out | Ages 4-12 | Oct 18th', '2025-10-18', '6:00 PM - 9:30 PM', null, 'Saturday', 'KIDS NIGHT OUT', 'https://portal.iclasspro.com/houstongymnastics/camp-details/840', '2025-10-18', '2025-10-18', 'available'),

-- OAS October 1-21 Events
('OAS', 'Pullover Clinic| Ages 5+ | October 17th', '2025-10-17', '6:30 PM - 7:30 PM', null, 'Friday', 'CLINIC', 'https://portal.iclasspro.com/oasisgymnastics/camp-details/801', '2025-10-17', '2025-10-17', 'available'),

-- RBA October 1-21 Events
('RBA', 'Unicorn Creative Dance Camp | Ages 4+ |October 13th, 14th and 17th | 10AM - 12PM', '2025-10-13', '10:00 AM - 12:00 PM', null, 'Monday', 'CAMP', 'https://portal.iclasspro.com/rbatascocita/camp-details/2102', '2025-10-13', '2025-10-13', 'available'),
('RBA', 'School''s Out - Fall Break Camp - Gymnastics/Ninja| Ages 4+ | October 13th - October 17th', '2025-10-13', '9:00 AM - 3:00 PM', null, 'Monday', 'CAMP', 'https://portal.iclasspro.com/rbatascocita/camp-details/2068', '2025-10-13', '2025-10-17', 'available'),
('RBA', 'Costume Contest | Kids Night Out | Ages 4-12 | October 17', '2025-10-17', '7:00 PM - 9:30 PM', null, 'Friday', 'KIDS NIGHT OUT', 'https://portal.iclasspro.com/rbatascocita/camp-details/2088', '2025-10-17', '2025-10-17', 'available'),

-- RBK October 1-21 Events
('RBK', 'HISD Fall Break Camp 2025 | Oct 13-17 | 9AM - 3PM', '2025-10-13', '9:00 AM - 3:00 PM', null, 'Monday', 'CAMP', 'https://portal.iclasspro.com/rbkingwood/camp-details/1550', '2025-10-13', '2025-10-17', 'available'),
('RBK', 'Cheer Tumbling Clinic| Oct 18 | Saturday 12:30-2pm', '2025-10-18', '12:30 PM - 2:00 PM', null, 'Saturday', 'CLINIC', 'https://portal.iclasspro.com/rbkingwood/camp-details/1564', '2025-10-18', '2025-10-18', 'available'),

-- SGT October 1-21 Events
('SGT', 'Girls Gymnastics Fall Break Camp 2025 | Ages 5+ | October 13th-17th', '2025-10-13', '9:00 AM - 3:00 PM', null, 'Monday', 'CAMP', 'https://portal.iclasspro.com/scottsdalegymnastics/camp-details/1883', '2025-10-13', '2025-10-17', 'available'),
('SGT', 'Parkour & Ninja Fall Break Camp 2025 | Ages 5+ | October 13th-17th', '2025-10-13', '9:00 AM - 3:00 PM', null, 'Monday', 'CAMP', 'https://portal.iclasspro.com/scottsdalegymnastics/camp-details/1884', '2025-10-13', '2025-10-17', 'available'),
('SGT', 'Kids Night Out | Spooky Night | Ages 5-12 | 10/17/25', '2025-10-17', '6:30 PM - 9:30 PM', null, 'Friday', 'KIDS NIGHT OUT', 'https://portal.iclasspro.com/scottsdalegymnastics/camp-details/1898', '2025-10-17', '2025-10-17', 'available');

-- Summary of October 1-21 Events by Gym:
-- CCP: 3 CAMP, 1 CLINIC, 1 OPEN GYM = 5 events
-- CPF: 4 CAMP, 3 OPEN GYM = 7 events  
-- CRR: 1 CAMP, 1 CLINIC = 2 events
-- EST: 1 OPEN GYM = 1 event
-- HGA: 1 CLINIC, 1 OPEN GYM, 1 KNO = 3 events
-- OAS: 1 CLINIC = 1 event
-- RBA: 2 CAMP, 1 KNO = 3 events
-- RBK: 1 CAMP, 1 CLINIC = 2 events
-- SGT: 2 CAMP, 1 KNO = 3 events
-- TOTAL: 27 events missing from October 1-21
