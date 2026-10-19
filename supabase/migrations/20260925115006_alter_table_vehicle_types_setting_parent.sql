UPDATE vehicle_types
SET parent = CASE identifier
    WHEN '6 Seater' THEN 'f3d3c0d6-0dd1-42c5-b2d7-3d978bba026e'
    WHEN 'Any Vehicle' THEN '51cb713b-6118-4564-ba7f-b45119047d58'
    WHEN '7 Seater' THEN '7af4527e-070e-40d6-8cdc-e2abe59d17bd'
    WHEN '5 Seater' THEN 'f3d3c0d6-0dd1-42c5-b2d7-3d978bba026e'
    WHEN 'Business Class Vehicle' THEN '9398788e-94e5-4981-94cc-096d556af621'
    WHEN 'Business Class 16 Seat Minibus' THEN '9995fdb7-9c34-4988-8803-c70d5c8f9ada'
    WHEN 'Wheelchair Accessible' THEN '167cbb35-de44-40e2-8a77-54172df9ae33'
    WHEN 'Estate Car' THEN '64aab2a6-b0ce-4c46-a411-b26e8d156933'
    WHEN 'First Class Vehicle' THEN '2c4ef11c-c94b-4109-abe2-57f90e64848e'
    WHEN 'Business Class MPV' THEN '9995fdb7-9c34-4988-8803-c70d5c8f9ada'
    WHEN 'Low Car' THEN 'c20a6037-2a67-4963-9aa7-e69f900be45a'
    WHEN '8 Seater' THEN '7af4527e-070e-40d6-8cdc-e2abe59d17bd'
    WHEN 'Electric Vehicle' THEN 'd4e8fc9a-ab4f-4698-9d3b-d241ef53b1ee' 
    ELSE parent
END
WHERE identifier IN ('6 Seater', 'Any Vehicle', '7 Seater', '5 Seater', 'Business Class Vehicle', 'Business Class 16 Seat Minibus', 'Wheelchair Accessible', 'Estate Car', 'First Class Vehicle', 'Business Class MPV', 'Low Car', '8 Seater', 'Electric Vehicle');
