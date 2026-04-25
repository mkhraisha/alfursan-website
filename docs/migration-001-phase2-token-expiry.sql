-- Migration: add phase2_token_expires_at column
-- Run once against an existing Supabase database.
-- Safe to run multiple times (IF NOT EXISTS guard).

ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS phase2_token_expires_at TIMESTAMPTZ;
