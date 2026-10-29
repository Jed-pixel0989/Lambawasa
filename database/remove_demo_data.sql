-- Removes the sample consumer accounts and records linked to them.
-- Run only when you intend to delete these known demo records.
START TRANSACTION;

DELETE FROM `meter_readings`
WHERE `consumer_id` IN (
  SELECT `id` FROM `consumers`
  WHERE `consumer_code` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008')
)
OR `bill_id` IN (
  SELECT `id` FROM `bills`
  WHERE `bill_no` IN ('WS-240981', 'WS-240977', 'WS-240973', 'WS-240966', 'WS-240955')
);

DELETE FROM `service_ratings`
WHERE `consumer_id` IN (
  SELECT `id` FROM `consumers`
  WHERE `consumer_code` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008')
);

DELETE FROM `notifications`
WHERE `account_no` IN ('ACC-88201', 'ACC-88202', 'ACC-88203', 'ACC-88204', 'ACC-88205', 'ACC-88206', 'ACC-88207', 'ACC-88208')
   OR `consumer_id` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008')
   OR `ticket_id` IN ('SR-2026-0182', 'SR-2026-0181', 'SR-2026-0180', 'SR-2026-0179');

DELETE FROM `audit_trail`
WHERE `target_entity` LIKE '%Amina Okafor%'
   OR `target_entity` LIKE '%Caleb Mensah%'
   OR `target_entity` LIKE '%Lina Santos%'
   OR `target_entity` LIKE '%Marco Dela Cruz%'
   OR `target_entity` LIKE '%Elena Rostova%'
   OR `target_entity` LIKE '%Danilo Aquino%'
   OR `target_entity` LIKE '%Sophia Villanueva%'
   OR `target_entity` LIKE '%Victor Tan Bakery%'
   OR `details` LIKE '%Amina Okafor%'
   OR `details` LIKE '%Caleb Mensah%'
   OR `details` LIKE '%Lina Santos%'
   OR `details` LIKE '%Marco Dela Cruz%'
   OR `details` LIKE '%Elena Rostova%'
   OR `details` LIKE '%Danilo Aquino%'
   OR `details` LIKE '%Sophia Villanueva%'
   OR `details` LIKE '%Victor Tan Bakery%';

DELETE calibration
FROM `meter_calibrations` AS calibration
JOIN `meter_assets` AS meter ON meter.`id` = calibration.`meter_id`
JOIN `consumers` AS consumer ON consumer.`id` = meter.`consumer_id`
WHERE consumer.`consumer_code` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008');

DELETE FROM `maintenance_tickets`
WHERE `consumer_id` IN (
  SELECT `id` FROM `consumers`
  WHERE `consumer_code` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008')
);

DELETE FROM `geo_connections`
WHERE `consumer_id` IN (
  SELECT `id` FROM `consumers`
  WHERE `consumer_code` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008')
);

DELETE FROM `payments`
WHERE `consumer_id` IN (
  SELECT `id` FROM `consumers`
  WHERE `consumer_code` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008')
)
OR `bill_id` IN (
  SELECT `id` FROM `bills`
  WHERE `bill_no` IN ('WS-240981', 'WS-240977', 'WS-240973', 'WS-240966', 'WS-240955')
);

DELETE FROM `billing_adjustments`
WHERE `bill_id` IN (
  SELECT `id` FROM `bills`
  WHERE `bill_no` IN ('WS-240981', 'WS-240977', 'WS-240973', 'WS-240966', 'WS-240955')
);

DELETE FROM `bills`
WHERE `consumer_id` IN (
  SELECT `id` FROM `consumers`
  WHERE `consumer_code` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008')
)
OR `bill_no` IN ('WS-240981', 'WS-240977', 'WS-240973', 'WS-240966', 'WS-240955');

DELETE FROM `meter_assets`
WHERE `consumer_id` IN (
  SELECT `id` FROM `consumers`
  WHERE `consumer_code` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008')
)
OR `serial_no` IN ('MTR-77291', 'MTR-77292', 'MTR-77293', 'MTR-77294', 'MTR-77295', 'MTR-77296', 'MTR-77297', 'MTR-77298');

DELETE FROM `consumers`
WHERE `consumer_code` IN ('C-1001', 'C-1002', 'C-1003', 'C-1004', 'C-1005', 'C-1006', 'C-1007', 'C-1008')
   OR `account_no` IN ('ACC-88201', 'ACC-88202', 'ACC-88203', 'ACC-88204', 'ACC-88205', 'ACC-88206', 'ACC-88207', 'ACC-88208');

COMMIT;
