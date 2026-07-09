# Customer Edit Profile Save Blocker Analysis

## Summary

The `Customer Edit Profile | overall` Playwright E2E scenario failed because the `Save Changes` button click never submitted the form and `saveProfile()` was never called. The browser's HTML5 form validation blocked submission before any JavaScript could execute.

---

## Failed Scenario

- **Page / Form:** Customer Edit Profile (`customer-account.html`)
- **Test file:** `scripts/phone-e2e-runner.js` → `testCustomerEditProfile()`
- **Scenario:** Customer Edit Profile | overall
- **Result:** FAIL

## Error Details

**Error Message:**
```
page.waitForResponse: Timeout 30000ms exceeded while waiting for event "response"
```

**Expected Value:**
A PUT request to `/api/auth/profile` containing a valid 10-digit `phone` payload, e.g.:
```json
{ "phone": "9230105252", ... }
```

**Actual Value:**
No PUT request was sent. No response was captured. The form never submitted.

**Screenshot Path:**
```
D:\Codings\AgriCatch\scripts\phone-e2e-screenshots\customer-edit-error.png
```

**Stack Trace / Evidence File:**
```
D:\Codings\AgriCatch\scripts\profile-save-blocker-diag.json
```

---

## Browser Validation State (Playwright Diagnostics)

The form validity inspection was performed immediately before clicking **Save Changes**.

### `edit-profile-form.checkValidity()`
**Result:** `false`

### Field-by-Field Validity State

| Field | Value | `required` Attribute | `valid` | `valueMissing` | Validation Message |
|-------|-------|----------------------|---------|----------------|-------------------|
| `edit-firstname` | `Test` | `true` | `true` | `false` | — |
| `edit-middlename` | *(empty)* | `false` | `true` | `false` | — |
| `edit-lastname` | `Customer` | `true` | `true` | `false` | — |
| `edit-phone` | `923 010 5252` | `true` | `true` | `false` | — |
| `edit-zone` | *(empty)* | `true` | `false` | `true` | Please select an item in the list. |
| `edit-province` | *(empty)* | `false` | `true` | `false` | — |
| `edit-city` | *(empty)* | `false` | `true` | `false` | — |
| `edit-barangay` | *(empty)* | `false` | `true` | `false` | — |
| `edit-street` | *(empty)* | `true` | `false` | `true` | Please fill out this field. |

### Post-Click State

- `submitFired`: `false`  
- `submitDefaultPrevented`: `false`  
- `saveProfileCalled`: `false`  
- `saveProfileResult`: `null`
- `activeElement` after clicking Save: `edit-zone`

---

## Network Requests Observed

No `PUT /api/auth/profile` request was captured. Only the initial page-load `GET` requests were logged:

- `GET /api/auth/profile` — `200`  
- `GET /api/support-tickets/my` — `200`  
- `GET /api/messages/conversations` — `200`  
- `GET /api/farmers/me/verification-request` — `200`

All other `/api/auth/check-phone` or `/api/auth/profile` network activity is **absent** because the form was blocked by HTML5 validation before any handler could run.

---

## Browser Console Errors

No `console.error` or `pageerror` events were recorded by Playwright. No JavaScript exception occurred — the browser simply refused to submit the form because it was invalid.

---

## Root Cause

The failure was **not** caused by first name, last name, or phone validation. It was caused by **HTML5 `required` validation on the address fields `edit-zone` and `edit-street`**.

Because these two fields are empty and marked `required`, `form.checkValidity()` returns `false`. When the submit button is clicked, the browser performs HTML5 validation, focuses the first invalid field (`edit-zone`), and **does not fire a `submit` event**. As a result:

1. The `submit` event listener for `#edit-profile-form` in `customer-account.js` never executes.
2. `CustomerAccount.saveProfile()` is never called.
3. The phone-uniqueness pre-check to `/api/auth/check-phone` never runs.
4. The `PUT /api/auth/profile` request is never sent.

### Why `edit-zone` and `edit-street` are `required`

`customer-account.html` does **not** declare `required` on either `<select id="edit-zone">` or `<input id="edit-street">` in the static markup. The `required` attribute is added at runtime by `frontend/js/validation-standardizer.js`.

**Exact source lines causing the block:**

1. `frontend/js/validation-standardizer.js` line 322-324 — `detectCategory()` returns `"addressSelect"` for any `<select>` whose associated text matches `zone|province|city|barangay|region`:
   ```javascript
   if (tag === 'select') {
     if (/\b(zone|province|city|barangay|region)\b/.test(text)) return 'addressSelect';
     return null;
   }
   ```

2. `frontend/js/validation-standardizer.js` line 434 — `applyRule()` unconditionally marks every `"addressSelect"` element as `required`:
   ```javascript
   if (category === 'addressSelect') {
     el.setAttribute('required', 'required');
   }
   ```

3. `frontend/js/validation-standardizer.js` line 204-211 — `RULES.street` has `required: true`:
   ```javascript
   street: {
     type: 'text',
     required: true,
     minlength: 1,
     maxlength: 100,
     pattern: '[a-zA-Z0-9\\s,.#/-()]+',
     title: 'Street/house number up to 100 characters.'
   },
   ```

4. `frontend/js/validation-standardizer.js` line 397-400 — `applyRule()` copies `rule.required` to the DOM element:
   ```javascript
   if (rule.required !== undefined) {
     if (rule.required) el.setAttribute('required', 'required');
     else el.removeAttribute('required');
   }
   ```

5. `frontend/js/validation-standardizer.js` line 354 — `detectCategory()` classifies `edit-street` as `"street"` because the placeholder contains the word `"street"`:
   ```javascript
   if (/street/.test(text)) return 'street';
   ```

6. `frontend/customer-account.html` line 680-696 — the `edit-profile-form` is the parent form containing both `<select id="edit-zone">` and `<input id="edit-street">`.

7. `frontend/js/customer-account.js` line 1025 — the save handler is bound to the form's `submit` event:
   ```javascript
   document.getElementById('edit-profile-form')?.addEventListener('submit', (e) => this.saveProfile(e));
   ```

Because HTML5 validation prevents the `submit` event, `saveProfile()` (defined at line 512) never executes, so none of its return statements (lines 525-567) are reached, and no `fetch` call at line 585 is performed.

---

## Why `customer-account.js` Logic Is Bypassed

`saveProfile()` contains an optional-address branch (lines 562-572):

```javascript
let address = null;
const anyAddress = province || city || barangay || street;
if (anyAddress) {
  if (!province || !city || !barangay || !street) {
    this.showToast('Please complete all address fields: province, city, barangay, and street.', 'error');
    return;
  }
  ...
}
```

That logic treats address as optional when all address fields are empty. However, it is never reached because the HTML5 validation layer above it (introduced by `validation-standardizer.js`) makes `edit-zone` and `edit-street` required, so the browser blocks the submit event first.

---

## Fix Direction (No Code Changes Made Yet)

To make `Customer Edit Profile` submittable without an address, the runtime `required` attributes on `edit-zone` and `edit-street` must be reconciled with the business rule that address is optional in `saveProfile()`.

Two consistent paths exist:

1. **Make address truly optional on the customer edit profile form** by removing the `required` attribute from `edit-zone` and `edit-street` (e.g. update `validation-standardizer.js` rules or special-case this form).
2. **Make address mandatory in `saveProfile()`** so the JavaScript validation matches the HTML5 validation.

The currently failing test only provides `first_name`, `last_name`, and `phone`. Until the address field conflict is resolved, any attempt to submit the form without a zone and street will fail at the browser validation layer.

---

## Evidence Files

- `scripts/phone-e2e-results.json`
- `scripts/profile-save-blocker-diag.json`
- `scripts/phone-e2e-screenshots/customer-edit-error.png`
- `scripts/phone-e2e-screenshots/customer-edit-blocker-diag.png`
