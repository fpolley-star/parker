UPDATE vehicle_types
SET parent = CASE identifier
WHEN 'Business Class MPV' THEN 'ec452358-4ab1-4101-baa2-619b3a5e449d'
ELSE parent
END
where identifier in ('Business Class MPV')