-- Fix: remove the direct client INSERT policy on study_rooms.
--
-- Problem: "authenticated users can create rooms" (0001_rag_and_rls.sql) let
-- any authenticated client insert a row into study_rooms directly (as long
-- as owner_id = auth.uid()), bypassing every check that create_study_room()
-- performs — name length, and the requirement that private rooms carry a
-- hashed access_code. A direct insert also never adds the creator to
-- room_members, so the room becomes unmanageable (no one passes
-- is_room_moderator()) and, if kind = 'open', still shows up publicly per
-- the "open rooms are public" SELECT policy. Net effect: an attacker could
-- spam junk/broken rooms into the public listing, or create "private" rooms
-- with no real access code.
--
-- Fix: rooms may only be created through create_study_room(), which is
-- SECURITY DEFINER and therefore not subject to this INSERT policy at all.
-- Dropping the policy removes the raw-insert path while leaving the RPC
-- fully functional.

drop policy if exists "authenticated users can create rooms" on public.study_rooms;

-- No replacement INSERT policy is added on purpose: with RLS enabled and no
-- INSERT policy, direct client inserts into study_rooms are denied outright.
-- create_study_room() still works because SECURITY DEFINER functions run
-- with the privileges of the function owner, not the calling role.
