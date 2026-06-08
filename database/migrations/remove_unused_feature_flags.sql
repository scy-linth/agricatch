-- Remove unused feature flags
-- Keeps only: price_drop_alerts, platform_announce

DELETE FROM feature_flags
WHERE key IN ('guest_cart', 'product_reviews', 'farmer_chat', 'otp_verification');
