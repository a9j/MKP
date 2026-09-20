-- 0008a_document_owner_type_source
-- Runs on its own, same pattern as 0006a: a new enum value cannot be used
-- in the same transaction that adds it.
-- 'source' = a captured original that is not attached to a records request,
-- report, listening session, template, or meeting.

alter type public.document_owner_type add value if not exists 'source';
