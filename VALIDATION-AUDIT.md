# AgriCatch Input Validation Audit

**Scope:** Frontend HTML/JS, backend Express routes, PostgreSQL schema/migrations.  
**Methodology:** Static extraction of `<input>`, `<textarea>`, `<select>` tags, `req.body/query/params` parameters, and `CREATE/ALTER TABLE` definitions. Heuristic BE/DB mapping based on naming; verify dynamic forms manually where noted.  
**Date:** 2026-07-08T18:44:30.228Z

## Summary

- **Total Inputs:** 400
- **Properly Validated (client-side):** 126
- **Missing Validation:** 274
- **Critical:** 155
- **Medium:** 239
- **Low:** 135

> **Note on counts:** The totals are derived from static extraction and heuristic rule matching. Some entries (e.g., dual-purpose fields such as `auth-email` which accepts username or email, filter/select fields whose names contain "price" but are not numeric inputs, and optional image fields) may be false positives. Treat these findings as a prioritised starting point for manual review, not an authoritative vulnerability list.

### Critical Findings

| File | Line | Field | Missing | Risk | Recommendation | Priority |
|------|------|-------|---------|------|----------------|----------|
| frontend/admin-backup.html | 92 | `order-price-filter` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin-backup.html | 92 | `order-price-filter` | min:0 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin-backup.html | 92 | `order-price-filter` | max:99999 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin-backup.html | 92 | `order-price-filter` | step:0.01 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin-backup.html | 92 | `order-price-filter` | type:"number" (currently "select") | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin-backup.html | 506 | `edit-user-email` | maxLength:128 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 506 | `edit-user-email` | pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 512 | `edit-user-password` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 512 | `edit-user-password` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 512 | `edit-user-password` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 512 | `edit-user-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 579 | `create-user-email` | maxLength:128 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 579 | `create-user-email` | pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 595 | `create-user-password` | minLength:8 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 595 | `create-user-password` | maxLength:64 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 595 | `create-user-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 626 | `edit-product-image` | required | Empty value accepted by browser, can bypass client-side check | required | critical |
| frontend/admin-backup.html | 626 | `edit-product-image` | data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | data-max-size:"5MB" (backend enforcement required) | critical |
| frontend/admin-backup.html | 630 | `edit-product-name` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 630 | `edit-product-name` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 630 | `edit-product-name` | pattern:[A-Za-z0-9\s\-_.&'’()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin-backup.html | 635 | `edit-product-price` | required | Empty value accepted by browser, can bypass client-side check | required | critical |
| frontend/admin-backup.html | 639 | `edit-product-stock` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin-backup.html | 639 | `edit-product-stock` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin.html | 2426 | `setting-premium-monthly-price` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin.html | 2426 | `setting-premium-monthly-price` | min:0 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin.html | 2426 | `setting-premium-monthly-price` | step:0.01 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/admin.html | 3765 | `pp-current` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3765 | `pp-current` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3765 | `pp-current` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3765 | `pp-current` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3769 | `pp-new` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3769 | `pp-new` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3769 | `pp-new` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3769 | `pp-new` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3773 | `pp-confirm` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3773 | `pp-confirm` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3773 | `pp-confirm` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 3773 | `pp-confirm` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 4188 | `edit-user-email` | maxLength:128 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin.html | 4188 | `edit-user-email` | pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin.html | 4210 | `edit-user-password` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 4210 | `edit-user-password` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 4210 | `edit-user-password` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 4210 | `edit-user-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 4316 | `create-user-email` | maxLength:128 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin.html | 4316 | `create-user-email` | pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin.html | 4350 | `create-user-password` | minLength:8 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin.html | 4350 | `create-user-password` | maxLength:64 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin.html | 4350 | `create-user-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin.html | 5047 | `sa-user-email` | maxLength:128 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin.html | 5047 | `sa-user-email` | pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/admin.html | 5079 | `sa-user-password` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 5079 | `sa-user-password` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 5079 | `sa-user-password` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/admin.html | 5079 | `sa-user-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 727 | `current-password` | minLength:8 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 727 | `current-password` | maxLength:64 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 727 | `current-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 736 | `new-password` | minLength:8 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 736 | `new-password` | maxLength:64 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 736 | `new-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 745 | `confirm-password` | minLength:8 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 745 | `confirm-password` | maxLength:64 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 745 | `confirm-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/customer-account.html | 796 | `verification-document` | data-max-size:"5MB" (backend enforcement required) | Unspecified | data-max-size:"5MB" (backend enforcement required) | critical |
| frontend/farmer.html | 2487 | `pp-current` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2487 | `pp-current` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2487 | `pp-current` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2487 | `pp-current` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2496 | `pp-new` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2496 | `pp-new` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2496 | `pp-new` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2496 | `pp-new` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2505 | `pp-confirm` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2505 | `pp-confirm` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2505 | `pp-confirm` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2505 | `pp-confirm` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2590 | `verification-document` | data-max-size:"5MB" (backend enforcement required) | Unspecified | data-max-size:"5MB" (backend enforcement required) | critical |
| frontend/farmer.html | 2957 | `product-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2957 | `product-name` | pattern:[A-Za-z0-9\s\-_.&'’()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/farmer.html | 2978 | `product-moq` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 2978 | `product-moq` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 2999 | `available-stock` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 2999 | `available-stock` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3024 | `preorder-max-quantity` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3024 | `preorder-max-quantity` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3066 | `available-image` | required | Empty value accepted by browser, can bypass client-side check | required | critical |
| frontend/farmer.html | 3066 | `available-image` | data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | data-max-size:"5MB" (backend enforcement required) | critical |
| frontend/farmer.html | 3075 | `preorder-image` | required | Empty value accepted by browser, can bypass client-side check | required | critical |
| frontend/farmer.html | 3075 | `preorder-image` | data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | data-max-size:"5MB" (backend enforcement required) | critical |
| frontend/farmer.html | 3171 | `edit-product-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/farmer.html | 3171 | `edit-product-name` | pattern:[A-Za-z0-9\s\-_.&'’()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/farmer.html | 3188 | `edit-moq` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3188 | `edit-moq` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3203 | `edit-stock-quantity` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3203 | `edit-stock-quantity` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3228 | `edit-max-preorder-quantity` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3228 | `edit-max-preorder-quantity` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3268 | `edit-product-image` | required | Empty value accepted by browser, can bypass client-side check | required | critical |
| frontend/farmer.html | 3268 | `edit-product-image` | data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | data-max-size:"5MB" (backend enforcement required) | critical |
| frontend/farmer.html | 3302 | `harvest-lifecycle-quantity` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3302 | `harvest-lifecycle-quantity` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3332 | `harvest-fulfill-quantity` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3332 | `harvest-fulfill-quantity` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/farmer.html | 3504 | `request-product-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/farmer.html | 3504 | `request-product-name` | pattern:[A-Za-z0-9\s\-_.&'’()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/farmer.html | 3768 | `sub-payment-proof` | data-max-size:"5MB" (backend enforcement required) | Unspecified | data-max-size:"5MB" (backend enforcement required) | critical |
| frontend/index.html | 411 | `product-details-quantity` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/index.html | 411 | `product-details-quantity` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/index.html | 496 | `auth-email` | maxLength exceeds DB limit 128 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/index.html | 496 | `auth-email` | type:"email" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/index.html | 501 | `auth-password` | minLength:8 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/index.html | 501 | `auth-password` | maxLength:64 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/index.html | 501 | `auth-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/index.html | 603 | `auth-username` | maxLength:30 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/index.html | 612 | `auth-password-register` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | critical |
| frontend/index.html | 651 | `auth-password-confirm` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | critical |
| frontend/index.html | 975 | `forgot-email` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 975 | `forgot-email` | maxLength exceeds DB limit 128 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 1010 | `forgot-new-password` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 1010 | `forgot-new-password` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 1010 | `forgot-new-password` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 1010 | `forgot-new-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 1020 | `forgot-new-password-confirm` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 1020 | `forgot-new-password-confirm` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 1020 | `forgot-new-password-confirm` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 1020 | `forgot-new-password-confirm` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/index.html | 1207 | `contact-email` | maxLength:128 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/index.html | 1207 | `contact-email` | pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/js/admin.js | 340 | `admin-recover-secret` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/js/admin.js | 340 | `admin-recover-secret` | minLength:8 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/js/admin.js | 340 | `admin-recover-secret` | maxLength:64 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/js/admin.js | 340 | `admin-recover-secret` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/js/admin.js | 10211 | `edit-product-image` | required | Empty value accepted by browser, can bypass client-side check | required | critical |
| frontend/js/admin.js | 10211 | `edit-product-image` | data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | data-max-size:"5MB" (backend enforcement required) | critical |
| frontend/js/admin.js | 10218 | `edit-product-name` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/js/admin.js | 10218 | `edit-product-name` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/js/admin.js | 10218 | `edit-product-name` | pattern:[A-Za-z0-9\s\-_.&'’()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/js/admin.js | 10218 | `edit-product-name` | type:"text" (currently "select") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | critical |
| frontend/js/admin.js | 10226 | `edit-product-price` | required | Empty value accepted by browser, can bypass client-side check | required | critical |
| frontend/js/admin.js | 10231 | `edit-product-stock` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/js/admin.js | 10231 | `edit-product-stock` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | critical |
| frontend/js/admin.js | 11329 | `catalog-edit-suggested-price` | required | Empty value accepted by browser, can bypass client-side check | required | critical |
| frontend/js/farmer.js | 9547 | `account-current-password` | minLength:8 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/js/farmer.js | 9547 | `account-current-password` | maxLength:64 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/js/farmer.js | 9547 | `account-current-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/js/farmer.js | 9552 | `account-new-password` | minLength:8 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/js/farmer.js | 9552 | `account-new-password` | maxLength:64 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/js/farmer.js | 9552 | `account-new-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/js/farmer.js | 9557 | `account-confirm-password` | minLength:8 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/js/farmer.js | 9557 | `account-confirm-password` | maxLength:64 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/js/farmer.js | 9557 | `account-confirm-password` | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/request-product.html | 34 | `request-product-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |
| frontend/request-product.html | 34 | `request-product-name` | pattern:[A-Za-z0-9\s\-_.&'’()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | critical |

### Medium Findings

| File | Line | Field | Missing | Risk | Recommendation | Priority |
|------|------|-------|---------|------|----------------|----------|
| frontend/admin-backup.html | 331 | `new-category-name` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin-backup.html | 331 | `new-category-name` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/admin-backup.html | 332 | `new-category-description` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin-backup.html | 332 | `new-category-description` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/admin-backup.html | 373 | `catalog-category-select` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin-backup.html | 484 | `edit-user-firstname` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin-backup.html | 484 | `edit-user-firstname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin-backup.html | 492 | `edit-user-lastname` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin-backup.html | 492 | `edit-user-lastname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin-backup.html | 521 | `edit-user-phone` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 521 | `edit-user-phone` | maxLength:20 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 521 | `edit-user-phone` | pattern:[0-9\s+\-()]{10,20} | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 521 | `edit-user-phone` | type:"tel" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 525 | `edit-user-zone` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin-backup.html | 537 | `edit-user-street` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 537 | `edit-user-street` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 537 | `edit-user-street` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 538 | `edit-user-address-preview` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 561 | `create-user-firstname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/admin-backup.html | 569 | `create-user-lastname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/admin-backup.html | 589 | `create-user-phone` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 589 | `create-user-phone` | maxLength:20 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 589 | `create-user-phone` | pattern:[0-9\s+\-()]{10,20} | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 589 | `create-user-phone` | type:"tel" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 644 | `edit-product-location` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 644 | `edit-product-location` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 644 | `edit-product-location` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin-backup.html | 670 | `category-edit-name` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin-backup.html | 670 | `category-edit-name` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/admin-backup.html | 674 | `category-edit-description` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin-backup.html | 674 | `category-edit-description` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/admin-backup.html | 698 | `catalog-edit-category` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 1175 | `products-category-filter` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 1282 | `category-search-input` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 1282 | `category-search-input` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/admin.html | 1357 | `catalog-category-filter-bar` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 2431 | `setting-discount-3m` | min:0 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2431 | `setting-discount-3m` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2436 | `setting-discount-6m` | min:0 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2436 | `setting-discount-6m` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2542 | `setting-auth-rate-limit-local` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2547 | `setting-auth-rate-limit-production` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2554 | `setting-otp-rate-limit-local` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2554 | `setting-otp-rate-limit-local` | minLength:6 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2554 | `setting-otp-rate-limit-local` | maxLength:6 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2554 | `setting-otp-rate-limit-local` | pattern:[0-9]{6} | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2554 | `setting-otp-rate-limit-local` | type:"text" (currently "number") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2559 | `setting-otp-rate-limit-production` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2559 | `setting-otp-rate-limit-production` | minLength:6 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2559 | `setting-otp-rate-limit-production` | maxLength:6 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2559 | `setting-otp-rate-limit-production` | pattern:[0-9]{6} | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2559 | `setting-otp-rate-limit-production` | type:"text" (currently "number") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2580 | `setting-otp-mode` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2580 | `setting-otp-mode` | minLength:6 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2580 | `setting-otp-mode` | maxLength:6 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2580 | `setting-otp-mode` | pattern:[0-9]{6} | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2580 | `setting-otp-mode` | type:"text" (currently "select") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2591 | `setting-otp-bypass-code` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2591 | `setting-otp-bypass-code` | minLength:6 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2591 | `setting-otp-bypass-code` | maxLength:6 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2591 | `setting-otp-bypass-code` | pattern:[0-9]{6} | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2629 | `setting-max-products-per-farmer` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2634 | `setting-max-products-per-name-available` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2639 | `setting-max-products-per-name-preorder` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2694 | `new-pay-order` | min:0 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2694 | `new-pay-order` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 2784 | `announcement-title` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2784 | `announcement-title` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 2788 | `announcement-message` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/admin.html | 3379 | `product-approvals-category-filter` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 3731 | `pe-firstname` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3731 | `pe-firstname` | maxLength:40 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3731 | `pe-firstname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3739 | `pe-lastname` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3739 | `pe-lastname` | maxLength:40 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3739 | `pe-lastname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3746 | `pe-phone` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3746 | `pe-phone` | maxLength:20 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3746 | `pe-phone` | type:"tel" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3809 | `rejection-reason-input` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3809 | `rejection-reason-input` | maxLength:500 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 3875 | `unverify-reason` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/admin.html | 3995 | `am-retention-period` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/admin.html | 4155 | `edit-user-firstname` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4155 | `edit-user-firstname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4165 | `edit-user-lastname` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4165 | `edit-user-lastname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4172 | `edit-user-shopname` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4172 | `edit-user-shopname` | pattern:[A-Za-z0-9\s\-_.&'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4225 | `edit-user-phone` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 4225 | `edit-user-phone` | maxLength:20 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 4233 | `edit-user-zone` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 4245 | `edit-user-street` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 4245 | `edit-user-street` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 4245 | `edit-user-street` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 4248 | `edit-user-address-preview` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/admin.html | 4287 | `create-user-firstname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4299 | `create-user-lastname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4332 | `create-user-phone` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 4332 | `create-user-phone` | maxLength:20 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 4341 | `create-user-shopname` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4341 | `create-user-shopname` | pattern:[A-Za-z0-9\s\-_.&'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/admin.html | 4481 | `new-category-name` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 4481 | `new-category-name` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/admin.html | 4485 | `new-category-description` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 4485 | `new-category-description` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/admin.html | 4512 | `catalog-category-select` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 4713 | `reject-subscription-reason` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 4740 | `expire-subscription-reason` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/admin.html | 4766 | `rejection-reason` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/admin.html | 5028 | `sa-user-firstname` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 5028 | `sa-user-firstname` | maxLength:40 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 5028 | `sa-user-firstname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 5036 | `sa-user-lastname` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 5036 | `sa-user-lastname` | maxLength:40 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 5036 | `sa-user-lastname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 5056 | `sa-user-phone` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/admin.html | 5056 | `sa-user-phone` | maxLength:20 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/checkout.html | 654 | `checkout-firstname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/checkout.html | 662 | `checkout-lastname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/checkout.html | 671 | `checkout-phone` | maxLength:20 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/checkout.html | 671 | `checkout-phone` | pattern:[0-9\s+\-()]{10,20} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/checkout.html | 679 | `special-instructions` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/checkout.html | 825 | `floating-address-street` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/checkout.html | 825 | `floating-address-street` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/checkout.html | 832 | `floating-address-full` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/customer-account.html | 655 | `edit-firstname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/customer-account.html | 663 | `edit-lastname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/customer-account.html | 673 | `edit-phone` | maxLength:20 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/customer-account.html | 673 | `edit-phone` | pattern:[0-9\s+\-()]{10,20} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/customer-account.html | 680 | `edit-zone` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/customer-account.html | 696 | `edit-street` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/customer-account.html | 696 | `edit-street` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/customer-account.html | 696 | `edit-street` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/customer-account.html | 698 | `edit-address-preview` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/customer-account.html | 805 | `verification-notes` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/customer-account.html | 1018 | `support-ticket-subject` | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/farmer.html | 1692 | `available-category-filter` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/farmer.html | 1730 | `preorder-category-filter` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/farmer.html | 1768 | `approval-category-filter` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/farmer.html | 2111 | `shop-name-input` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/farmer.html | 2111 | `shop-name-input` | pattern:[A-Za-z0-9\s\-_.&'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/farmer.html | 2116 | `shop-location-input` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2116 | `shop-location-input` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2116 | `shop-location-input` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2116 | `shop-location-input` | type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2449 | `pe-firstname` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/farmer.html | 2449 | `pe-firstname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/farmer.html | 2457 | `pe-lastname` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/farmer.html | 2457 | `pe-lastname` | pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/farmer.html | 2467 | `pe-phone` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2467 | `pe-phone` | maxLength:20 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2467 | `pe-phone` | type:"tel" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2599 | `verification-notes` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2842 | `shop-location-zone` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/farmer.html | 2868 | `shop-location-street` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2868 | `shop-location-street` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2868 | `shop-location-street` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2872 | `shop-location-full` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2872 | `shop-location-full` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2872 | `shop-location-full` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2872 | `shop-location-full` | type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 2947 | `product-category` | type:"select" (currently "text") | Unspecified | type:"select" (currently "text") | medium |
| frontend/farmer.html | 3029 | `preorder-harvest-date` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/farmer.html | 3048 | `product-location-display` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3048 | `product-location-display` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3048 | `product-location-display` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3048 | `product-location-display` | type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3053 | `product-location` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3053 | `product-location` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3053 | `product-location` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3053 | `product-location` | type:"text" (currently "hidden") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3161 | `edit-product-category` | type:"select" (currently "text") | Unspecified | type:"select" (currently "text") | medium |
| frontend/farmer.html | 3208 | `edit-expiry-date` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/farmer.html | 3251 | `edit-product-location-display` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3251 | `edit-product-location-display` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3251 | `edit-product-location-display` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3251 | `edit-product-location-display` | type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3391 | `update-harvest-reason` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3412 | `product-location-zone` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/farmer.html | 3438 | `product-location-street` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3438 | `product-location-street` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3438 | `product-location-street` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3442 | `product-location-full` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3442 | `product-location-full` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3442 | `product-location-full` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3442 | `product-location-full` | type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3597 | `reschedule-reason-input` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3597 | `reschedule-reason-input` | maxLength:500 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/farmer.html | 3663 | `support-ticket-subject` | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/index.html | 572 | `register-otp` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/index.html | 572 | `register-otp` | minLength:6 | Empty value accepted by browser, can bypass client-side check | minLength:6 | medium |
| frontend/index.html | 702 | `auth-phone` | maxLength:20 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/index.html | 725 | `auth-address` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/index.html | 993 | `forgot-otp` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/index.html | 993 | `forgot-otp` | minLength:6 | Empty value accepted by browser, can bypass client-side check | minLength:6 | medium |
| frontend/index.html | 1057 | `floating-address-firstname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/index.html | 1071 | `floating-address-lastname` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | medium |
| frontend/index.html | 1080 | `floating-address-phone` | maxLength:20 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/index.html | 1080 | `floating-address-phone` | pattern:[0-9\s+\-()]{10,20} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/index.html | 1125 | `floating-address-street` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/index.html | 1125 | `floating-address-street` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/index.html | 1132 | `floating-address-full` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/index.html | 1212 | `contact-subject` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/js/admin.js | 8882 | `category-request-name` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/js/admin.js | 8882 | `category-request-name` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/js/admin.js | 8884 | `category-request-category` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/js/admin.js | 8886 | `` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/js/admin.js | 8888 | `category-request-review-notes` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/js/admin.js | 8888 | `category-request-review-notes` | type:"select" (currently "textarea") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "textarea") | medium |
| frontend/js/admin.js | 10238 | `edit-product-location` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/js/admin.js | 10238 | `edit-product-location` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/js/admin.js | 10238 | `edit-product-location` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/js/admin.js | 11188 | `category-edit-name` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/js/admin.js | 11188 | `category-edit-name` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/js/admin.js | 11196 | `category-edit-description` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/js/admin.js | 11196 | `category-edit-description` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | medium |
| frontend/js/admin.js | 11318 | `catalog-edit-category` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/js/app.js | 7313 | `` | min:0 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/js/app.js | 7313 | `` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/js/app.js | 7909 | `` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/js/checkout.js | 684 | `` | min:0 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/js/checkout.js | 684 | `` | step:1 | Out-of-range numeric values accepted | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/js/farmer.js | 9501 | `shop-name-input` | required | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/js/farmer.js | 9501 | `shop-name-input` | pattern:[A-Za-z0-9\s\-_.&'’]+ | Empty value accepted by browser, can bypass client-side check | Add pattern regex and backend regex validation | medium |
| frontend/js/farmer.js | 9505 | `shop-zone-input` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/js/farmer.js | 9517 | `shop-street-input` | required | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/js/farmer.js | 9517 | `shop-street-input` | maxLength:100 | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/js/farmer.js | 9517 | `shop-street-input` | pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check | Add maxlength matching DB column | medium |
| frontend/js/farmer.js | 9518 | `shop-address-preview` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/js/farmer.js | 9523 | `shop-description-input` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/orders.html | 591 | `order-cancel-reason-input` | required | Empty value accepted by browser, can bypass client-side check | required | medium |
| frontend/product.html | 68 | `review-rating` | required | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/product.html | 68 | `review-rating` | min:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/product.html | 68 | `review-rating` | max:5 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/product.html | 68 | `review-rating` | step:1 | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/product.html | 68 | `review-rating` | type:"number" (currently "hidden") | Empty value accepted by browser, can bypass client-side check | Add min/max/step attributes and backend numeric clamps | medium |
| frontend/product.html | 73 | `review-comment` | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | medium |
| frontend/wishlist.html | 617 | `wishlist-filter-category` | required | Empty value accepted by browser, can bypass client-side check | required | medium |

### Low Findings

| File | Line | Field | Missing | Risk | Recommendation | Priority |
|------|------|-------|---------|------|----------------|----------|
| frontend/admin-backup.html | 83 | `order-status-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 83 | `order-status-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 98 | `order-sort-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 98 | `order-sort-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 109 | `admin-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 109 | `admin-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 296 | `logs-actor-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 296 | `logs-actor-filter` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 297 | `logs-action-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 297 | `logs-action-filter` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 298 | `logs-entity-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 298 | `logs-entity-filter` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 374 | `new-catalog-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 438 | `chat-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 488 | `edit-user-middlename` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | low |
| frontend/admin-backup.html | 497 | `edit-user-fullname` | maxLength:130 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 497 | `edit-user-fullname` | pattern:[A-Za-z\s\-.'’]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 502 | `edit-user-username` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 565 | `create-user-middlename` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | low |
| frontend/admin-backup.html | 575 | `create-user-username` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin-backup.html | 694 | `catalog-edit-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 928 | `order-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 928 | `order-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1051 | `users-verification-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1051 | `users-verification-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1061 | `users-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1061 | `users-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1181 | `products-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1181 | `products-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1191 | `products-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1191 | `products-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1365 | `catalog-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1365 | `catalog-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1468 | `farmers-verification-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1468 | `farmers-verification-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1478 | `farmers-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1478 | `farmers-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1727 | `logs-action-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1727 | `logs-action-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1743 | `logs-entity-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1743 | `logs-entity-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1754 | `logs-actor-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1754 | `logs-actor-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1953 | `am-search-user` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1953 | `am-search-user` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1957 | `am-role-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1957 | `am-role-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1967 | `am-action-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 1967 | `am-action-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2021 | `am-status-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2021 | `am-status-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2030 | `am-session-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2030 | `am-session-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2170 | `admin-verification-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2170 | `admin-verification-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2180 | `admin-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2180 | `admin-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2285 | `all-users-role-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2285 | `all-users-role-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2295 | `all-users-verification-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2295 | `all-users-verification-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2305 | `all-users-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2305 | `all-users-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2679 | `new-pay-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 2683 | `new-pay-number` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3139 | `support-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3139 | `support-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3199 | `chat-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3277 | `cat-req-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3277 | `cat-req-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3387 | `product-approval-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3387 | `product-approval-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3501 | `verification-requests-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3501 | `verification-requests-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3612 | `subscriptions-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3612 | `subscriptions-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3735 | `pe-middlename` | maxLength:40 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 3735 | `pe-middlename` | pattern:[A-Za-z\s\-.'’]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 4160 | `edit-user-middlename` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | low |
| frontend/admin.html | 4181 | `edit-user-username` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 4292 | `create-user-middlename` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | low |
| frontend/admin.html | 4309 | `create-user-username` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 4508 | `new-catalog-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 5032 | `sa-user-middlename` | maxLength:40 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 5032 | `sa-user-middlename` | pattern:[A-Za-z\s\-.'’]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/admin.html | 5043 | `sa-user-username` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/chat.html | 229 | `admin-chat-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/chat.html | 229 | `admin-chat-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/chat.html | 260 | `chat-input` | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/checkout.html | 658 | `checkout-middlename` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | low |
| frontend/customer-account.html | 659 | `edit-middlename` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | low |
| frontend/customer-account.html | 941 | `support-chat-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/customer-account.html | 941 | `support-chat-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/customer-account.html | 986 | `support-chat-input` | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1698 | `available-status-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1698 | `available-status-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1709 | `available-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1709 | `available-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1736 | `preorder-status-filter` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1736 | `preorder-status-filter` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1747 | `preorder-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1747 | `preorder-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1776 | `approval-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1776 | `approval-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1986 | `orders-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 1986 | `orders-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 2033 | `reviews-filter-rating` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 2033 | `reviews-filter-rating` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 2160 | `admin-chat-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 2160 | `admin-chat-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 2190 | `chat-input` | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 2270 | `support-chat-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 2270 | `support-chat-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 2315 | `support-chat-input` | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmer.html | 2453 | `pe-middlename` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | low |
| frontend/farmer.html | 2968 | `product-unit` | required | Empty value accepted by browser, can bypass client-side check | required | low |
| frontend/farmer.html | 2968 | `product-unit` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | low |
| frontend/farmer.html | 3179 | `edit-product-unit` | required | Empty value accepted by browser, can bypass client-side check | required | low |
| frontend/farmer.html | 3179 | `edit-product-unit` | type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | type:"select" (currently "text") | low |
| frontend/farmers.html | 47 | `farmer-search` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/farmers.html | 47 | `farmer-search` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/index.html | 290 | `global-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/index.html | 290 | `global-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/index.html | 1064 | `floating-address-middlename` | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | Add pattern regex and backend regex validation | low |
| frontend/index.html | 1203 | `contact-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/js/admin.js | 3792 | `` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/js/admin.js | 11311 | `catalog-edit-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/js/admin.js | 11324 | `catalog-edit-unit` | required | Empty value accepted by browser, can bypass client-side check | required | low |
| frontend/js/farmer.js | 9483 | `account-first-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/js/farmer.js | 9487 | `account-middle-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/js/farmer.js | 9491 | `account-last-name` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/wishlist.html | 623 | `wishlist-filter-type` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/wishlist.html | 623 | `wishlist-filter-type` | type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/wishlist.html | 633 | `wishlist-search-input` | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |
| frontend/wishlist.html | 633 | `wishlist-search-input` | type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add maxlength matching DB column | low |

## Complete Field Inventory

Legend: `FE` = front-end HTML5 attribute present; `BE` = backend validation heuristic match; `DB` = database column/constraints matched.  

### Module: Admin

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/admin-backup.html | 83 | `order-status-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 92 | `order-price-filter` | select |  | required; min:0; max:99999; step:0.01; type:"number" (currently "select") | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin-backup.html | 98 | `order-sort-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 109 | `admin-search-input` | text | placeholder=Search… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 177 | `` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin-backup.html | 296 | `logs-actor-filter` | text | placeholder=Admin ID (optional) | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 297 | `logs-action-filter` | text | placeholder=Action (optional) | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 298 | `logs-entity-filter` | text | placeholder=Entity (users / products / orders) | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 331 | `new-category-name` | text | placeholder=New category name | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin-backup.html | 332 | `new-category-description` | text | placeholder=Description (optional) | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin-backup.html | 373 | `catalog-category-select` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin-backup.html | 374 | `new-catalog-name` | text | placeholder=Product name | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 484 | `edit-user-firstname` | text | placeholder=First name, maxlength=40 | required; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 488 | `edit-user-middlename` | text | placeholder=Middle name, maxlength=40 | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 492 | `edit-user-lastname` | text | placeholder=Last name, maxlength=40 | required; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 497 | `edit-user-fullname` | text | placeholder=Full name | maxLength:130; pattern:[A-Za-z\s\-.'’]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 502 | `edit-user-username` | text | placeholder=Username, required | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 506 | `edit-user-email` | email | placeholder=Email, required | maxLength:128; pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 512 | `edit-user-password` | password | placeholder=Set new password | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 521 | `edit-user-phone` | text | placeholder=Phone number | required; maxLength:20; pattern:[0-9\s+\-()]{10,20}; type:"tel" (currently "text") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 525 | `edit-user-zone` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin-backup.html | 528 | `edit-user-province` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin-backup.html | 531 | `edit-user-city` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin-backup.html | 534 | `edit-user-barangay` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin-backup.html | 537 | `edit-user-street` | text | placeholder=Street / Building / House No. | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 538 | `edit-user-address-preview` | textarea | placeholder=Address preview | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 561 | `create-user-firstname` | text | placeholder=First name, maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 565 | `create-user-middlename` | text | placeholder=Optional, maxlength=40 | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 569 | `create-user-lastname` | text | placeholder=Last name, maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 575 | `create-user-username` | text | placeholder=Username, required | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 579 | `create-user-email` | email | placeholder=Email, required | maxLength:128; pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 585 | `create-user-role` | select | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin-backup.html | 589 | `create-user-phone` | text | placeholder=Phone number | required; maxLength:20; pattern:[0-9\s+\-()]{10,20}; type:"tel" (currently "text") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 595 | `create-user-password` | password | placeholder=Minimum 8 characters, required | minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 626 | `edit-product-image` | file | accept=image/* | required; data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin-backup.html | 630 | `edit-product-name` | text | maxlength=30 | required; maxLength:100; pattern:[A-Za-z0-9\s\-_.&'’()]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 635 | `edit-product-price` | number | min=0, max=99999, step=0.01 | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin-backup.html | 639 | `edit-product-stock` | number | min=0, max=99999 | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin-backup.html | 644 | `edit-product-location` | text |  | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin-backup.html | 648 | `edit-product-description` | textarea | maxlength=500 | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin-backup.html | 670 | `category-edit-name` | text | placeholder=Category name | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin-backup.html | 674 | `category-edit-description` | text | placeholder=Description | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin-backup.html | 694 | `catalog-edit-name` | text | placeholder=Product name, maxlength=30 | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin-backup.html | 698 | `catalog-edit-category` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 673 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 715 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 766 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 814 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 928 | `order-search-input` | text | placeholder=Order ID, product name, or customer… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1042 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 1051 | `users-verification-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1061 | `users-search-input` | text | placeholder=Name, username or email… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1166 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 1175 | `products-category-filter` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 1181 | `products-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1191 | `products-search-input` | text | placeholder=Product name… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1271 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 1282 | `category-search-input` | text | placeholder=Category name… | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 1348 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 1357 | `catalog-category-filter-bar` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 1365 | `catalog-search-input` | text | placeholder=Product name… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1459 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 1468 | `farmers-verification-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1478 | `farmers-search-input` | text | placeholder=Name, username or email… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1719 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 1727 | `logs-action-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1743 | `logs-entity-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1754 | `logs-actor-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1760 | `logs-date-from` | date |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 1764 | `logs-date-to` | date |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 1953 | `am-search-user` | text | placeholder=Search anything... | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1957 | `am-role-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 1967 | `am-action-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2015 | `am-date-from` | date | placeholder=From, min=2026-01-01 | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2016 | `am-date-to` | date | placeholder=To, min=2026-01-01 | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2021 | `am-status-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2030 | `am-session-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2047 | `am-auto-refresh` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2082 | `am-entries-per-page` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2162 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2170 | `admin-verification-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2180 | `admin-search-input` | text | placeholder=Name, username, or email… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2277 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2285 | `all-users-role-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2295 | `all-users-verification-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2305 | `all-users-search-input` | text | placeholder=Name, username, or email… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2426 | `setting-premium-monthly-price` | number | max=99999 | required; min:0; step:0.01 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 2431 | `setting-discount-3m` | number | max=99999 | min:0; step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 2436 | `setting-discount-6m` | number | max=99999 | min:0; step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 2473 | `setting-use-default-delivery-address` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2517 | `setting-recaptcha-mode` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2542 | `setting-auth-rate-limit-local` | number | min=1, max=1000, placeholder=100 | step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 2547 | `setting-auth-rate-limit-production` | number | min=1, max=1000, placeholder=20 | step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 2554 | `setting-otp-rate-limit-local` | number | min=1, max=1000, placeholder=50 | required; minLength:6; maxLength:6; pattern:[0-9]{6}; type:"text" (currently "number") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 2559 | `setting-otp-rate-limit-production` | number | min=1, max=1000, placeholder=10 | required; minLength:6; maxLength:6; pattern:[0-9]{6}; type:"text" (currently "number") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 2580 | `setting-otp-mode` | select |  | required; minLength:6; maxLength:6; pattern:[0-9]{6}; type:"text" (currently "select") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 2591 | `setting-otp-bypass-code` | text | placeholder=789878 | required; minLength:6; maxLength:6; pattern:[0-9]{6} | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 2629 | `setting-max-products-per-farmer` | number | min=1, max=1000, placeholder=10 | step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 2634 | `setting-max-products-per-name-available` | number | min=1, max=100, placeholder=1 | step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 2639 | `setting-max-products-per-name-preorder` | number | min=1, max=100, placeholder=1 | step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 2679 | `new-pay-name` | text | placeholder=e.g. AgriCatch GCash 2 | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2683 | `new-pay-number` | text | placeholder=0917... | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2687 | `new-pay-type` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2694 | `new-pay-order` | number | placeholder=0 | min:0; step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 2784 | `announcement-title` | text | placeholder=e.g. Scheduled Maintenance Tonight | required; maxLength:100 | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add required indicator and client error message | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2788 | `announcement-message` | textarea | placeholder=Write the announcement body that users will see in their notifications... | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 2816 | `audience-all` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2826 | `audience-customer` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2836 | `audience-farmer` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 2846 | `audience-admin` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 3139 | `support-search-input` | text | placeholder=Search conversations… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 3266 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 3277 | `cat-req-search-input` | text | placeholder=Product name or farmer… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 3370 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 3379 | `product-approvals-category-filter` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 3387 | `product-approval-search-input` | text | placeholder=Product name or farmer… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 3490 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 3501 | `verification-requests-search-input` | text | placeholder=Farmer or shop name… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 3601 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 3612 | `subscriptions-search-input` | text | placeholder=Farmer or shop name… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 3735 | `pe-middlename` | text | placeholder=Optional | maxLength:40; pattern:[A-Za-z\s\-.'’]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 3739 | `pe-lastname` | text |  | required; maxLength:40; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 3746 | `pe-phone` | text | placeholder=9XX XXX XXXX, maxlength=12, pattern=9[0-9]{2} [0-9]{3} [0-9]{4} | required; maxLength:20; type:"tel" (currently "text") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add required indicator and client error message \| Add title attribute describing pattern | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 3769 | `pp-new` | password |  | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 3773 | `pp-confirm` | password |  | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 3809 | `rejection-reason-input` | textarea |  | required; maxLength:500 | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | Add required indicator and client error message | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 3875 | `unverify-reason` | textarea | placeholder=Please explain why this farmer is being unverified..., required | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 3989 | `am-enable-monitoring` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 3995 | `am-retention-period` | number | min=7, max=365 | step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/admin.html | 4000 | `am-max-records` | number | min=1000, step=1000 | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4015 | `am-auto-delete` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4022 | `am-enable-customer` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4026 | `am-enable-farmer` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4030 | `am-enable-admin` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4155 | `edit-user-firstname` | text | placeholder=First name, maxlength=40 | required; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4160 | `edit-user-middlename` | text | placeholder=Middle name, maxlength=40 | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4165 | `edit-user-lastname` | text | placeholder=Last name, maxlength=40 | required; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4172 | `edit-user-shopname` | text | placeholder=Shop name (for farmers), maxlength=40 | required; pattern:[A-Za-z0-9\s\-_.&'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4181 | `edit-user-username` | text | placeholder=Username, required | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 4188 | `edit-user-email` | email | placeholder=Email, required | maxLength:128; pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4195 | `edit-user-role` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4210 | `edit-user-password` | password | placeholder=Set new password | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4225 | `edit-user-phone` | tel | placeholder=929 819 6629, maxlength=12, pattern=[0-9\s]{10,12} | required; maxLength:20 | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add required indicator and client error message \| Add title attribute describing pattern | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 4233 | `edit-user-zone` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 4236 | `edit-user-province` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4239 | `edit-user-city` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4242 | `edit-user-barangay` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4245 | `edit-user-street` | text | placeholder=Street / Building / House No. | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4248 | `edit-user-address-preview` | textarea | placeholder=Address preview | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 4287 | `create-user-firstname` | text | placeholder=First name, maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4292 | `create-user-middlename` | text | placeholder=Optional, maxlength=40 | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4299 | `create-user-lastname` | text | placeholder=Last name, maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4309 | `create-user-username` | text | placeholder=Username, required | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 4316 | `create-user-email` | email | placeholder=Email, required | maxLength:128; pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4326 | `create-user-role` | select | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4332 | `create-user-phone` | tel | placeholder=929 819 6629, maxlength=12, pattern=[0-9\s]{10,12} | required; maxLength:20 | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add required indicator and client error message \| Add title attribute describing pattern | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 4341 | `create-user-shopname` | text | placeholder=Shop name (for farmers), maxlength=40 | required; pattern:[A-Za-z0-9\s\-_.&'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4350 | `create-user-password` | password | placeholder=Minimum 6 characters, required | minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 4481 | `new-category-name` | text | placeholder=e.g. Vegetables | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 4485 | `new-category-description` | text | placeholder=Brief description, maxlength=200 | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 4508 | `new-catalog-name` | text | placeholder=e.g. Sweet Corn | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 4512 | `catalog-category-select` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 4713 | `reject-subscription-reason` | textarea | maxlength=500, placeholder=Please provide a reason for rejecting this subscription... | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 4740 | `expire-subscription-reason` | textarea | maxlength=500, placeholder=Please provide a reason for expiring this subscription... | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/admin.html | 4766 | `rejection-reason` | textarea | placeholder=Please explain why this product is being rejected..., required | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | validation: Not detected | not mapped |
| frontend/admin.html | 5028 | `sa-user-firstname` | text | placeholder=First name | required; maxLength:40; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 5032 | `sa-user-middlename` | text | placeholder=Middle name | maxLength:40; pattern:[A-Za-z\s\-.'’]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 5036 | `sa-user-lastname` | text | placeholder=Last name | required; maxLength:40; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 5043 | `sa-user-username` | text | placeholder=Username, required | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 5047 | `sa-user-email` | email | placeholder=Email address, required | maxLength:128; pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 5056 | `sa-user-phone` | tel | placeholder=929 819 6629, maxlength=12, pattern=[0-9\s]{10,12} | required; maxLength:20 | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add required indicator and client error message \| Add title attribute describing pattern | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 5062 | `sa-user-role` | select | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 5079 | `sa-user-password` | password | placeholder=Min 8 characters | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/admin.html | 5129 | `admin-ticket-message-input` | text | maxlength=500, placeholder=Type a message... | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 5142 | `admin-ticket-status-select` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 5196 | `ticket-detail-status-select` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/admin.js | 340 | `admin-recover-secret` | password | placeholder=Admin secret | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/js/admin.js | 3350 | `` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/admin.js | 3775 | `setting-delivery_fee` | number | min=0, max=99999, step=1 | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/admin.js | 3792 | `` | text |  | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/js/admin.js | 4452 | `` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/admin.js | 8882 | `category-request-name` | text |  | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/admin.js | 8884 | `category-request-category` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/admin.js | 8886 | `` | textarea | disabled, maxlength=250 | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/js/admin.js | 8888 | `category-request-review-notes` | textarea | placeholder=Optional review notes (max 250 characters), maxlength=250 | required; type:"select" (currently "textarea") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/admin.js | 9609 | `order-status-select-${order.id}` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/admin.js | 10199 | `edit-product-id` | hidden |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/admin.js | 10211 | `edit-product-image` | file | accept=image/* | required; data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/admin.js | 10218 | `edit-product-name` | select |  | required; maxLength:100; pattern:[A-Za-z0-9\s\-_.&'’()]+; type:"text" (currently "select") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/js/admin.js | 10226 | `edit-product-price` | number | min=0, max=99999, step=0.01 | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/admin.js | 10231 | `edit-product-stock` | number | min=0, max=99999 | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/js/admin.js | 10238 | `edit-product-location` | text |  | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/js/admin.js | 10247 | `edit-product-description` | textarea | maxlength=500 | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/admin.js | 11188 | `category-edit-name` | text | placeholder=Category name | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/admin.js | 11196 | `category-edit-description` | text | placeholder=Brief description, maxlength=200 | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/admin.js | 11311 | `catalog-edit-name` | text | placeholder=Product name | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/js/admin.js | 11318 | `catalog-edit-category` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/admin.js | 11324 | `catalog-edit-unit` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/admin.js | 11329 | `catalog-edit-suggested-price` | number | placeholder=e.g. 75, min=0, max=99999, step=0.01 | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |

### Module: Admin (chat-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/admin-backup.html | 438 | `chat-input` | text | placeholder=Type a message…, required | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/admin.html | 3199 | `chat-input` | text | placeholder=Type a message…, required | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |

### Module: Admin (edit-product-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/admin-backup.html | 620 | `edit-product-id` | hidden |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |

### Module: Admin (edit-user-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/admin-backup.html | 480 | `edit-user-id` | hidden |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/admin.html | 4150 | `edit-user-id` | hidden |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |

### Module: Admin (profile-edit-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/admin.html | 3731 | `pe-firstname` | text |  | required; maxLength:40; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Admin (profile-password-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/admin.html | 3765 | `pp-current` | password |  | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Admin (sa-user-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/admin.html | 5023 | `sa-user-id` | hidden |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |

### Module: Customer

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/customer-account.html | 659 | `edit-middlename` | text | maxlength=40, placeholder=Optional | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/customer-account.html | 663 | `edit-lastname` | text | maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/customer-account.html | 673 | `edit-phone` | tel | maxlength=12, placeholder=9XX XXX XXXX, required | maxLength:20; pattern:[0-9\s+\-()]{10,20} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/customer-account.html | 680 | `edit-zone` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/customer-account.html | 684 | `edit-province` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/customer-account.html | 688 | `edit-city` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/customer-account.html | 692 | `edit-barangay` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/customer-account.html | 696 | `edit-street` | text | placeholder=Enter street, building, or house number | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/customer-account.html | 698 | `edit-address-preview` | textarea | placeholder=Formatted address will appear here | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/customer-account.html | 736 | `new-password` | password | required | minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/customer-account.html | 745 | `confirm-password` | password | required | minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/customer-account.html | 805 | `verification-notes` | textarea | placeholder=Any additional information... | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/customer-account.html | 941 | `support-chat-search-input` | text | placeholder=Search tickets… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/customer-account.html | 1023 | `support-ticket-description` | textarea | maxlength=500, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/checkout.js | 684 | `` | number | min=${moq}, max=${maxStock} | min:0; step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |

### Module: Customer (change-password-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/customer-account.html | 727 | `current-password` | password | required | minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Customer (create-support-ticket-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/customer-account.html | 1018 | `support-ticket-subject` | text | maxlength=200, required | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |

### Module: Customer (edit-profile-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/customer-account.html | 655 | `edit-firstname` | text | maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Customer (support-chat-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/customer-account.html | 986 | `support-chat-input` | text | placeholder=Type a message…, maxlength=500, required | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |

### Module: Customer (verification-request-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/customer-account.html | 796 | `verification-document` | file | accept=image/jpeg,image/png | data-max-size:"5MB" (backend enforcement required) |  | - | Add missing validations | partial | not found | not mapped |

### Module: Farmer

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/farmer.html | 1464 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 1526 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 1683 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 1692 | `available-category-filter` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 1698 | `available-status-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 1709 | `available-search-input` | text | placeholder=Product name... | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 1721 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 1730 | `preorder-category-filter` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 1736 | `preorder-status-filter` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 1747 | `preorder-search-input` | text | placeholder=Product name... | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 1759 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 1768 | `approval-category-filter` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 1776 | `approval-search-input` | text | placeholder=Product name... | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 1986 | `orders-search-input` | text | placeholder=Order ID, product name, or customer... | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 2033 | `reviews-filter-rating` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 2043 | `reviews-sort` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 2111 | `shop-name-input` | text | maxlength=40, placeholder=My Farm Shop | required; pattern:[A-Za-z0-9\s\-_.&'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 2116 | `shop-location-input` | textarea | placeholder=No address set — click Set Location to change | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+; type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 2124 | `shop-description-input` | textarea | maxlength=500, placeholder=Tell customers about your farm and what you grow. | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 2160 | `admin-chat-search-input` | text | placeholder=Search conversations... | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 2270 | `support-chat-search-input` | text | placeholder=Search tickets... | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 2453 | `pe-middlename` | text | placeholder=Optional, maxlength=40 | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 2457 | `pe-lastname` | text | maxlength=40 | required; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 2467 | `pe-phone` | text | placeholder=9XX XXX XXXX, maxlength=12, pattern=9[0-9]{2} [0-9]{3} [0-9]{4} | required; maxLength:20; type:"tel" (currently "text") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add required indicator and client error message \| Add title attribute describing pattern | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 2487 | `pp-current` | password |  | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 2496 | `pp-new` | password |  | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 2505 | `pp-confirm` | password |  | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 2599 | `verification-notes` | textarea | placeholder=Any additional information... | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 2842 | `shop-location-zone` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 2849 | `shop-location-province` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 2855 | `shop-location-city` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 2862 | `shop-location-barangay` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 2868 | `shop-location-street` | text | placeholder=Enter street, building, or house number | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 2872 | `shop-location-full` | textarea | placeholder=Formatted address will appear here | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+; type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 2936 | `add-product-type` | hidden |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 2947 | `product-category` | text | placeholder=Select category, required | type:"select" (currently "text") |  | - | Add missing validations | partial | validation: Present (heuristic) | not mapped |
| frontend/farmer.html | 2957 | `product-name` | text | placeholder=Choose a category first, disabled, required, maxlength=30 | maxLength:100; pattern:[A-Za-z0-9\s\-_.&'’()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | validation: Present (heuristic) | products.name: VARCHAR(100) NOT NULL; notNull=true; unique=false |
| frontend/farmer.html | 2968 | `product-unit` | text |  | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | validation: Not detected | products.unit: VARCHAR(20) DEFAULT 'kg', -- kg, pieces, boxes, etc.; notNull=false; unique=false |
| frontend/farmer.html | 2972 | `product-price` | number | step=0.01, min=0, max=99999, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | validation: Not detected | products.price: DECIMAL(10, 2) NOT NULL; notNull=true; unique=false |
| frontend/farmer.html | 2978 | `product-moq` | number | min=1, max=99999, placeholder=Leave empty for no minimum | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/farmer.html | 2999 | `available-stock` | number | min=0, max=99999 | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/farmer.html | 3004 | `available-expiry` | date | min= | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3009 | `available-description` | textarea | maxlength=500, placeholder=Describe the harvested product customers will receive immediately. | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3024 | `preorder-max-quantity` | number | min=1, max=99999 | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/farmer.html | 3029 | `preorder-harvest-date` | date | min= | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 3034 | `preorder-description` | textarea | maxlength=500, placeholder=Describe the expected harvest or important information before harvesting. | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3048 | `product-location-display` | textarea | placeholder=Auto-filled from shop address — click Set Location to change | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+; type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 3053 | `product-location` | hidden |  | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+; type:"text" (currently "hidden") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | validation: Not detected | products.location: VARCHAR(100), -- farm location; notNull=false; unique=false |
| frontend/farmer.html | 3066 | `available-image` | file | accept=image/* | required; data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 3075 | `preorder-image` | file | accept=image/* | required; data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 3161 | `edit-product-category` | text | placeholder=Select category, required | type:"select" (currently "text") |  | - | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 3171 | `edit-product-name` | text | placeholder=Product name, required, maxlength=30 | maxLength:100; pattern:[A-Za-z0-9\s\-_.&'’()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 3179 | `edit-product-unit` | text |  | required; type:"select" (currently "text") | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 3183 | `edit-price` | number | min=0, max=99999, step=0.01, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3188 | `edit-moq` | number | min=1, max=99999, placeholder=Leave empty for no minimum | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/farmer.html | 3203 | `edit-stock-quantity` | number | min=0, max=99999 | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/farmer.html | 3208 | `edit-expiry-date` | date | min= | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 3213 | `edit-available-description` | textarea | maxlength=500, placeholder=Describe the harvested product customers will receive immediately. | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3228 | `edit-max-preorder-quantity` | number | min=1, max=99999 | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/farmer.html | 3233 | `edit-preorder-availability-date` | date | min= | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3238 | `edit-preorder-description` | textarea | maxlength=500, placeholder=Describe the expected harvest or important information before harvesting. | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3251 | `edit-product-location-display` | textarea | placeholder=No address set — click Set Location to change | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+; type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 3268 | `edit-product-image` | file | accept=image/* | required; data-max-size:"5MB" (backend enforcement required) | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 3302 | `harvest-lifecycle-quantity` | number | min=1, max=99999, placeholder=Enter harvested quantity | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/farmer.html | 3332 | `harvest-fulfill-quantity` | number | min=1, max=99999, placeholder=Enter harvested quantity | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/farmer.html | 3386 | `update-harvest-date` | date | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3391 | `update-harvest-reason` | textarea | required, placeholder=Please explain why you need to update the harvest date | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 3412 | `product-location-zone` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/farmer.html | 3419 | `product-location-province` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3425 | `product-location-city` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3432 | `product-location-barangay` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3438 | `product-location-street` | text | placeholder=Enter street, building, or house number | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 3442 | `product-location-full` | textarea | placeholder=Formatted address will appear here | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+; type:"text" (currently "textarea") | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/farmer.html | 3509 | `request-product-notes` | textarea | maxlength=500, placeholder=e.g., local name, usual unit of sale, quality details... | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3592 | `delivery-date-input` | date | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3597 | `reschedule-reason-input` | textarea | maxlength=300, placeholder=Explain why the delivery date needs to be changed... | required; maxLength:500 | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add required indicator and client error message | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/farmer.html | 3668 | `support-ticket-description` | textarea | maxlength=500, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3751 | `sub-payment-account` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/farmer.html | 3768 | `sub-payment-proof` | file | accept=image/*, required | data-max-size:"5MB" (backend enforcement required) |  | - | Add missing validations | partial | not found | not mapped |
| frontend/farmers.html | 47 | `farmer-search` | text | placeholder=Search farmers... | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | validation: Present (heuristic) | not mapped |
| frontend/js/farmer.js | 9483 | `account-first-name` | text | placeholder=First name, maxlength=40 | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | validation: Not detected | users.first_name: VARCHAR(40); notNull=false; unique=false |
| frontend/js/farmer.js | 9487 | `account-middle-name` | text | placeholder=Optional, maxlength=40 | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | validation: Not detected | users.middle_name: VARCHAR(40); notNull=false; unique=false |
| frontend/js/farmer.js | 9491 | `account-last-name` | text | placeholder=Last name, maxlength=40 | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | validation: Not detected | users.last_name: VARCHAR(40); notNull=false; unique=false |
| frontend/js/farmer.js | 9505 | `shop-zone-input` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/js/farmer.js | 9508 | `shop-province-input` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/farmer.js | 9511 | `shop-city-input` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/farmer.js | 9514 | `shop-barangay-input` | select | disabled | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/farmer.js | 9517 | `shop-street-input` | text | placeholder=Street / Building / House No. | required; maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/js/farmer.js | 9518 | `shop-address-preview` | textarea | placeholder=Address preview will appear here | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/js/farmer.js | 9523 | `shop-description-input` | textarea | placeholder=Add a short description about your farm and products. | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/js/farmer.js | 9552 | `account-new-password` | password | required | minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/js/farmer.js | 9557 | `account-confirm-password` | password | required | minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Farmer (account-password-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/js/farmer.js | 9547 | `account-current-password` | password | required | minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Farmer (account-shop-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/js/farmer.js | 9501 | `shop-name-input` | text | placeholder=My Farm Shop, maxlength=40 | required; pattern:[A-Za-z0-9\s\-_.&'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Farmer (chat-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/farmer.html | 2190 | `chat-input` | text | placeholder=Type a message..., maxlength=500, required | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |

### Module: Farmer (create-support-ticket-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/farmer.html | 3663 | `support-ticket-subject` | text | maxlength=200, required | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |

### Module: Farmer (edit-product-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/farmer.html | 3148 | `edit-product-id` | hidden |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |

### Module: Farmer (profile-edit-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/farmer.html | 2449 | `pe-firstname` | text | maxlength=40 | required; pattern:[A-Za-z\s\-.'’]+ | Empty value accepted by browser, can bypass client-side check \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Farmer (request-product-form-modal)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/farmer.html | 3504 | `request-product-name` | text | placeholder=Enter the product name you want to request, required, maxlength=30 | maxLength:100; pattern:[A-Za-z0-9\s\-_.&'’()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Farmer (support-chat-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/farmer.html | 2315 | `support-chat-input` | text | placeholder=Type a message..., maxlength=500, required | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |

### Module: Farmer (update-harvest-date-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/farmer.html | 3383 | `update-harvest-product-id` | hidden |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |

### Module: Farmer (verification-request-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/farmer.html | 2590 | `verification-document` | file | accept=image/jpeg,image/png | data-max-size:"5MB" (backend enforcement required) |  | - | Add missing validations | partial | not found | not mapped |

### Module: General

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/checkout.html | 654 | `checkout-firstname` | text | placeholder=First name, maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/checkout.html | 658 | `checkout-middlename` | text | placeholder=Optional, maxlength=40 | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/checkout.html | 662 | `checkout-lastname` | text | placeholder=Last name, maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/checkout.html | 671 | `checkout-phone` | tel | placeholder=912 345 6789, maxlength=12, required | maxLength:20; pattern:[0-9\s+\-()]{10,20} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | validation: Not detected | not mapped |
| frontend/checkout.html | 679 | `special-instructions` | textarea | maxlength=200, placeholder=Any notes for the farmer or delivery person… | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/checkout.html | 798 | `floating-address-province` | select | disabled, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/checkout.html | 807 | `floating-address-city` | select | disabled, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/checkout.html | 816 | `floating-address-barangay` | select | disabled, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/checkout.html | 825 | `floating-address-street` | text | placeholder=Enter street, building, or house number, required | maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/checkout.html | 832 | `floating-address-full` | textarea | placeholder=Formatted address will appear here | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/orders.html | 570 | `order-rating-comment` | textarea | maxlength=500, placeholder=Share your experience with this product... | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/wishlist.html | 608 | `wishlist-sort` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/wishlist.html | 617 | `wishlist-filter-category` | select |  | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |
| frontend/wishlist.html | 623 | `wishlist-filter-type` | select |  | maxLength:100; type:"search" (currently "select") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/wishlist.html | 633 | `wishlist-search-input` | text | placeholder=Product name… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |

### Module: General (add-address-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/checkout.html | 789 | `floating-address-zone` | select | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |

### Module: General (order-cancel-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/orders.html | 591 | `order-cancel-reason-input` | textarea | maxlength=500, placeholder=Tell us why you are cancelling this order... | required | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message | Add missing validations | partial | not found | not mapped |

### Module: Landing / Marketplace / Auth

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/index.html | 290 | `global-search-input` | text | placeholder=Search products... | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/index.html | 295 | `global-sort-select` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 411 | `product-details-quantity` | number | min=1, max=99999 | required; step:1 | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/index.html | 496 | `auth-email` | text | placeholder=Username or Email, maxlength=256, pattern=[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}\|[a-zA-Z0-9_]{3,20}, required | maxLength exceeds DB limit 128; type:"email" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add title attribute describing pattern | Add maxlength matching DB column | partial | validation: Not detected | users.email: VARCHAR(100) UNIQUE NOT NULL; notNull=true; unique=true |
| frontend/index.html | 501 | `auth-password` | password | placeholder=Password, required | minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | validation: Not detected | users.password: VARCHAR(255) NOT NULL; notNull=true; unique=false |
| frontend/index.html | 549 | `auth-email-register` | email | placeholder=your.email@example.com, maxlength=128, pattern=[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}, required | none | No immediate client-side risk identified (verify backend enforcement) | Add title attribute describing pattern | OK | yes | not found | not mapped |
| frontend/index.html | 572 | `register-otp` | text | placeholder=000000, maxlength=6, pattern=[0-9]{6} | required; minLength:6 | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message \| Add title attribute describing pattern | Add missing validations | partial | not found | not mapped |
| frontend/index.html | 603 | `auth-username` | text | placeholder=Choose a unique username, pattern=[a-zA-Z0-9_]{3,20}, minlength=3, maxlength=20, required | maxLength:30 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add title attribute describing pattern | Add maxlength matching DB column | partial | validation: Not detected | users.username: VARCHAR(50) UNIQUE NOT NULL; notNull=true; unique=true |
| frontend/index.html | 612 | `auth-password-register` | password | placeholder=Create a strong password, minlength=8, maxlength=64, required | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/index.html | 651 | `auth-password-confirm` | password | placeholder=Re-enter your password, minlength=8, maxlength=64, required | pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/index.html | 677 | `auth-firstname` | text | placeholder=Enter your first name, pattern=[A-Za-z\s]+, title=Up to 40 characters. Letters and spaces only., maxlength=40, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | users.first_name: VARCHAR(40); notNull=false; unique=false |
| frontend/index.html | 684 | `auth-middlename` | text | placeholder=Enter your middle name, pattern=[A-Za-z\s]+, title=Up to 40 characters. Letters and spaces only., maxlength=40 | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | users.middle_name: VARCHAR(40); notNull=false; unique=false |
| frontend/index.html | 692 | `auth-lastname` | text | placeholder=Enter your last name, pattern=[A-Za-z\s]+, title=Up to 40 characters. Letters and spaces only., maxlength=40, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | users.last_name: VARCHAR(40); notNull=false; unique=false |
| frontend/index.html | 702 | `auth-phone` | tel | placeholder=929 819 6629, maxlength=12, pattern=[0-9\s]{10,12}, required | maxLength:20 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add title attribute describing pattern | Add maxlength matching DB column | partial | validation: Not detected | users.phone: VARCHAR(20); notNull=false; unique=false |
| frontend/index.html | 711 | `auth-zone` | select | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 714 | `auth-province` | select | disabled, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | validation: Not detected | not mapped |
| frontend/index.html | 717 | `auth-city` | select | disabled, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | validation: Not detected | not mapped |
| frontend/index.html | 720 | `auth-barangay` | select | disabled, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | validation: Not detected | not mapped |
| frontend/index.html | 723 | `auth-street` | text | placeholder=House no., building, street, maxlength=100, pattern=[a-zA-Z0-9\s,.#/-()]+, required | none | No immediate client-side risk identified (verify backend enforcement) | Add title attribute describing pattern | OK | yes | validation: Not detected | not mapped |
| frontend/index.html | 725 | `auth-address` | textarea | placeholder=Selected address will appear here, required | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | validation: Not detected | users.address: TEXT; notNull=false; unique=false |
| frontend/index.html | 776 | `auth-terms-checkbox` | checkbox | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 785 | `auth-privacy-checkbox` | checkbox | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 890 | `terms-modal-checkbox` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 949 | `privacy-modal-checkbox` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 975 | `forgot-email` | email | placeholder=your.email@example.com, maxlength=256, pattern=[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | required; maxLength exceeds DB limit 128 | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | Add required indicator and client error message \| Add title attribute describing pattern | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/index.html | 993 | `forgot-otp` | text | placeholder=000000, maxlength=6, pattern=[0-9]{6} | required; minLength:6 | Empty value accepted by browser, can bypass client-side check | Add required indicator and client error message \| Add title attribute describing pattern | Add missing validations | partial | not found | not mapped |
| frontend/index.html | 1010 | `forgot-new-password` | password | minlength=6 | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/index.html | 1020 | `forgot-new-password-confirm` | password | minlength=6 | required; minLength:8; maxLength:64; pattern:^(?=.*[A-Za-z])(?=.*\d).{8,}$ | Empty value accepted by browser, can bypass client-side check \| Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | Add required indicator and client error message | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/index.html | 1064 | `floating-address-middlename` | text | placeholder=Enter your middle name (optional), maxlength=40 | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/index.html | 1071 | `floating-address-lastname` | text | placeholder=Enter your last name, maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/index.html | 1080 | `floating-address-phone` | tel | placeholder=929 819 6629, maxlength=12, required | maxLength:20; pattern:[0-9\s+\-()]{10,20} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/index.html | 1089 | `floating-address-zone` | select | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 1098 | `floating-address-province` | select | disabled, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 1107 | `floating-address-city` | select | disabled, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 1116 | `floating-address-barangay` | select | disabled, required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 1125 | `floating-address-street` | text | placeholder=Enter street, building, or house number, required | maxLength:100; pattern:[A-Za-z0-9\s,.#\/\-()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/index.html | 1132 | `floating-address-full` | textarea | placeholder=Formatted address will appear here, required | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/index.html | 1138 | `floating-address-default` | checkbox |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/index.html | 1203 | `contact-name` | text | required | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/index.html | 1207 | `contact-email` | email | required | maxLength:128; pattern:[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/index.html | 1212 | `contact-subject` | text | required | maxLength:100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/index.html | 1216 | `contact-message` | textarea | required, maxlength=500 | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/app.js | 7313 | `` | number | min=${moq}, max=${maxStock} | min:0; step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/js/app.js | 7909 | `` | number | min=1, max=${maxStock} | step:1 | Out-of-range numeric values accepted | - | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/js/psgc.js | 66 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |
| frontend/js/psgc.js | 82 | `` | select |  | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |

### Module: Landing / Marketplace / Auth (add-address-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/index.html | 1057 | `floating-address-firstname` | text | placeholder=Enter your first name, maxlength=40, required | pattern:[A-Za-z\s\-.'’]+ | Malformed / injection-capable values accepted | - | Add pattern regex and backend regex validation | partial | not found | not mapped |

### Module: Messaging

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/chat.html | 229 | `admin-chat-search-input` | text | placeholder=Search conversations… | maxLength:100; type:"search" (currently "text") | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |

### Module: Messaging (chat-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/chat.html | 260 | `chat-input` | text | placeholder=Type a message…, maxlength=500, required | maxLength exceeds DB limit 100 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped | - | Add maxlength matching DB column | partial | not found | not mapped |

### Module: Products / Reviews

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/product.html | 68 | `review-rating` | hidden |  | required; min:1; max:5; step:1; type:"number" (currently "hidden") | Empty value accepted by browser, can bypass client-side check \| Out-of-range numeric values accepted | Add required indicator and client error message | Add min/max/step attributes and backend numeric clamps | partial | not found | not mapped |
| frontend/product.html | 73 | `review-comment` | textarea | placeholder=Share your experience... | maxLength:500 | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Unbounded textarea can exceed DB TEXT limit and cause UI issues | - | Add maxlength matching DB column | partial | not found | not mapped |
| frontend/request-product.html | 34 | `request-product-name` | text | placeholder=Choose category first, disabled, required | maxLength:100; pattern:[A-Za-z0-9\s\-_.&'’()]+ | Oversize payload risk; possible DoS/truncation and stored XSS if output is not escaped \| Malformed / injection-capable values accepted | - | Add maxlength matching DB column \| Add pattern regex and backend regex validation | partial | not found | not mapped |
| frontend/request-product.html | 39 | `request-product-notes` | textarea | maxlength=500, placeholder=e.g., local/common name, quality details, suggested unit, etc. | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |

### Module: Products / Reviews (request-product-form)

| File | Line | Field Name | Input Type | Current Validation | Missing Validation | Security Risks | UX Improvements | Recommended Rules | FE | BE | DB |
|------|------|------------|------------|--------------------|--------------------|----------------|-----------------|-------------------|----|----|----|
| frontend/request-product.html | 28 | `request-product-category` | select | required | none | No immediate client-side risk identified (verify backend enforcement) | - | OK | yes | not found | not mapped |

## Backend Endpoint Validation Matrix

| File | Method | Route | Parameters | Validation Status | Notes |
|------|--------|-------|------------|-------------------|-------|
| backend/routes/activityMonitor.js | GET | `/activities` | none | n/a | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | GET | `/activities/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | GET | `/session/:sessionId/timeline` | sessionId (params) | Not detected | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | GET | `/dashboard` | none | n/a | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | GET | `/online-users` | none | n/a | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | GET | `/errors-today` | none | n/a | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | GET | `/settings` | none | n/a | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | PUT | `/settings` | enableMonitoring (body), retentionDays (body), maxRecords (body), autoDelete (body), enableCustomer (body), enableFarmer (body), enableAdmin (body) | Not detected; Present (heuristic); Present (heuristic); Not detected; Present (heuristic); Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | POST | `/cleanup` | const (body), settings (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | GET | `/storage` | none | n/a | Verify ownership + auth before use |
| backend/routes/activityMonitor.js | GET | `/stream` | token (query) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/addresses.js | GET | `/` | none | n/a | Verify ownership + auth before use |
| backend/routes/addresses.js | POST | `/` | label (body), full_name (body), first_name (body), middle_name (body), last_name (body), phone (body), street (body), barangay (body), address_line1 (body), address_line2 (body), city (body), province (body), postal_code (body), is_default (body) | Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Present (heuristic) | Verify ownership + auth before use |
| backend/routes/addresses.js | PUT | `/:id` | id (params), label (body), full_name (body), first_name (body), middle_name (body), last_name (body), phone (body), street (body), barangay (body), address_line1 (body), address_line2 (body), city (body), province (body), postal_code (body), is_default (body) | Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Present (heuristic) | Verify ownership + auth before use |
| backend/routes/addresses.js | DELETE | `/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/addresses.js | PUT | `/:id/set-default` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/users` | search (query), role (query), status (query), verification (query) | Present (heuristic); Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | POST | `/users` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/logs` | actor_admin_id (query), action (query), entity (query), dateFrom (query), dateTo (query) | Not detected; Not detected; Not detected; Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/audit-logs/:id` | id (params) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/audit-logs/actions` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/audit-logs/entities` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/users/:id` | id (params), full_name (body), first_name (body), middle_name (body), last_name (body), shop_name (body), username (body), email (body), password (body), phone (body), address (body) | Present (heuristic); Not detected; Present (heuristic); Present (heuristic); Present (heuristic); Not detected; Not detected; Not detected; Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/users/:id/verify` | id (params), is_verified (body), reason (body) | Not detected; Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/verification-requests` | status (query), search (query) | Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/verification-requests/:id/review` | id (params), status (body), rejection_reason (body) | Not detected; Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/users/:id/shop-profile` | id (params), shop_description (body), shop_banner_url (body), shop_avatar_url (body), full_name (body), address (body) | Present (heuristic); Not detected; Not detected; Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | POST | `/users/:id/generate-temp-password` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/products` | search (query), category (query), status (query) | Present (heuristic); Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/products/:id/assign` | id (params), farmer_id (body) | Not detected; Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | POST | `/products/:id/approve` | id (params) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | POST | `/products/:id/reject` | id (params), rejection_reason (body) | Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/products/:id` | id (params), name (body), description (body), price (body), category_id (body), stock_quantity (body), unit (body), location (body), harvest_date (body), expiry_date (body), is_available (body), image_url (body), explicitPublicId (body) | Not detected; Present (heuristic); Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/orders` | search (query), status (query), dateFrom (query), dateTo (query), minTotal (query), maxTotal (query) | Not detected; Not detected; Not detected; Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/users/:id/role` | id (params), role (body) | Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/orders/:id/status` | id (params), status (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | DELETE | `/orders/:id` | id (params) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/orders/:id/enable` | id (params) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/stats` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/users/:id/disable` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/users/:id/enable` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | DELETE | `/users/:id` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | DELETE | `/products/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/products/:id/status` | id (params), is_admin_disabled (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/categories` | search (query), status (query) | Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/categories/:id` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/categories/:id/products` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | POST | `/categories` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/categories/:id` | name (body), description (body), type (body) | Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/categories/:id/disable` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | DELETE | `/categories/:id` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/categories/:id/enable` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/catalog-names` | search (query), category (query), status (query) | Present (heuristic); Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | POST | `/catalog-names` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/catalog-names/:id` | adminSetAveragePrice (body) | Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PATCH | `/catalog-names/:id` | isDisabled (body) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | PATCH | `/catalog-names/:id/average-price` | averagePrice (body) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | DELETE | `/catalog-names/:id` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/category-requests` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/category-requests/:id/review` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/orders/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/dashboard/stats` | const (query), period (query), metric (query), cacheBust (query) | Not detected; Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/dashboard/report` | const (query), period (query), cacheBust (query) | Not detected; Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/dashboard/top-products` | const (query), period (query), cacheBust (query) | Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/dashboard/top-farmers` | const (query), period (query), cacheBust (query) | Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/dashboard/recent-activity` | const (query), period (query), cacheBust (query) | Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/customers/:id/summary` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/farmers/:id/summary` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/users/:id/suspend` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/suspicious-patterns` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | POST | `/users/:id/flag` | reason (body) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | POST | `/users/:id/unflag` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/flagged-users` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/users/:id/ban` | none | n/a | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/featured-products` | status (query) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | POST | `/featured-products` | product_id (body), farmer_id (body), expires_at (body), position (body) | Present (heuristic); Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | DELETE | `/featured-products/:id` | id (params) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/featured-products/:id` | id (params), expires_at (body), position (body), is_active (body) | Not detected; Present (heuristic); Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | GET | `/subscriptions` | status (query) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/subscriptions/:id/approve` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/subscriptions/:id/reject` | id (params), reason (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/subscriptions/:id/expire` | id (params), reason (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/admin.js | PUT | `/subscriptions/:id/resume` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/auth.js | GET | `/otp-mode` | token (body) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/auth.js | GET | `/check-username/:username` | username (params) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/auth.js | POST | `/register` | none | n/a | Verify ownership + auth before use |
| backend/routes/auth.js | POST | `/login` | recaptchaToken (body) | Not detected | Verify ownership + auth before use |
| backend/routes/auth.js | POST | `/recover-admin` | email (body), admin_secret (body) | Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/auth.js | POST | `/logout` | none | n/a | Verify ownership + auth before use |
| backend/routes/auth.js | GET | `/profile` | none | n/a | Verify ownership + auth before use |
| backend/routes/auth.js | GET | `/me` | none | n/a | Verify ownership + auth before use |
| backend/routes/auth.js | PUT | `/profile` | body (body) | Not detected | Verify ownership + auth before use |
| backend/routes/auth.js | POST | `/forgot` | none | n/a | Verify ownership + auth before use |
| backend/routes/auth.js | POST | `/forgot/resend` | none | n/a | Verify ownership + auth before use |
| backend/routes/auth.js | POST | `/forgot/verify-otp` | none | n/a | Verify ownership + auth before use |
| backend/routes/auth.js | POST | `/forgot/reset` | none | n/a | Verify ownership + auth before use |
| backend/routes/auth.js | PUT | `/change-password` | none | n/a | Verify ownership + auth before use |
| backend/routes/auth.js | GET | `/feature-flags` | none | n/a | Verify ownership + auth before use |
| backend/routes/cart.js | GET | `/` | sessionId (query) | Not detected | Verify ownership + auth before use |
| backend/routes/cart.js | POST | `/` | 1 (body), sessionId (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/cart.js | PUT | `/:id` | id (params), quantity (body), sessionId (body) | Not detected; Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/cart.js | DELETE | `/:id` | id (params), sessionId (body) | Not detected; Present (heuristic) | Verify ownership + auth before use |
| backend/routes/cart.js | DELETE | `/` | sessionId (query) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/cart.js | POST | `/migrate` | sessionId (body) | Not detected | Verify ownership + auth before use |
| backend/routes/cart.js | POST | `/merge` | none | n/a | Verify ownership + auth before use |
| backend/routes/contact.js | POST | `/` | name (body), email (body), subject (body), message (body) | Present (heuristic); Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/debug.js | GET | `/db-info` | none | n/a | Verify ownership + auth before use |
| backend/routes/debug.js | POST | `/login-check` | none | n/a | Verify ownership + auth before use |
| backend/routes/farmers.js | GET | `/` | none | n/a | Verify ownership + auth before use |
| backend/routes/farmers.js | GET | `/:id/profile` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/farmers.js | GET | `/me/stats` | If (query), no (query), range (query), param (query), is (query), provided (query), keep (query), lifetime (query), stats. (query), const (query), clientAskedRange (query) | Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Present (heuristic) | Verify ownership + auth before use |
| backend/routes/farmers.js | GET | `/me/metrics` | none | n/a | Verify ownership + auth before use |
| backend/routes/farmers.js | GET | `/me/report` | period (query) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/farmers.js | GET | `/me/metrics/export.csv` | none | n/a | Verify ownership + auth before use |
| backend/routes/farmers.js | PUT | `/profile` | body (body) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/farmers.js | POST | `/me/verification-request` | document_url (body), notes (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/farmers.js | GET | `/me/verification-request` | none | n/a | Verify ownership + auth before use |
| backend/routes/farmers.js | POST | `/products/:id/harvest-preorder` | none | n/a | Verify ownership + auth before use |
| backend/routes/farmers.js | POST | `/products/:id/convert-preorder` | none | n/a | Verify ownership + auth before use |
| backend/routes/health.js | GET | `/` | none | n/a | Verify ownership + auth before use |
| backend/routes/messages.js | GET | `/conversations` | none | n/a | Verify ownership + auth before use |
| backend/routes/messages.js | GET | `/conversation/:conversationId` | conversationId (params) | Not detected | Verify ownership + auth before use |
| backend/routes/messages.js | PUT | `/conversation/:conversationId/read` | conversationId (params) | Not detected | Verify ownership + auth before use |
| backend/routes/messages.js | POST | `/send` | receiver_id (body), message (body), product_id (body) | Present (heuristic); Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/messages.js | PUT | `/:id/read` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/messages.js | GET | `/unread-count` | none | n/a | Verify ownership + auth before use |
| backend/routes/notifications.js | GET | `/` | type (query) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/notifications.js | PUT | `/:id/read` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/notifications.js | PUT | `/read-all` | none | n/a | Verify ownership + auth before use |
| backend/routes/orders.js | GET | `/` | none | n/a | Verify ownership + auth before use |
| backend/routes/orders.js | GET | `/farmer/:farmerId` | farmerId (params), status (query) | Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/orders.js | PUT | `/:orderId/items/:orderItemId/status` | status (body), note (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/orders.js | GET | `/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/orders.js | POST | `/` | payloadSessionId (body), cart_item_ids (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/orders.js | PUT | `/:id/status` | status (body) | Not detected | Verify ownership + auth before use |
| backend/routes/orders.js | PUT | `/:id/cancel` | id (params), reason (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/orders.js | PUT | `/:id/delivery-date` | delivery_date (body), rescheduleReason (body) | Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/orders.js | PUT | `/:id/cancel-farmer` | id (params), reason (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/otp.js | POST | `/send` | isResend (body) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/otp.js | POST | `/verify` | none | n/a | Verify ownership + auth before use |
| backend/routes/payment-accounts.js | GET | `/payment-accounts` | none | n/a | Verify ownership + auth before use |
| backend/routes/payment-accounts.js | POST | `/payment-accounts` | name (body), account_number (body), type (body), sort_order (body) | Present (heuristic); Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/payment-accounts.js | PUT | `/payment-accounts/:id` | id (params), name (body), account_number (body), type (body), is_active (body), sort_order (body) | Not detected; Not detected; Not detected; Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/payment-accounts.js | DELETE | `/payment-accounts/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/categories` | none | n/a | Verify ownership + auth before use |
| backend/routes/products.js | POST | `/category-requests` | none | n/a | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/category-requests/mine` | none | n/a | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/requests/mine` | none | n/a | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/product-requests/mine` | none | n/a | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/` | preorder (query) | Not detected | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/catalog/names` | none | n/a | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/previous-values` | name (query), is_preorder (query) | Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/pricing/suggestion` | categoryId (query), unit (query) | Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/featured` | none | n/a | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/:id/current-active` | id (params) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/:id/similar-sellers` | id (params), is_preorder (query) | Not detected; Present (heuristic) | Verify ownership + auth before use |
| backend/routes/products.js | POST | `/:id/resubmit` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/products.js | GET | `/farmer/:farmerId` | farmerId (params) | Not detected | Verify ownership + auth before use |
| backend/routes/products.js | POST | `/` | name (body), description (body), price (body), category_id (body), stock_quantity (body), unit (body), image_url (body), location (body), city (body), province (body), harvest_date (body), expiry_date (body), is_preorder (body), preorder_availability_date (body), max_preorder_quantity (body), minimum_order_quantity (body), imagePublicId (body) | Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/products.js | PUT | `/:id/harvest-date` | id (params), harvest_date (body), reason (body) | Not detected; Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/products.js | PUT | `/:id` | id (params), name (body), description (body), price (body), category_id (body), stock_quantity (body), unit (body), image_url (body), location (body), city (body), province (body), harvest_date (body), expiry_date (body), is_available (body), is_preorder (body), preorder_availability_date (body), max_preorder_quantity (body), minimum_order_quantity (body), newPublicId (body) | Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/products.js | POST | `/:id/convert-preorders` | const (params), productId (params), harvest_quantity (body) | Not detected; Not detected; Present (heuristic) | Verify ownership + auth before use |
| backend/routes/products.js | POST | `/:id/harvest-lifecycle` | productId (params), harvest_quantity (body), make_available (body) | Not detected; Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/products.js | DELETE | `/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/psgc.js | GET | `/provinces` | none | n/a | Verify ownership + auth before use |
| backend/routes/psgc.js | GET | `/cities` | none | n/a | Verify ownership + auth before use |
| backend/routes/psgc.js | GET | `/barangays` | none | n/a | Verify ownership + auth before use |
| backend/routes/reviews.js | GET | `/products/:id/reviews/eligibility` | none | n/a | Verify ownership + auth before use |
| backend/routes/reviews.js | GET | `/products/:id/reviews` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/reviews.js | POST | `/products/:id/reviews` | id (params), rating (body), comment (body) | Present (heuristic); Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/reviews.js | PUT | `/reviews/:id` | id (params), rating (body), comment (body) | Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/reviews.js | DELETE | `/reviews/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/reviews.js | GET | `/orders/:id/customer-rating/eligibility` | none | n/a | Verify ownership + auth before use |
| backend/routes/reviews.js | POST | `/orders/:id/customer-rating` | none | n/a | Verify ownership + auth before use |
| backend/routes/reviews.js | PUT | `/orders/:id/customer-rating` | none | n/a | Verify ownership + auth before use |
| backend/routes/reviews.js | GET | `/mine` | none | n/a | Verify ownership + auth before use |
| backend/routes/settings.js | GET | `/` | none | n/a | Verify ownership + auth before use |
| backend/routes/settings.js | GET | `/delivery-fee` | none | n/a | Verify ownership + auth before use |
| backend/routes/settings.js | GET | `/product-limits` | none | n/a | Verify ownership + auth before use |
| backend/routes/settings.js | GET | `/recaptcha-mode` | none | n/a | Verify ownership + auth before use |
| backend/routes/subscriptions.js | GET | `/settings` | none | n/a | Verify ownership + auth before use |
| backend/routes/subscriptions.js | GET | `/farmers/me/subscription` | none | n/a | Verify ownership + auth before use |
| backend/routes/subscriptions.js | POST | `/farmers/me/subscription/request` | plan_duration_months (body), payment_account_id (body), payment_method (body), expected_amount (body) | Present (heuristic); Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/subscriptions.js | GET | `/farmers/me/subscription/history` | none | n/a | Verify ownership + auth before use |
| backend/routes/superadmin.js | GET | `/status` | none | n/a | Verify ownership + auth before use |
| backend/routes/superadmin.js | GET | `/admin` | none | n/a | Verify ownership + auth before use |
| backend/routes/superadmin.js | POST | `/announcements` | none | n/a | Verify ownership + auth before use |
| backend/routes/superadmin.js | GET | `/announcements` | const (query), userRole (query) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/superadmin.js | GET | `/announcements/all` | none | n/a | Verify ownership + auth before use |
| backend/routes/superadmin.js | PATCH | `/announcements/:id/toggle` | none | n/a | Verify ownership + auth before use |
| backend/routes/superadmin.js | POST | `/users` | first_name (body), middle_name (body), last_name (body), full_name (body), email (body), username (body), password (body), role (body) | Not detected; Not detected; Not detected; Not detected; Present (heuristic); Present (heuristic); Present (heuristic); Present (heuristic) | Verify ownership + auth before use |
| backend/routes/superadmin.js | PUT | `/users/:id` | first_name (body), middle_name (body), last_name (body), full_name (body), email (body), username (body), password (body), role (body) | Present (heuristic); Present (heuristic); Present (heuristic); Not detected; Not detected; Not detected; Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/superadmin.js | DELETE | `/users/:id` | none | n/a | Verify ownership + auth before use |
| backend/routes/superadmin.js | GET | `/settings` | none | n/a | Verify ownership + auth before use |
| backend/routes/superadmin.js | PUT | `/settings` | const (body), updates (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/superadmin.js | PUT | `/users/:id/debug-mode` | enabled (body) | Not detected | Verify ownership + auth before use |
| backend/routes/superadmin.js | GET | `/flags` | none | n/a | Verify ownership + auth before use |
| backend/routes/superadmin.js | PUT | `/flags/:key` | key (params), enabled (body) | Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/support-tickets.js | POST | `/` | subject (body), description (body), priority (body) | Present (heuristic); Present (heuristic); Not detected | Verify ownership + auth before use |
| backend/routes/support-tickets.js | GET | `/` | 10 (query) | Not detected | Verify ownership + auth before use |
| backend/routes/support-tickets.js | GET | `/unread-count` | none | n/a | Verify ownership + auth before use |
| backend/routes/support-tickets.js | GET | `/my` | 10 (query) | Not detected | Verify ownership + auth before use |
| backend/routes/support-tickets.js | GET | `/:id` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/support-tickets.js | PUT | `/:id` | id (params), status (body) | Not detected; Not detected | Verify ownership + auth before use |
| backend/routes/support-tickets.js | POST | `/:id/messages` | id (params), message (body) | Not detected; Present (heuristic) | Verify ownership + auth before use |
| backend/routes/support-tickets.js | GET | `/:id/messages` | id (params) | Not detected | Verify ownership + auth before use |
| backend/routes/upload.js | POST | `/product-image` | none | n/a | Verify ownership + auth before use |
| backend/routes/upload.js | POST | `/shop-banner` | none | n/a | Verify ownership + auth before use |
| backend/routes/upload.js | POST | `/shop-avatar` | none | n/a | Verify ownership + auth before use |
| backend/routes/upload.js | POST | `/verification-document` | none | n/a | Verify ownership + auth before use |
| backend/routes/wishlist.js | GET | `/` | none | n/a | Verify ownership + auth before use |
| backend/routes/wishlist.js | POST | `/` | productId (body) | Present (heuristic) | Verify ownership + auth before use |
| backend/routes/wishlist.js | DELETE | `/:productId` | productId (params) | Not detected | Verify ownership + auth before use |

## Database Constraints Summary (schema.sql + migrations)

Key columns are listed with type, `NOT NULL`, `UNIQUE`, `DEFAULT`, `CHECK`, and `REFERENCES` constraints.  

### Table: `activity_logs`

| Column | Type | Constraints |
|--------|------|-------------|
| ip_address | VARCHAR(45) | - |
| user_agent | TEXT | - |
| request_id | VARCHAR(100) | - |
| risk_level | VARCHAR(20) DEFAULT 'low' | DEFAULT 'low' |
| risk_score | INTEGER DEFAULT 0 | DEFAULT 0 |
| country | VARCHAR(100) | - |
| city | VARCHAR(100) | - |
| latitude | DECIMAL(10, 8) | - |
| longitude | DECIMAL(11, 8) | - |
| browser_name | VARCHAR(50) | - |
| browser_version | VARCHAR(50) | - |
| os_name | VARCHAR(50) | - |
| os_version | VARCHAR(50) | - |
| device_type | VARCHAR(20) | - |

### Table: `admin_audit_logs`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| actor_admin_id | INTEGER NOT NULL | NOT NULL |
| actor_admin_email | VARCHAR(255) | - |
| actor_admin_name | VARCHAR(255) | - |
| action | VARCHAR(100) NOT NULL | NOT NULL |
| entity | VARCHAR(50) NOT NULL | NOT NULL |
| entity_id | INTEGER | - |
| before | JSONB | - |
| after | JSONB | - |
| ip_address | VARCHAR(45) | - |
| user_agent | TEXT | - |
| session_id | VARCHAR(100) | - |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `cart`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| session_id | VARCHAR(255), -- for guest users | - |
| user_id | INTEGER REFERENCES users(id), -- for logged in users | REF REFERENCES users(id) |
| product_id | INTEGER REFERENCES products(id) | REF REFERENCES products(id) |
| quantity | INTEGER NOT NULL DEFAULT 1 | NOT NULL, DEFAULT 1 |
| added_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| is_preorder | BOOLEAN DEFAULT false | DEFAULT false |

### Table: `categories`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| name | VARCHAR(50) UNIQUE NOT NULL | NOT NULL, UNIQUE |
| description | TEXT | - |
| type | VARCHAR(50) DEFAULT 'agricultural' | DEFAULT 'agricultural' |
| is_disabled | BOOLEAN DEFAULT false | DEFAULT false |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `conversations`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| conversation_id | VARCHAR(255) UNIQUE NOT NULL | NOT NULL, UNIQUE |
| farmer_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| customer_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| last_message_at | TIMESTAMP | - |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `customer_ratings`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| order_id | INTEGER REFERENCES orders(id) | REF REFERENCES orders(id) |
| farmer_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| customer_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| rating | INTEGER NOT NULL | NOT NULL |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `farmer_subscriptions`

| Column | Type | Constraints |
|--------|------|-------------|
| rejection_reason | TEXT | - |

### Table: `messages`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| conversation_id | VARCHAR(255) | - |
| sender_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| receiver_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| message | TEXT NOT NULL | NOT NULL |
| is_read | BOOLEAN DEFAULT false | DEFAULT false |
| product_id | INTEGER REFERENCES products(id) | REF REFERENCES products(id) |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `notifications`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| user_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| type | VARCHAR(50) | - |
| title | VARCHAR(255) | - |
| message | TEXT | - |
| is_read | BOOLEAN DEFAULT false | DEFAULT false |
| order_id | INTEGER REFERENCES orders(id) | REF REFERENCES orders(id) |
| product_id | INTEGER REFERENCES products(id) | REF REFERENCES products(id) |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `order_items`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| order_id | INTEGER REFERENCES orders(id) | REF REFERENCES orders(id) |
| product_id | INTEGER REFERENCES products(id) | REF REFERENCES products(id) |
| quantity | INTEGER NOT NULL | NOT NULL |
| price | DECIMAL(10, 2) NOT NULL, -- price at time of order | NOT NULL |
| status | VARCHAR(20) DEFAULT 'pending' | DEFAULT 'pending' |
| delivered_at | TIMESTAMP | - |
| updated_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `orders`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| user_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| product_id | INTEGER REFERENCES products(id) | REF REFERENCES products(id) |
| quantity | INTEGER NOT NULL DEFAULT 1 | NOT NULL, DEFAULT 1 |
| price | DECIMAL(10, 2) NOT NULL, -- price at time of order | NOT NULL |
| total_amount | DECIMAL(10, 2) NOT NULL, -- quantity * price | NOT NULL |
| status | VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, preparing, out_for_delivery, delivered, cancelled | DEFAULT 'pending' |
| is_disabled | BOOLEAN DEFAULT false | DEFAULT false |
| disabled_at | TIMESTAMP | - |
| payment_method | VARCHAR(20) DEFAULT 'cash_on_delivery' | DEFAULT 'cash_on_delivery' |
| delivery_address | TEXT | - |
| delivery_date | DATE | - |
| estimated_delivery_date | DATE | - |
| cancelled_at | TIMESTAMP | - |
| cancellation_reason | TEXT | - |
| cancelled_by | VARCHAR(20) | - |
| reschedule_reason | TEXT | - |
| replacement_order_id | INTEGER | - |
| special_instructions | TEXT | - |
| delivered_at | TIMESTAMP | - |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| is_preorder | BOOLEAN DEFAULT false | DEFAULT false |
| preorder_converted_at | TIMESTAMP | - |
| preorder_reserved_quantity | INTEGER DEFAULT 0 CHECK (preorder_reserved_quantity >= 0) | DEFAULT 0, CHECK preorder_reserved_quantity >= 0 |
| preorder_fulfilled_quantity | INTEGER DEFAULT 0 CHECK (preorder_fulfilled_quantity >= 0) | DEFAULT 0, CHECK preorder_fulfilled_quantity >= 0 |

### Table: `otps`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| email | VARCHAR(100) NOT NULL | NOT NULL |
| otp_code | VARCHAR(10) NOT NULL | NOT NULL |
| purpose | VARCHAR(50) NOT NULL DEFAULT 'login', -- 'login', 'register', 'reset_password' | NOT NULL, DEFAULT 'login' |
| expires_at | TIMESTAMP NOT NULL | NOT NULL |
| is_used | BOOLEAN DEFAULT false | DEFAULT false |
| attempts | INTEGER DEFAULT 0 | DEFAULT 0 |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `password_resets`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| user_id | INTEGER REFERENCES users(id) ON DELETE CASCADE | REF REFERENCES users(id) |
| email | VARCHAR(100) NOT NULL | NOT NULL |
| otp_hash | VARCHAR(255) NOT NULL | NOT NULL |
| expires_at | TIMESTAMP NOT NULL | NOT NULL |
| used | BOOLEAN DEFAULT false | DEFAULT false |
| attempts | INTEGER DEFAULT 0 | DEFAULT 0 |
| sent_count | INTEGER DEFAULT 1 | DEFAULT 1 |
| last_sent_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| used_at | TIMESTAMP | - |
| request_ip | VARCHAR(64) | - |
| user_agent | TEXT | - |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `product_name_catalog`

| Column | Type | Constraints |
|--------|------|-------------|
| admin_set_average_price | NUMERIC(10,2) | - |
| default_unit | VARCHAR(20) DEFAULT 'kg' | DEFAULT 'kg' |
| is_disabled | BOOLEAN DEFAULT false | DEFAULT false |

### Table: `products`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| name | VARCHAR(100) NOT NULL | NOT NULL |
| description | TEXT | - |
| price | DECIMAL(10, 2) NOT NULL | NOT NULL |
| category_id | INTEGER REFERENCES categories(id) | REF REFERENCES categories(id) |
| farmer_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| stock_quantity | INTEGER DEFAULT 0 | DEFAULT 0 |
| unit | VARCHAR(20) DEFAULT 'kg', -- kg, pieces, boxes, etc. | DEFAULT 'kg' |
| minimum_order_quantity | INTEGER CHECK (minimum_order_quantity IS NULL OR minimum_order_quantity > 0) | CHECK minimum_order_quantity IS NULL OR minimum_order_quantity > 0 |
| image_url | VARCHAR(255) | - |
| sales_count | INTEGER DEFAULT 0 | DEFAULT 0 |
| is_available | BOOLEAN DEFAULT true | DEFAULT true |
| is_admin_disabled | BOOLEAN DEFAULT false | DEFAULT false |
| admin_disabled_at | TIMESTAMP | - |
| location | VARCHAR(100), -- farm location | - |
| harvest_date | DATE | - |
| expiry_date | DATE | - |
| linked_product_id | INTEGER REFERENCES products(id) ON DELETE SET NULL | REF REFERENCES products(id) |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| harvest_adjustment_count | INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS last_harvest_adjustment_at TIMESTAMP, ADD COLUMN IF NOT EXISTS harvest_overdue_days INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS reservations_disabled BOOLEAN DEFAULT false | DEFAULT 0 |
| is_preorder | BOOLEAN DEFAULT false | DEFAULT false |
| preorder_availability_date | DATE | - |
| reserved_quantity | INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0) | DEFAULT 0, CHECK reserved_quantity >= 0 |
| max_preorder_quantity | INTEGER CHECK (max_preorder_quantity IS NULL OR max_preorder_quantity > 0) | CHECK max_preorder_quantity IS NULL OR max_preorder_quantity > 0 |
| city | VARCHAR(100) | - |
| province | VARCHAR(100) | - |
| status | VARCHAR(20) DEFAULT 'pending' | DEFAULT 'pending' |
| rejection_reason | TEXT | - |

### Table: `reviews`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| product_id | INTEGER REFERENCES products(id) | REF REFERENCES products(id) |
| user_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| rating | INTEGER NOT NULL | NOT NULL |
| comment | TEXT | - |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `settings`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| key | VARCHAR(100) UNIQUE NOT NULL | NOT NULL, UNIQUE |
| value | TEXT | - |
| description | TEXT | - |
| updated_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

### Table: `user_addresses`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| user_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| label | VARCHAR(50) | - |
| full_name | VARCHAR(100) | - |
| first_name | VARCHAR(40) | - |
| middle_name | VARCHAR(40) | - |
| last_name | VARCHAR(40) | - |
| phone | VARCHAR(20) | - |
| address_line1 | TEXT NOT NULL | NOT NULL |
| address_line2 | TEXT | - |
| city | VARCHAR(100) | - |
| province | VARCHAR(100) | - |
| postal_code | VARCHAR(20) | - |
| is_default | BOOLEAN DEFAULT false | DEFAULT false |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| barangay | VARCHAR(100) | - |
| street | TEXT | - |

### Table: `users`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| username | VARCHAR(50) UNIQUE NOT NULL | NOT NULL, UNIQUE |
| email | VARCHAR(100) UNIQUE NOT NULL | NOT NULL, UNIQUE |
| password | VARCHAR(255) NOT NULL | NOT NULL |
| full_name | VARCHAR(130) | - |
| first_name | VARCHAR(40) | - |
| middle_name | VARCHAR(40) | - |
| last_name | VARCHAR(40) | - |
| shop_name | VARCHAR(40) | - |
| phone | VARCHAR(20) | - |
| address | TEXT | - |
| role | VARCHAR(20) DEFAULT 'customer', -- 'customer', 'farmer', 'admin', 'super_admin' | DEFAULT 'customer' |
| is_verified | BOOLEAN DEFAULT false | DEFAULT false |
| shop_description | TEXT | - |
| shop_banner_url | VARCHAR(255) | - |
| shop_avatar_url | VARCHAR(255) | - |
| total_sales | INTEGER DEFAULT 0 | DEFAULT 0 |
| total_revenue | DECIMAL(10,2) DEFAULT 0 | DEFAULT 0 |
| response_rate | DECIMAL(5,2) DEFAULT 0 | DEFAULT 0 |
| average_response_time | INTEGER DEFAULT 0 | DEFAULT 0 |
| cancellation_rate | DECIMAL(5,2) DEFAULT 0 | DEFAULT 0 |
| total_reviews | INTEGER DEFAULT 0 | DEFAULT 0 |
| average_rating | DECIMAL(3,2) DEFAULT 0 | DEFAULT 0 |
| customer_total_ratings | INTEGER DEFAULT 0 | DEFAULT 0 |
| customer_average_rating | DECIMAL(3,2) DEFAULT 0 | DEFAULT 0 |
| is_disabled | BOOLEAN DEFAULT false | DEFAULT false |
| disabled_at | TIMESTAMP | - |
| disabled_reason | TEXT | - |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| disable_type | VARCHAR(20) DEFAULT NULL | DEFAULT NULL |
| is_banned | BOOLEAN DEFAULT false | DEFAULT false |
| is_debug_account | BOOLEAN DEFAULT false | DEFAULT false |
| is_flagged | BOOLEAN DEFAULT false | DEFAULT false |
| flag_reason | VARCHAR(255) | - |
| flagged_at | TIMESTAMP | - |
| flagged_by | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |

### Table: `verification_requests`

| Column | Type | Constraints |
|--------|------|-------------|
| document_url | TEXT | - |

### Table: `wishlist`

| Column | Type | Constraints |
|--------|------|-------------|
| id | SERIAL PRIMARY KEY | PRIMARY KEY |
| user_id | INTEGER REFERENCES users(id) | REF REFERENCES users(id) |
| product_id | INTEGER REFERENCES products(id) | REF REFERENCES products(id) |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

## General Recommendations

1. **Defense in depth:** do not rely on HTML5 `required`/`pattern` alone; backend routes must re-validate type, length, ranges, enums, and sanitise output.  
2. **Trim all strings** before storage to avoid leading/trailing whitespace bypassing uniqueness or pattern checks.  
3. **HTML encode** all user content before DOM insertion (`innerHTML`) to prevent stored/reflected XSS.  
4. **File uploads** require MIME-type, file-size, and image-dimension validation on the server (Cloudinary signed upload can enforce some).  
5. **IDs** parsed from `req.params`/`req.query` must be coerced to integers and checked with `Number.isInteger`/`>0`; never concatenate into SQL.  
6. **Status enums** (`orders.status`, `products.status`, `support_tickets.status`, etc.) should have explicit whitelist checks in every mutating route.  
7. **Rate-limit** OTP, login, register, password reset, and file upload endpoints to prevent brute force / DoS.  

## Sample Implementation Reference

Below are copy-pasteable patterns for the most common missing validations found in this audit. Apply them in the listed file/line.

### HTML5 Client-Side Patterns

**Required text/email/tel with maxLength and pattern**
```html
<input type="text" id="field" required minlength="3" maxlength="40" pattern="[A-Za-z\s\-'’]+" title="3-40 letters, spaces, hyphens and apostrophes only">
```

**Email**
```html
<input type="email" id="email" required maxlength="100" pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}" title="Valid email address (max 100 chars)">
```

**Password**
```html
<input type="password" id="password" required minlength="8" maxlength="64" pattern="^(?=.*[A-Za-z])(?=.*\d).{8,}$" title="At least 8 characters with at least one letter and one number">
```

**Numeric price**
```html
<input type="number" id="price" required min="0" max="99999" step="0.01" inputmode="decimal">
```

**Numeric quantity**
```html
<input type="number" id="quantity" required min="1" max="99999" step="1" inputmode="numeric">
```

**Textarea**
```html
<textarea id="notes" rows="4" maxlength="500" title="Maximum 500 characters"></textarea>
```

**File upload**
```html
<input type="file" id="image" accept="image/*" data-max-size-mb="5" data-max-dims="1200x1200" title="Image files up to 5 MB and 1200x1200 px">
```

### Frontend JavaScript Enforcement

```javascript
function validateField(el) {
  const raw = el.value;
  const max = parseInt(el.getAttribute('maxlength'), 10);
  const min = parseInt(el.getAttribute('minlength'), 10);
  const pattern = el.getAttribute('pattern');
  if (max && raw.length > max) return `Exceeds ${max} characters`;
  if (min && raw.length < min) return `Must be at least ${min} characters`;
  if (pattern && !(new RegExp(`^(?:${pattern})$`)).test(raw)) return 'Format is invalid';
  if (el.type === 'number') {
    const v = Number(raw);
    const minVal = Number(el.min);
    const maxVal = Number(el.max);
    if (!Number.isFinite(v)) return 'Number required';
    if (minVal && v < minVal) return `Minimum ${minVal}`;
    if (maxVal && v > maxVal) return `Maximum ${maxVal}`;
  }
  return '';
}
```

### Backend Express Validation Snippet

```javascript
const validator = {
  required: v => v !== undefined && String(v || '').trim().length > 0,
  maxLength: (v, n) => String(v || '').length <= n,
  minLength: (v, n) => String(v || '').trim().length >= n,
  email: v => /^[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i.test(String(v || '').trim()) && String(v).trim().length <= 100,
  number: (v, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) && (min === undefined || n >= min) && (max === undefined || n <= max);
  },
  enum: (v, list) => list.includes(v)
};

// Usage inside a route handler
const name = String(req.body.name || '').trim();
if (!validator.required(name) || !validator.maxLength(name, 100)) {
  return res.status(400).json({ message: 'Invalid product name' });
}

const price = Number(req.body.price);
if (!validator.number(price, 0, 99999)) {
  return res.status(400).json({ message: 'Invalid price' });
}

const status = String(req.body.status || '').toLowerCase();
if (!validator.enum(status, ['pending', 'approved', 'rejected'])) {
  return res.status(400).json({ message: 'Invalid status value' });
}
```

### SQL Injection Defence

```javascript
const id = parseInt(req.params.id, 10);
if (!Number.isInteger(id) || id <= 0) {
  return res.status(400).json({ message: 'Invalid resource ID' });
}
const result = await pool.query('SELECT * FROM products WHERE id = $1 AND farmer_id = $2', [id, req.user.id]);
```

### Output Escaping

```javascript
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
}
// Use escapeHtml before inserting into innerHTML or setting .innerText for untrusted API data.
```

### File Upload Validation

```javascript
if (!req.file) return res.status(400).json({ message: 'Image required' });
const allowed = ['image/jpeg', 'image/png', 'image/webp'];
if (!allowed.includes(req.file.mimetype)) return res.status(400).json({ message: 'Only JPG, PNG, WEBP images allowed' });
const maxBytes = 5 * 1024 * 1024;
if (req.file.size > maxBytes) return res.status(400).json({ message: 'Image must be under 5 MB' });
```
