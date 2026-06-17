-- Add document_url field to verification_requests table
ALTER TABLE verification_requests 
ADD COLUMN IF NOT EXISTS document_url TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_verification_requests_document_url 
ON verification_requests(document_url) 
WHERE document_url IS NOT NULL;
