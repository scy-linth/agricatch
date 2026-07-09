# Frontend Validation Standardization Report

## Overview

This report documents the frontend-only validation standardization applied across the AgriCatch application.

- **Implementation file:** "/frontend/js/validation-standardizer.js"
- **Scope:** All frontend HTML pages and JavaScript-generated input fields
- **Baseline:** Validation rules from the Register page (frontend/index.html)
- **Excluded:** Hidden inputs, readonly inputs, filter dropdowns, search filters, system-generated fields, file uploads, checkboxes, radios, settings/config fields, OTP/captcha fields

## Files Updated

The standardizer script is included in the following frontend HTML files:

- frontend/404.html
- frontend/admin-backup.html
- frontend/admin.html
- frontend/chat.html
- frontend/checkout.html
- frontend/clear_cache.html
- frontend/clear_ui_orders.html
- frontend/customer-account.html
- frontend/farmer.html
- frontend/farmers.html
- frontend/index.html
- frontend/notifications.html
- frontend/orders.html
- frontend/product.html
- frontend/request-product.html
- frontend/wishlist.html

## Validation Rules by Category

| Category | Rule Summary |
|----------|-------------|
| firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| fullName | optional | minlength: 1 | maxlength: 100 | pattern: [A-Za-z\s]+ | title: "Up to 100 characters. Letters and spaces only." |
| username | required | minlength: 3 | maxlength: 20 | pattern: [a-zA-Z0-9_]{3,20} | title: "3-20 characters, letters, numbers, and underscores only." |
| email | type: email | required | minlength: 5 | maxlength: 100 | pattern: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | title: "Valid email address (max 100 characters)." |
| password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| shopName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z0-9\s\-_.&'’()]+ | title: "Up to 40 characters. Letters, numbers, spaces, and common symbols only." |
| productName | required | minlength: 1 | maxlength: 100 | pattern: [A-Za-z0-9\s\-_.&'’()]+ | title: "Up to 100 characters. Letters, numbers, spaces, and common symbols only." |
| productDescription | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| description | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| price | type: number | required | min: 0 | max: 99999 | step: 1 | title: "Price must be a whole number between 0 and 99999." |
| quantity | type: number | required | min: 1 | max: 9999 | step: 1 | title: "Quantity must be a whole number between 1 and 9999." |
| moq | type: number | optional | min: 1 | max: 9999 | step: 1 | title: "MOQ must be a whole number between 1 and 9999." |
| stock | type: number | required | min: 0 | max: 9999 | step: 1 | title: "Stock must be a whole number between 0 and 9999." |
| review | required | minlength: 1 | maxlength: 500 | title: "Review/comment up to 500 characters." |
| message | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| supportSubject | required | minlength: 1 | maxlength: 100 | title: "Subject up to 100 characters." |
| supportMessage | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| announcementTitle | required | minlength: 1 | maxlength: 100 | title: "Title up to 100 characters." |
| announcementMessage | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| cancellationReason | required | minlength: 1 | maxlength: 500 | title: "Cancellation reason up to 500 characters." |
| rejectionReason | required | minlength: 1 | maxlength: 500 | title: "Rejection reason up to 500 characters." |
| notes | optional | minlength: 1 | maxlength: 500 | title: "Notes up to 500 characters." |
| street | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Street/house number up to 100 characters." |
| addressLine1 | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line up to 100 characters." |
| addressLine2 | optional | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line 2 up to 100 characters." |
| addressLabel | optional | minlength: 1 | maxlength: 50 | title: "Address label up to 50 characters." |
| fullAddress | required | minlength: 1 | maxlength: 200 | title: "Address up to 200 characters." |
| promoCode | optional | minlength: 1 | maxlength: 50 | title: "Promo code up to 50 characters." |
| addressSelect | required | title: "Please select an address option." |

## Category Coverage

| Category | Fields Standardized |
|----------|---------------------|
| addressLine1 | 8 |
| addressSelect | 32 |
| announcementTitle | 1 |
| cancellationReason | 1 |
| description | 7 |
| email | 8 |
| firstName | 11 |
| fullName | 1 |
| lastName | 11 |
| message | 7 |
| middleName | 11 |
| moq | 2 |
| notes | 6 |
| password | 16 |
| phone | 14 |
| price | 3 |
| productDescription | 1 |
| productName | 2 |
| quantity | 3 |
| rejectionReason | 2 |
| review | 1 |
| shopName | 3 |
| supportSubject | 2 |
| username | 5 |
| **Total** | **158** |

## Field Inventory

| File | Line | Element ID | Tag | Category | Validation Rules Applied |
|------|------|------------|-----|----------|---------------------------|
| frontend/admin-backup.html | 438 | `chat-input` | input | message | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| frontend/admin-backup.html | 484 | `edit-user-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin-backup.html | 488 | `edit-user-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin-backup.html | 492 | `edit-user-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin-backup.html | 497 | `edit-user-fullname` | input | fullName | optional | minlength: 1 | maxlength: 100 | pattern: [A-Za-z\s]+ | title: "Up to 100 characters. Letters and spaces only." |
| frontend/admin-backup.html | 502 | `edit-user-username` | input | username | required | minlength: 3 | maxlength: 20 | pattern: [a-zA-Z0-9_]{3,20} | title: "3-20 characters, letters, numbers, and underscores only." |
| frontend/admin-backup.html | 506 | `edit-user-email` | input | email | type: email | required | minlength: 5 | maxlength: 100 | pattern: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | title: "Valid email address (max 100 characters)." |
| frontend/admin-backup.html | 512 | `edit-user-password` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/admin-backup.html | 521 | `edit-user-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/admin-backup.html | 525 | `edit-user-zone` | select | addressSelect | required | title: "Please select an address option." |
| frontend/admin-backup.html | 528 | `edit-user-province` | select | addressSelect | required | title: "Please select an address option." |
| frontend/admin-backup.html | 531 | `edit-user-city` | select | addressSelect | required | title: "Please select an address option." |
| frontend/admin-backup.html | 534 | `edit-user-barangay` | select | addressSelect | required | title: "Please select an address option." |
| frontend/admin-backup.html | 537 | `edit-user-street` | input | addressLine1 | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line up to 100 characters." |
| frontend/admin-backup.html | 561 | `create-user-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin-backup.html | 565 | `create-user-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin-backup.html | 569 | `create-user-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin-backup.html | 575 | `create-user-username` | input | username | required | minlength: 3 | maxlength: 20 | pattern: [a-zA-Z0-9_]{3,20} | title: "3-20 characters, letters, numbers, and underscores only." |
| frontend/admin-backup.html | 579 | `create-user-email` | input | email | type: email | required | minlength: 5 | maxlength: 100 | pattern: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | title: "Valid email address (max 100 characters)." |
| frontend/admin-backup.html | 589 | `create-user-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/admin-backup.html | 595 | `create-user-password` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/admin-backup.html | 630 | `edit-product-name` | input | productName | required | minlength: 1 | maxlength: 100 | pattern: [A-Za-z0-9\s\-_.&'’()]+ | title: "Up to 100 characters. Letters, numbers, spaces, and common symbols only." |
| frontend/admin-backup.html | 635 | `edit-product-price` | input | price | type: number | required | min: 0 | max: 99999 | step: 1 | title: "Price must be a whole number between 0 and 99999." |
| frontend/admin-backup.html | 648 | `edit-product-description` | textarea | productDescription | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| frontend/admin.html | 2784 | `announcement-title` | input | announcementTitle | required | minlength: 1 | maxlength: 100 | title: "Title up to 100 characters." |
| frontend/admin.html | 2788 | `announcement-message` | textarea | message | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| frontend/admin.html | 3199 | `chat-input` | input | message | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| frontend/admin.html | 3731 | `pe-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 3735 | `pe-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 3739 | `pe-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 3746 | `pe-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/admin.html | 3769 | `pp-new` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/admin.html | 3773 | `pp-confirm` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/admin.html | 3809 | `rejection-reason-input` | textarea | rejectionReason | required | minlength: 1 | maxlength: 500 | title: "Rejection reason up to 500 characters." |
| frontend/admin.html | 4155 | `edit-user-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 4160 | `edit-user-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 4165 | `edit-user-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 4172 | `edit-user-shopname` | input | shopName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z0-9\s\-_.&'’()]+ | title: "Up to 40 characters. Letters, numbers, spaces, and common symbols only." |
| frontend/admin.html | 4181 | `edit-user-username` | input | username | required | minlength: 3 | maxlength: 20 | pattern: [a-zA-Z0-9_]{3,20} | title: "3-20 characters, letters, numbers, and underscores only." |
| frontend/admin.html | 4188 | `edit-user-email` | input | email | type: email | required | minlength: 5 | maxlength: 100 | pattern: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | title: "Valid email address (max 100 characters)." |
| frontend/admin.html | 4210 | `edit-user-password` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/admin.html | 4225 | `edit-user-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/admin.html | 4233 | `edit-user-zone` | select | addressSelect | required | title: "Please select an address option." |
| frontend/admin.html | 4236 | `edit-user-province` | select | addressSelect | required | title: "Please select an address option." |
| frontend/admin.html | 4239 | `edit-user-city` | select | addressSelect | required | title: "Please select an address option." |
| frontend/admin.html | 4242 | `edit-user-barangay` | select | addressSelect | required | title: "Please select an address option." |
| frontend/admin.html | 4245 | `edit-user-street` | input | addressLine1 | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line up to 100 characters." |
| frontend/admin.html | 4287 | `create-user-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 4292 | `create-user-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 4299 | `create-user-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 4309 | `create-user-username` | input | username | required | minlength: 3 | maxlength: 20 | pattern: [a-zA-Z0-9_]{3,20} | title: "3-20 characters, letters, numbers, and underscores only." |
| frontend/admin.html | 4316 | `create-user-email` | input | email | type: email | required | minlength: 5 | maxlength: 100 | pattern: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | title: "Valid email address (max 100 characters)." |
| frontend/admin.html | 4332 | `create-user-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/admin.html | 4341 | `create-user-shopname` | input | shopName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z0-9\s\-_.&'’()]+ | title: "Up to 40 characters. Letters, numbers, spaces, and common symbols only." |
| frontend/admin.html | 4350 | `create-user-password` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/admin.html | 4713 | `reject-subscription-reason` | textarea | notes | optional | minlength: 1 | maxlength: 500 | title: "Notes up to 500 characters." |
| frontend/admin.html | 4740 | `expire-subscription-reason` | textarea | notes | optional | minlength: 1 | maxlength: 500 | title: "Notes up to 500 characters." |
| frontend/admin.html | 4766 | `rejection-reason` | textarea | rejectionReason | required | minlength: 1 | maxlength: 500 | title: "Rejection reason up to 500 characters." |
| frontend/admin.html | 5028 | `sa-user-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 5032 | `sa-user-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 5036 | `sa-user-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/admin.html | 5043 | `sa-user-username` | input | username | required | minlength: 3 | maxlength: 20 | pattern: [a-zA-Z0-9_]{3,20} | title: "3-20 characters, letters, numbers, and underscores only." |
| frontend/admin.html | 5047 | `sa-user-email` | input | email | type: email | required | minlength: 5 | maxlength: 100 | pattern: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | title: "Valid email address (max 100 characters)." |
| frontend/admin.html | 5056 | `sa-user-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/admin.html | 5079 | `sa-user-password` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/chat.html | 260 | `chat-input` | input | message | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| frontend/checkout.html | 654 | `checkout-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/checkout.html | 658 | `checkout-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/checkout.html | 662 | `checkout-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/checkout.html | 671 | `checkout-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/checkout.html | 679 | `special-instructions` | textarea | notes | optional | minlength: 1 | maxlength: 500 | title: "Notes up to 500 characters." |
| frontend/checkout.html | 789 | `floating-address-zone` | select | addressSelect | required | title: "Please select an address option." |
| frontend/checkout.html | 798 | `floating-address-province` | select | addressSelect | required | title: "Please select an address option." |
| frontend/checkout.html | 807 | `floating-address-city` | select | addressSelect | required | title: "Please select an address option." |
| frontend/checkout.html | 816 | `floating-address-barangay` | select | addressSelect | required | title: "Please select an address option." |
| frontend/checkout.html | 825 | `floating-address-street` | input | addressLine1 | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line up to 100 characters." |
| frontend/customer-account.html | 655 | `edit-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/customer-account.html | 659 | `edit-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/customer-account.html | 663 | `edit-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/customer-account.html | 673 | `edit-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/customer-account.html | 680 | `edit-zone` | select | addressSelect | required | title: "Please select an address option." |
| frontend/customer-account.html | 684 | `edit-province` | select | addressSelect | required | title: "Please select an address option." |
| frontend/customer-account.html | 688 | `edit-city` | select | addressSelect | required | title: "Please select an address option." |
| frontend/customer-account.html | 692 | `edit-barangay` | select | addressSelect | required | title: "Please select an address option." |
| frontend/customer-account.html | 696 | `edit-street` | input | addressLine1 | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line up to 100 characters." |
| frontend/customer-account.html | 736 | `new-password` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/customer-account.html | 745 | `confirm-password` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/customer-account.html | 986 | `support-chat-input` | input | message | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| frontend/customer-account.html | 1018 | `support-ticket-subject` | input | supportSubject | required | minlength: 1 | maxlength: 100 | title: "Subject up to 100 characters." |
| frontend/customer-account.html | 1023 | `support-ticket-description` | textarea | description | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| frontend/farmer.html | 2111 | `shop-name-input` | input | shopName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z0-9\s\-_.&'’()]+ | title: "Up to 40 characters. Letters, numbers, spaces, and common symbols only." |
| frontend/farmer.html | 2124 | `shop-description-input` | textarea | description | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| frontend/farmer.html | 2190 | `chat-input` | input | message | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| frontend/farmer.html | 2315 | `support-chat-input` | input | message | required | minlength: 1 | maxlength: 500 | title: "Message up to 500 characters." |
| frontend/farmer.html | 2449 | `pe-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/farmer.html | 2453 | `pe-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/farmer.html | 2457 | `pe-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/farmer.html | 2467 | `pe-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/farmer.html | 2496 | `pp-new` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/farmer.html | 2505 | `pp-confirm` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/farmer.html | 2842 | `shop-location-zone` | select | addressSelect | required | title: "Please select an address option." |
| frontend/farmer.html | 2849 | `shop-location-province` | select | addressSelect | required | title: "Please select an address option." |
| frontend/farmer.html | 2855 | `shop-location-city` | select | addressSelect | required | title: "Please select an address option." |
| frontend/farmer.html | 2862 | `shop-location-barangay` | select | addressSelect | required | title: "Please select an address option." |
| frontend/farmer.html | 2868 | `shop-location-street` | input | addressLine1 | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line up to 100 characters." |
| frontend/farmer.html | 2972 | `product-price` | input | price | type: number | required | min: 0 | max: 99999 | step: 1 | title: "Price must be a whole number between 0 and 99999." |
| frontend/farmer.html | 2978 | `product-moq` | input | moq | type: number | optional | min: 1 | max: 9999 | step: 1 | title: "MOQ must be a whole number between 1 and 9999." |
| frontend/farmer.html | 3009 | `available-description` | textarea | description | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| frontend/farmer.html | 3034 | `preorder-description` | textarea | description | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| frontend/farmer.html | 3183 | `edit-price` | input | price | type: number | required | min: 0 | max: 99999 | step: 1 | title: "Price must be a whole number between 0 and 99999." |
| frontend/farmer.html | 3188 | `edit-moq` | input | moq | type: number | optional | min: 1 | max: 9999 | step: 1 | title: "MOQ must be a whole number between 1 and 9999." |
| frontend/farmer.html | 3213 | `edit-available-description` | textarea | description | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| frontend/farmer.html | 3238 | `edit-preorder-description` | textarea | description | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| frontend/farmer.html | 3302 | `harvest-lifecycle-quantity` | input | quantity | type: number | required | min: 1 | max: 9999 | step: 1 | title: "Quantity must be a whole number between 1 and 9999." |
| frontend/farmer.html | 3332 | `harvest-fulfill-quantity` | input | quantity | type: number | required | min: 1 | max: 9999 | step: 1 | title: "Quantity must be a whole number between 1 and 9999." |
| frontend/farmer.html | 3412 | `product-location-zone` | select | addressSelect | required | title: "Please select an address option." |
| frontend/farmer.html | 3419 | `product-location-province` | select | addressSelect | required | title: "Please select an address option." |
| frontend/farmer.html | 3425 | `product-location-city` | select | addressSelect | required | title: "Please select an address option." |
| frontend/farmer.html | 3432 | `product-location-barangay` | select | addressSelect | required | title: "Please select an address option." |
| frontend/farmer.html | 3438 | `product-location-street` | input | addressLine1 | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line up to 100 characters." |
| frontend/farmer.html | 3504 | `request-product-name` | input | productName | required | minlength: 1 | maxlength: 100 | pattern: [A-Za-z0-9\s\-_.&'’()]+ | title: "Up to 100 characters. Letters, numbers, spaces, and common symbols only." |
| frontend/farmer.html | 3509 | `request-product-notes` | textarea | notes | optional | minlength: 1 | maxlength: 500 | title: "Notes up to 500 characters." |
| frontend/farmer.html | 3597 | `reschedule-reason-input` | textarea | notes | optional | minlength: 1 | maxlength: 500 | title: "Notes up to 500 characters." |
| frontend/farmer.html | 3663 | `support-ticket-subject` | input | supportSubject | required | minlength: 1 | maxlength: 100 | title: "Subject up to 100 characters." |
| frontend/farmer.html | 3668 | `support-ticket-description` | textarea | description | optional | minlength: 1 | maxlength: 500 | title: "Up to 500 characters." |
| frontend/index.html | 411 | `product-details-quantity` | input | quantity | type: number | required | min: 1 | max: 9999 | step: 1 | title: "Quantity must be a whole number between 1 and 9999." |
| frontend/index.html | 501 | `auth-password` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/index.html | 549 | `auth-email-register` | input | email | type: email | required | minlength: 5 | maxlength: 100 | pattern: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | title: "Valid email address (max 100 characters)." |
| frontend/index.html | 612 | `auth-password-register` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/index.html | 651 | `auth-password-confirm` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/index.html | 677 | `auth-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/index.html | 684 | `auth-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/index.html | 692 | `auth-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/index.html | 702 | `auth-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/index.html | 711 | `auth-zone` | select | addressSelect | required | title: "Please select an address option." |
| frontend/index.html | 714 | `auth-province` | select | addressSelect | required | title: "Please select an address option." |
| frontend/index.html | 717 | `auth-city` | select | addressSelect | required | title: "Please select an address option." |
| frontend/index.html | 720 | `auth-barangay` | select | addressSelect | required | title: "Please select an address option." |
| frontend/index.html | 723 | `auth-street` | input | addressLine1 | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line up to 100 characters." |
| frontend/index.html | 975 | `forgot-email` | input | email | type: email | required | minlength: 5 | maxlength: 100 | pattern: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | title: "Valid email address (max 100 characters)." |
| frontend/index.html | 1010 | `forgot-new-password` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/index.html | 1020 | `forgot-new-password-confirm` | input | password | type: password | required | minlength: 8 | maxlength: 64 | title: "At least 8 characters (max 64)." |
| frontend/index.html | 1057 | `floating-address-firstname` | input | firstName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/index.html | 1064 | `floating-address-middlename` | input | middleName | optional | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/index.html | 1071 | `floating-address-lastname` | input | lastName | required | minlength: 1 | maxlength: 40 | pattern: [A-Za-z\s]+ | title: "Up to 40 characters. Letters and spaces only." |
| frontend/index.html | 1080 | `floating-address-phone` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/index.html | 1089 | `floating-address-zone` | select | addressSelect | required | title: "Please select an address option." |
| frontend/index.html | 1098 | `floating-address-province` | select | addressSelect | required | title: "Please select an address option." |
| frontend/index.html | 1107 | `floating-address-city` | select | addressSelect | required | title: "Please select an address option." |
| frontend/index.html | 1116 | `floating-address-barangay` | select | addressSelect | required | title: "Please select an address option." |
| frontend/index.html | 1125 | `floating-address-street` | input | addressLine1 | required | minlength: 1 | maxlength: 100 | pattern: [a-zA-Z0-9\s,.#/-()]+ | title: "Address line up to 100 characters." |
| frontend/index.html | 1203 | `contact-name` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/index.html | 1207 | `contact-email` | input | email | type: email | required | minlength: 5 | maxlength: 100 | pattern: [a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,} | title: "Valid email address (max 100 characters)." |
| frontend/index.html | 1212 | `contact-subject` | input | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/index.html | 1216 | `contact-message` | textarea | phone | type: tel | required | minlength: 10 | maxlength: 12 | pattern: [0-9\s]{10,12} | title: "Enter 10-digit mobile number (e.g., 929 819 6629)." |
| frontend/orders.html | 570 | `order-rating-comment` | textarea | review | required | minlength: 1 | maxlength: 500 | title: "Review/comment up to 500 characters." |
| frontend/orders.html | 591 | `order-cancel-reason-input` | textarea | cancellationReason | required | minlength: 1 | maxlength: 500 | title: "Cancellation reason up to 500 characters." |
| frontend/request-product.html | 39 | `request-product-notes` | textarea | notes | optional | minlength: 1 | maxlength: 500 | title: "Notes up to 500 characters." |

## Notes

- The standardizer uses runtime DOM inspection and a MutationObserver so that dynamically inserted fields (e.g., product modals, chat messages) receive the same validation rules.
- Leading/trailing whitespace is trimmed on blur and before submission. Required fields cannot contain only whitespace.
- Numeric fields use whole-number limits per the user's specification: price 0-99999, quantity/MOQ/stock 0/1-9999.
- For dual-purpose fields like "Email or Username" (id="auth-email"), the standardizer is intentionally bypassed because the existing pattern already supports both formats.
