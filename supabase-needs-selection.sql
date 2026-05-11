-- Migration: add needs_selection flag to users table
-- Run this in the Supabase SQL Editor after the main schema is set up.

alter table public.users
  add column if not exists needs_selection boolean not null default false;
