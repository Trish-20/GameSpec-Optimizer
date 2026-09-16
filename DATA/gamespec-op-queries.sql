USE gamespec_optimizer;

-- -- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
-- -- PAYROLL ACCOUNT
CREATE USER IF NOT EXISTS 'gamespec_database_username'@'%' IDENTIFIED BY 'gamespec_database_password';
-- GRANT ALL PRIVILEGES ON `gamespec_optimizer`.* TO 'gamespec_database_username'@'%';
-- FLUSH PRIVILEGES;
-- 
-- -- -- TESTING - VERIFICATION
-- SELECT USER FROM mysql.user;
-- SELECT CURRENT_ROLE();
-- SHOW GRANTS FOR 'gamespec_database_username'@'%';
-- SET GLOBAL local_infile = 1;
-- -- ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~