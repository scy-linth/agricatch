-- Remove otp_verification feature flag
-- OTP verification is now controlled via platform_settings (otp_mode)
-- instead of feature_flags

DELETE FROM feature_flags WHERE key = 'otp_verification';
