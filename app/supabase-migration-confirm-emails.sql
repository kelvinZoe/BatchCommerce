-- Quick fix: Confirm all unconfirmed emails in auth.users
-- Run this once in Supabase SQL Editor to auto-confirm emails for development
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;
