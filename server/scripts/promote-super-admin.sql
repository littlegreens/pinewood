-- Esegui sostituendo l'email reale dell'account Pinewood.
UPDATE users
SET role = 'super_admin'
WHERE email = 'pinewood@example.com';
