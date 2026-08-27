# Security

This repository contains only client-side application code. Never commit private health data, exports, storage objects, database dumps, authenticated sessions, passwords, service-role keys, secret keys, or signed URLs.

The browser uses only the Supabase publishable key. Authorization of health records is enforced by Row Level Security in the dedicated LTS Health Supabase project.

If a credential with elevated privileges is ever exposed, rotate it immediately and review backend logs and RLS policies before resuming production use.
