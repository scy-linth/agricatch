-- Add index on reviews.product_id for faster product detail queries
-- This improves performance of subqueries in GET /products/:id endpoint
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
