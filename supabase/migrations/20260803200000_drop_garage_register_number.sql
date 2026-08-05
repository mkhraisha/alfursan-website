-- Remove garage_register_number: unused free-text field on vehicles.
-- Never populated in production (0/96 vehicles) and not read anywhere in
-- the admin UI or public site. The Ontario Garage Register compliance log
-- (/admin/garage) is a separate feature built from purchased_from_name/
-- purchased_from_address/purchaser_name/purchaser_address — it never used
-- this column.
ALTER TABLE vehicles DROP COLUMN IF EXISTS garage_register_number;
