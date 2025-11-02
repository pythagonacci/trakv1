-- Add 'pdf' to block_type enum
-- Run this in Supabase SQL Editor

ALTER TYPE block_type ADD VALUE IF NOT EXISTS 'pdf';

