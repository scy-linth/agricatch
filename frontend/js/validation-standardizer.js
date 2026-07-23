/**
 * AgriCatch Frontend Validation Standardizer
 * ------------------------------------------------
 * Centralizes HTML5 + JavaScript validation for all user-editable fields
 * on the frontend. The rules mirror the Register page baseline.
 *
 * Scope:  HTML/JS frontend only. No backend/database/API changes.
 */
(function () {
  'use strict';

  const RULES = {
    firstName: {
      type: 'text',
      required: true,
      minlength: 1,
      maxlength: 40,
      pattern: '[A-Za-z\\s]+',
      title: 'Up to 40 characters. Letters and spaces only.'
    },
    middleName: {
      type: 'text',
      required: false,
      minlength: 1,
      maxlength: 40,
      pattern: '[A-Za-z\\s]+',
      title: 'Up to 40 characters. Letters and spaces only.'
    },
    lastName: {
      type: 'text',
      required: true,
      minlength: 1,
      maxlength: 40,
      pattern: '[A-Za-z\\s]+',
      title: 'Up to 40 characters. Letters and spaces only.'
    },
    fullName: {
      type: 'text',
      required: false,
      minlength: 1,
      maxlength: 100,
      pattern: '[A-Za-z\\s]+',
      title: 'Up to 100 characters. Letters and spaces only.'
    },
    username: {
      type: 'text',
      required: true,
      minlength: 3,
      maxlength: 20,
      pattern: '[a-zA-Z0-9_]{3,20}',
      title: '3-20 characters, letters, numbers, and underscores only.'
    },
    email: {
      type: 'email',
      required: true,
      minlength: 5,
      maxlength: 100,
      pattern: '[a-zA-Z0-9._%+\\-]+@[a-zA-Z0-9.\\-]+\\.[a-zA-Z]{2,}',
      title: 'Valid email address (max 100 characters).'
    },
    password: {
      type: 'password',
      required: true,
      minlength: 8,
      maxlength: 64,
      title: 'At least 8 characters (max 64).'
    },
    phone: {
      type: 'tel',
      required: true,
      minlength: 10,
      maxlength: 12,
      pattern: '[0-9\\s]{10,12}',
      title: 'Enter 10-digit mobile number (e.g., 929 819 6629).'
    },
    shopName: {
      type: 'text',
      required: true,
      minlength: 1,
      maxlength: 40,
      pattern: '[A-Za-z0-9\\s\\-_.&\'’()]+',
      title: 'Up to 40 characters. Letters, numbers, spaces, and common symbols only.'
    },
    productName: {
      type: 'text',
      required: true,
      minlength: 1,
      maxlength: 100,
      pattern: '[A-Za-z0-9\\s\\-_.&\'’()]+',
      title: 'Up to 100 characters. Letters, numbers, spaces, and common symbols only.'
    },
    productDescription: {
      tag: 'textarea',
      required: false,
      minlength: 1,
      maxlength: 500,
      title: 'Up to 500 characters.'
    },
    description: {
      tag: 'textarea',
      required: false,
      minlength: 1,
      maxlength: 500,
      title: 'Up to 500 characters.'
    },
    price: {
      type: 'number',
      required: true,
      min: 0,
      max: 99999,
      step: 1,
      inputmode: 'numeric',
      title: 'Price must be a whole number between 0 and 99999.'
    },
    quantity: {
      type: 'number',
      required: true,
      min: 1,
      max: 9999,
      step: 1,
      inputmode: 'numeric',
      title: 'Quantity must be a whole number between 1 and 9999.'
    },
    moq: {
      type: 'number',
      required: false,
      min: 1,
      max: 9999,
      step: 1,
      inputmode: 'numeric',
      title: 'MOQ must be a whole number between 1 and 9999.'
    },
    stock: {
      type: 'number',
      required: true,
      min: 0,
      max: 9999,
      step: 1,
      inputmode: 'numeric',
      title: 'Stock must be a whole number between 0 and 9999.'
    },
    review: {
      tag: 'textarea',
      required: true,
      minlength: 1,
      maxlength: 500,
      title: 'Review/comment up to 500 characters.'
    },
    message: {
      required: true,
      minlength: 1,
      maxlength: 500,
      title: 'Message up to 500 characters.'
    },
    supportSubject: {
      type: 'text',
      required: true,
      minlength: 1,
      maxlength: 100,
      title: 'Subject up to 100 characters.'
    },
    supportMessage: {
      tag: 'textarea',
      required: true,
      minlength: 1,
      maxlength: 500,
      title: 'Message up to 500 characters.'
    },
    announcementTitle: {
      type: 'text',
      required: true,
      minlength: 1,
      maxlength: 100,
      title: 'Title up to 100 characters.'
    },
    announcementMessage: {
      tag: 'textarea',
      required: true,
      minlength: 1,
      maxlength: 500,
      title: 'Message up to 500 characters.'
    },
    cancellationReason: {
      tag: 'textarea',
      required: true,
      minlength: 1,
      maxlength: 500,
      title: 'Cancellation reason up to 500 characters.'
    },
    rejectionReason: {
      tag: 'textarea',
      required: true,
      minlength: 1,
      maxlength: 500,
      title: 'Rejection reason up to 500 characters.'
    },
    notes: {
      tag: 'textarea',
      required: false,
      minlength: 1,
      maxlength: 500,
      title: 'Notes up to 500 characters.'
    },
    street: {
      type: 'text',
      required: true,
      minlength: 1,
      maxlength: 100,
      pattern: '[a-zA-Z0-9\\s,./#()-]+',
      title: 'Street/house number up to 100 characters.'
    },
    addressLine1: {
      type: 'text',
      required: true,
      minlength: 1,
      maxlength: 100,
      pattern: '[a-zA-Z0-9\\s,./#()-]+',
      title: 'Address line up to 100 characters.'
    },
    addressLine2: {
      type: 'text',
      required: false,
      minlength: 1,
      maxlength: 100,
      pattern: '[a-zA-Z0-9\\s,./#()-]+',
      title: 'Address line 2 up to 100 characters.'
    },
    addressLabel: {
      type: 'text',
      required: false,
      minlength: 1,
      maxlength: 50,
      title: 'Address label up to 50 characters.'
    },
    fullAddress: {
      type: 'text',
      required: true,
      minlength: 1,
      maxlength: 200,
      title: 'Address up to 200 characters.'
    },
    promoCode: {
      type: 'text',
      required: false,
      minlength: 1,
      maxlength: 50,
      title: 'Promo code up to 50 characters.'
    },
    addressSelect: {
      required: true,
      title: 'Please select an address option.'
    }
  };

  const SKIP_ID_PATTERNS = [
    'search', 'filter', 'sort', 'query', 'global-', 'category-', 'status-', 'role-', 'action-', 'entity-', 'actor-',
    'session-', 'auto-', 'entries-', 'per-page', 'verification-', 'verification', 'theme-', 'mode-', 'recaptcha',
    'g-recaptcha', 'captcha', 'csrf', 'token', 'otp', '-otp', 'code', '-code', 'verify', 'hidden', 'page', 'limit',
    'offset', 'redirect', 'next', 'prev', 'tab-', 'current', 'selected', 'uuid', 'guid', 'type-', 'unit', 'slug', 'img-',
    'image', 'photo', 'avatar', 'banner', 'url', 'link', 'color', 'font', 'size', 'view-', 'layout', 'template', 'config-',
    'setting-', 'settings-', 'timezone', 'locale', 'currency', 'language', 'country', 'date-', 'from', 'to', 'start', 'end',
    'min-', 'max-', 'direction', 'preview', 'display', 'readonly', 'disabled', 'hidden-', 'setting_', 'setting-', 'am-',
    'logs-', 'new-pay-', 'pay-', 'catalog-', 'category', 'new-category', 'edit-category', 'new-catalog', 'edit-catalog',
    'unit-', 'delivery-fee', 'discount', 'rate-limit', 'retention', 'max-records', 'retention', 'monthly-price', 'price-'
  ];

  const SKIP_TAG_PATTERNS = ['search', 'filter', 'find', 'sort', 'query', 'select', 'choose'];

  function isEditableField(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    const tag = el.tagName.toLowerCase();
    const type = (el.getAttribute('type') || 'text').toLowerCase();

    if (el.hasAttribute('readonly') || el.readOnly) return false;
    if (el.hasAttribute('disabled') && el.disabled) return false;
    if (type === 'hidden' || type === 'button' || type === 'submit' || type === 'reset' || type === 'file') return false;
    if (type === 'checkbox' || type === 'radio') return false;
    if (tag === 'select' && !el.id && !el.name) return false;

    const idName = (el.id || '') + ' ' + (el.getAttribute('name') || '');
    const idLower = idName.toLowerCase();

    if (SKIP_ID_PATTERNS.some(p => idLower.includes(p))) return false;

    const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
    if (SKIP_TAG_PATTERNS.some(p => placeholder.includes(p))) return false;

    if (idLower.includes('address') && (idLower.includes('preview') || idLower.includes('full') || idLower.includes('display'))) return false;

    return tag === 'input' || tag === 'textarea' || tag === 'select';
  }

  function getLabelText(el) {
    const id = el.id;
    if (id) {
      const label = document.querySelector('label[for="' + CSS.escape(id) + '"]');
      if (label) return label.textContent || '';
    }
    const parent = el.closest('.form-group, .col, .row, .mb-3, .form-floating');
    if (parent) {
      const label = parent.querySelector('label');
      if (label) return label.textContent || '';
    }
    return el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
  }

  function getFieldText(el) {
    return (
      (el.id || '') + ' ' +
      (el.getAttribute('name') || '') + ' ' +
      (el.getAttribute('placeholder') || '') + ' ' +
      (el.getAttribute('aria-label') || '') + ' ' +
      getLabelText(el)
    ).toLowerCase();
  }

  function detectCategory(el) {
    const tag = el.tagName.toLowerCase();
    const text = getFieldText(el);
    const type = (el.getAttribute('type') || 'text').toLowerCase();

    if (tag === 'select') {
      if (/\b(zone|province|city|barangay|region)\b/.test(text)) return 'addressSelect';
      return null;
    }

    if (type === 'number') {
      if (/price/.test(text) && !/suggest|preview|fee|discount/.test(text)) return 'price';
      if (/moq|minimum[-_ ]?order|min[-_ ]?order/.test(text)) return 'moq';
      if (/stock|stocks/.test(text)) return 'stock';
      if (/quantity|qty/.test(text)) return 'quantity';
      return null;
    }

    if (type === 'password' || (type === 'text' && /new[-_ ]?password|confirm[-_ ]?password|forgot[-_ ]?password|password[-_ ]?confirm|pp[-_ ]/.test(text))) return 'password';
    if (type === 'text' && /email/.test(text) && /username/.test(text)) return null;
    if (type === 'email' || (type === 'text' && /email/.test(text) && !/or\s+username/.test(text))) return 'email';
    if (/username/.test(text)) return 'username';

    if (/(first[-_ ]?name|firstname)/.test(text)) return 'firstName';
    if (/(middle[-_ ]?name|middlename)/.test(text)) return 'middleName';
    if (/(last[-_ ]?name|lastname)/.test(text)) return 'lastName';
    if (/full[-_ ]?name|fullname/.test(text)) return 'fullName';
    if (/shop[-_ ]?name|shopname/.test(text)) return 'shopName';

    if (/(product[-_ ]?name|productname)/.test(text)) return 'productName';
    if (/(product[-_ ]?description|productdescription)/.test(text)) return 'productDescription';
    if (tag === 'textarea' && /description|desc/.test(text) && !/category/.test(text) && !/catalog/.test(text)) return 'description';

    if (/(street|house[-_ ]?no|building|address[-_ ]?line1|addressline1|address[-_ ]?line[-_ ]?1)/.test(text)) return 'addressLine1';
    if (/(address[-_ ]?line2|addressline2|address[-_ ]?line[-_ ]?2)/.test(text)) return 'addressLine2';
    if (/(full[-_ ]?address|address[-_ ]?full)/.test(text)) return 'fullAddress';
    if (/(address[-_ ]?label|label)/.test(text) && /address/.test(text)) return 'addressLabel';
    if (/street/.test(text)) return 'street';

    if (/(phone|mobile|contact[-_ ]?(number|no|num))\b/.test(text)) return 'phone';

    if (tag === 'textarea') {
      if (/review|comment|feedback/.test(text)) return 'review';
      if (/support[-_ ]?message|ticket[-_ ]?message|message/.test(text)) return 'message';
      if (/support[-_ ]?subject|ticket[-_ ]?subject|subject/.test(text)) return 'supportSubject';
      if (/announcement[-_ ]?message|broadcast[-_ ]?message/.test(text)) return 'announcementMessage';
      if (/announcement[-_ ]?title|broadcast[-_ ]?title|title/.test(text)) return 'announcementTitle';
      if (/cancel[-_ ]?reason|cancellation[-_ ]?reason/.test(text)) return 'cancellationReason';
      if (/reject[-_ ]?reason|rejection[-_ ]?reason/.test(text)) return 'rejectionReason';
      if (/note|special[-_ ]?instruction|remark/.test(text)) return 'notes';
      if (/reason/.test(text) && !/search/.test(text)) return 'notes';
      return 'message';
    }

    if (type === 'text') {
      if (/support[-_ ]?subject|ticket[-_ ]?subject|subject/.test(text)) return 'supportSubject';
      if (/announcement[-_ ]?title|broadcast[-_ ]?title/.test(text)) return 'announcementTitle';
      if (/promo|coupon|voucher/.test(text)) return 'promoCode';
      if (/message|chat/.test(text)) return 'message';
    }

    return null;
  }

  function applyRule(el, category) {
    const rule = RULES[category];
    if (!rule) return;

    const tag = el.tagName.toLowerCase();
    if (rule.tag && rule.tag !== tag) return;

    if (rule.type && tag === 'input') {
      const currentType = (el.getAttribute('type') || 'text').toLowerCase();
      if (currentType !== 'password' && currentType !== 'email') {
        el.setAttribute('type', rule.type);
      } else if (category !== 'password' && category !== 'email') {
        el.setAttribute('type', rule.type);
      }
    }

    if (rule.required !== undefined) {
      if (rule.required) el.setAttribute('required', 'required');
      else el.removeAttribute('required');
    }

    if (rule.minlength !== undefined && tag !== 'select') {
      el.setAttribute('minlength', String(rule.minlength));
    }

    if (rule.maxlength !== undefined && tag !== 'select') {
      el.setAttribute('maxlength', String(rule.maxlength));
    }

    if (rule.pattern !== undefined && tag !== 'select') {
      el.setAttribute('pattern', rule.pattern);
    }

    if (rule.title !== undefined) {
      el.setAttribute('title', rule.title);
    }

    if (rule.min !== undefined && tag === 'input') {
      el.setAttribute('min', String(rule.min));
    }

    if (rule.max !== undefined && tag === 'input') {
      el.setAttribute('max', String(rule.max));
    }

    if (rule.step !== undefined && tag === 'input') {
      el.setAttribute('step', String(rule.step));
    }

    if (rule.inputmode !== undefined && tag === 'input') {
      el.setAttribute('inputmode', rule.inputmode);
    }

    if (category === 'addressSelect') {
      el.setAttribute('required', 'required');
    }

    el.setAttribute('data-validation-category', category);
    if (!el.classList.contains('ac-validated')) {
      el.classList.add('ac-validated');
    }
  }

  function normalizeWhitespace(el) {
    if (el.hasAttribute('readonly') || el.hasAttribute('disabled')) return;
    let value = el.value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (value !== trimmed) el.value = trimmed;
      if (el.hasAttribute('required') && trimmed === '') {
        el.setCustomValidity('This field is required and cannot contain only spaces.');
      } else {
        el.setCustomValidity('');
      }
    }
  }

  function processElement(el) {
    if (!isEditableField(el)) return;
    if (el.closest && el.closest('.contact-form')) return;
    const category = detectCategory(el);
    if (category) applyRule(el, category);

    if (el.getAttribute('data-ac-validation-bound') !== 'true') {
      el.addEventListener('blur', function () {
        normalizeWhitespace(el);
      });
      el.addEventListener('input', function () {
        if (el.hasAttribute('required') && el.value.trim() === '') {
          el.setCustomValidity('This field is required and cannot contain only spaces.');
        } else {
          el.setCustomValidity('');
        }
      });
      el.setAttribute('data-ac-validation-bound', 'true');
    }
  }

  function processNode(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches('input, textarea, select')) processElement(node);
      node.querySelectorAll('input, textarea, select').forEach(processElement);
    }
  }

  function init() {
    processNode(document.body);

    const observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.type === 'attributes') {
          processElement(mutation.target);
        } else {
          mutation.addedNodes.forEach(function (node) {
            if (node.nodeType === Node.ELEMENT_NODE) processNode(node);
          });
        }
      });
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'class', 'id', 'name'] });
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'class', 'id', 'name'] });
      });
    }

    document.addEventListener('submit', function (e) {
      const form = e.target;
      if (!form || form.tagName.toLowerCase() !== 'form') return;
      const fields = form.querySelectorAll('input, textarea, select');
      let invalid = false;
      fields.forEach(function (field) {
        if (field.hasAttribute('data-validation-category')) {
          normalizeWhitespace(field);
        }
      });
      if (!form.checkValidity()) invalid = true;
      if (invalid) {
        e.preventDefault();
        e.stopPropagation();
        form.reportValidity();
      }
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
