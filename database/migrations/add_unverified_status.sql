-- Add 'unverified' status to verification_requests table CHECK constraint
-- This allows distinct state for revoked verifications vs new pending requests

ALTER TABLE verification_requests 
DROP CONSTRAINT IF EXISTS verification_requests_status_check;

ALTER TABLE verification_requests 
ADD CONSTRAINT verification_requests_status_check 
CHECK (status IN ('pending', 'approved', 'rejected', 'unverified'));
