SELECT 'CREATE DATABASE vault_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vault_test')\gexec
