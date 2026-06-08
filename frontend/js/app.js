// Agriculture Market Frontend JavaScript

// Use a tiny inlined 1x1 GIF as a lightweight placeholder to avoid external requests
// Use the project's resend logo as the default placeholder so Cloudinary or external services aren't called
window.__PLACEHOLDER_IMAGE__ = '/images/resendlogo.png';

class AgricultureMarket {
    // ...existing code...
    constructor() {
        // Determine environment and API base
        const host = window.location.hostname;
        const isCustomFrontendHost = host === 'agricatch.store' ||
                     host === 'www.agricatch.store' ||
                     host.includes('agricatch.store') ||
                     host === 'agricatch.page.dev';
        const isRenderHost = host === 'agricatch.onrender.com';

        // Use Render API directly for custom frontend hosts.
        // This avoids hard dependency on api.agricatch.store TLS/proxy setup.
        this.apiBase = isCustomFrontendHost
            ? 'https://agricatch.onrender.com/api'
            : (isRenderHost ? '/api' : 'http://localhost:3000/api');

        // Expose resolved API base globally so other page scripts can reuse it
        try { window.API_BASE = this.apiBase; } catch (e) {}

        // Dev host detection for local-only debug endpoints
        this.isDevHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        // Set to true if you run a local dev agent on port 7242
        this.enableDevAgent = false;
        this.token = this.normalizeAuthToken(localStorage.getItem('token'));
        if (this.token) {
            try { localStorage.setItem('token', this.token); } catch (e) {}
        } else {
            try { localStorage.removeItem('token'); } catch (e) {}
        }
        this.sessionId = this.getOrCreateSessionId();
        this.currentPage = 1;
        this.currentCategory = '';
        this.currentSearch = '';
        this.currentSort = 'latest';
        // Unified auth flow state
        this.selectedRole = null; // 'farmer', 'customer', or 'staff'
        this.authMode = null; // 'login' or 'register'
        this.pendingCheckout = false; // Track if auth was triggered from checkout
        this.returnUrl = null; // For deep link preservation
        // OTP state
        this.otpSent = false;
        this.otpVerified = false;
        this.otpEmail = null;

        // Forgot password state
        this.forgotEmail = null;
        this.forgotOtp = null;
        this.forgotCooldownTimer = null;
        this.forgotCooldownRemaining = 0;
        // Registration step state
        this.registrationStep = 1;
        this.maxRegistrationSteps = 4;
        this.isLoading = false; // For loading animations
        this._authFocusTrapHandler = null;
        this._authLastFocusedElement = null;
        this.recaptchaWidgetIds = { authLogin: null, authRegister: null, forgot: null };

        try { window.agriCatchApp = this; } catch (e) {}

        this.init();
    }

    // Cache management for delivery fee
    getCachedDeliveryFee() {
        const cached = localStorage.getItem('cached_delivery_fee');
        const timestamp = localStorage.getItem('cached_delivery_fee_timestamp');
        
        if (!cached || !timestamp) return null;
        
        const cacheAge = Date.now() - parseInt(timestamp);
        const CACHE_TTL = 60 * 60 * 1000; // 1 hour
        
        if (cacheAge > CACHE_TTL) {
            // Cache expired
            localStorage.removeItem('cached_delivery_fee');
            localStorage.removeItem('cached_delivery_fee_timestamp');
            return null;
        }
        
        return parseFloat(cached);
    }

    setCachedDeliveryFee(value) {
        localStorage.setItem('cached_delivery_fee', value.toString());
        localStorage.setItem('cached_delivery_fee_timestamp', Date.now().toString());
    }

    async fetchDeliveryFee() {
        try {
            const response = await fetch(`${this.apiBase}/settings/delivery-fee`);
            if (response.ok) {
                const data = await response.json();
                this.setCachedDeliveryFee(data.delivery_fee);
                return data.delivery_fee;
            }
        } catch (error) {
            console.error('Error fetching delivery fee:', error);
        }
        // Fallback to cached or default
        return this.getCachedDeliveryFee() || 35;
    }

    getDeliveryFee() {
        const cached = this.getCachedDeliveryFee();
        if (cached !== null) return cached;
        
        // Fetch async and return default in the meantime
        this.fetchDeliveryFee();
        return 35;
    }

    fmtNumber(value, options) {
        try {
            if (window.FormatUtil && typeof window.FormatUtil.number === 'function') {
                return window.FormatUtil.number(value, options);
            }
        } catch (_) {
            // ignore
        }
        const n = Number(value);
        if (!Number.isFinite(n)) return '0';
        return String(n);
    }

    fmtCurrency(value, options) {
        try {
            if (window.FormatUtil && typeof window.FormatUtil.currency === 'function') {
                return window.FormatUtil.currency(value, options);
            }
        } catch (_) {
            // ignore
        }
        const n = Number(value);
        return `₱${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
    }

    escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    formatPhoneInputValue(value) {
        let digits = String(value || '').replace(/\D/g, '');
        if (digits.startsWith('0')) digits = digits.slice(1);
        digits = digits.slice(0, 10);
        if (digits.length <= 3) return digits;
        if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
        return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }

    deriveNameParts(profile = {}) {
        const explicit = {
            firstName: String(profile.first_name || '').trim(),
            middleName: String(profile.middle_name || '').trim(),
            lastName: String(profile.last_name || '').trim()
        };
        if (explicit.firstName || explicit.middleName || explicit.lastName) {
            return explicit;
        }

        const tokens = String(profile.full_name || '').trim().split(/\s+/).filter(Boolean);
        if (tokens.length <= 1) {
            return { firstName: tokens[0] || '', middleName: '', lastName: '' };
        }

        return {
            firstName: tokens[0] || '',
            middleName: tokens.slice(1, -1).join(' '),
            lastName: tokens[tokens.length - 1] || ''
        };
    }

    waitForPsgc(timeoutMs = 2500) {
        if (window.PSGC) return Promise.resolve(window.PSGC);
        return new Promise((resolve) => {
            const start = Date.now();
            const timer = window.setInterval(() => {
                if (window.PSGC) {
                    window.clearInterval(timer);
                    resolve(window.PSGC);
                    return;
                }
                if (Date.now() - start >= timeoutMs) {
                    window.clearInterval(timer);
                    resolve(null);
                }
            }, 100);
        });
    }

    setPageScrollLocked(locked) {
        try {
            const docEl = document.documentElement;
            const body = document.body;
            if (!docEl || !body) return;

            if (locked) {
                if (this._pageScrollLocked) return;
                this._pageScrollLocked = true;
                this._lockedScrollY = window.scrollY || window.pageYOffset || 0;
                docEl.classList.add('modal-open');
                body.classList.add('modal-open');
                body.style.position = 'fixed';
                body.style.top = `-${this._lockedScrollY}px`;
                body.style.width = '100%';
                return;
            }

            // Keep scroll locked if another (non-product) modal is still open.
            const otherModalOpen = !!document.querySelector('.modal.active');
            if (otherModalOpen) return;

            if (!this._pageScrollLocked) return;
            this._pageScrollLocked = false;

            docEl.classList.remove('modal-open');
            body.classList.remove('modal-open');
            body.style.position = '';
            body.style.top = '';
            body.style.width = '';

            const restoreY = this._lockedScrollY || 0;
            this._lockedScrollY = 0;
            const prevBehavior = docEl.style.scrollBehavior;
            docEl.style.scrollBehavior = 'auto';
            window.scrollTo(0, restoreY);
            setTimeout(() => {
                docEl.style.scrollBehavior = prevBehavior || '';
            }, 0);
        } catch (e) {
            // Best-effort only
        }
    }

    init() {
        try {
            console.log('AgriCatch app initialized');
            try {
                const navEntries = window.performance?.getEntriesByType?.('navigation') || [];
                const navType = navEntries[0]?.type;
                const isReload = navType === 'reload';
                const isLanding = window.location.pathname === '/' || window.location.pathname.includes('index.html');
                if (isReload && isLanding) {
                    if (window.location.hash) {
                        window.history.replaceState({}, '', window.location.pathname + window.location.search);
                    }
                    const htmlEl = document.documentElement;
                    const prevBehavior = htmlEl.style.scrollBehavior;
                    htmlEl.style.scrollBehavior = 'auto';
                    window.scrollTo(0, 0);
                    setTimeout(() => {
                        htmlEl.style.scrollBehavior = prevBehavior || '';
                    }, 0);
                }
            } catch (_) {}
            // #region agent log (dev only)
            if (this.isDevHost && this.enableDevAgent) {
                fetch('http://127.0.0.1:7242/ingest/edada99e-03b1-40b7-84f1-7a3e6b30377c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:15',message:'App initialization started',data:{apiBase:this.apiBase,hasToken:!!this.token},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'E'})}).catch(()=>{});
            }
            // #endregion

            // Wake up the Render server immediately when user lands on the site
            try {
                this.wakeUpServer();
            } catch (error) {
                console.error('Error waking up server:', error);
            }

            this.setupEventListeners();
            this.checkAuthStatus();
            this.loadProductCategories();
            
            // Load products - must be independent of registration state
            try {
                this.loadProducts();
            } catch (error) {
                console.error('Error loading products in init:', error);
            }
            try {
                this.loadFeaturedProducts();
            } catch (error) {
                console.error('Error loading featured products in init:', error);
            }
            
            this.updateCartCount();
            this.loadNotifications();
            if (this.token) {
                this.updateOrdersCount();
            }

            // Ensure active nav link is calculated after layout and media load.
            // Some elements (hero video/image) can change section heights after initial JS runs,
            // so re-run active link detection after a short delay and on window load/resize.
            setTimeout(() => this.updateActiveNavLink(), 300);
            requestAnimationFrame(() => this.updateActiveNavLink());
            window.addEventListener('load', () => this.updateActiveNavLink());
            window.addEventListener('resize', () => {
                // Debounce resize
                clearTimeout(this._resizeNavTimeout);
                this._resizeNavTimeout = setTimeout(() => this.updateActiveNavLink(), 150);
            });
            // Update when hash changes (clicking footer links or manual hash changes)
            window.addEventListener('hashchange', () => this.updateActiveNavLink());
            this.renderRecaptchaWidgets();
        } catch (error) {
            console.error('Error during app initialization:', error);
            // Try to at least load products even if other things fail
            try {
                this.loadProducts();
            } catch (loadError) {
                console.error('Error loading products:', loadError);
            }
        }
        
        // Check for ?login=1 query parameter to auto-open auth flow
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('login') === '1') {
            const returnUrl = urlParams.get('returnUrl');
            if (returnUrl) {
                this.returnUrl = decodeURIComponent(returnUrl);
            }
            const roleParam = urlParams.get('role');
            const role = roleParam === 'admin' ? 'staff' : roleParam;
            const mode = urlParams.get('mode');
            if (role && mode) {
                setTimeout(() => {
                    this.openAuthFlow({ role, mode, returnUrl: this.returnUrl });
                }, 100);
            } else {
                // Open auth modal (login; account type is auto-detected)
                setTimeout(() => {
                    this.openAuthFlow({ returnUrl: this.returnUrl });
                }, 100);
            }
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }

        // Resume context when returning from chat/orders
        const resumeProductId = Number(urlParams.get('openProductId') || 0);
        const resumeScrollY = Number(urlParams.get('resumeScrollY'));
        const fromOrdersQuery = urlParams.get('fromOrders') === '1';
        const sessionResumeScrollY = Number(sessionStorage.getItem('resumeScrollYFromOrders') || NaN);
        const hasSessionResume = Number.isFinite(sessionResumeScrollY) && sessionResumeScrollY >= 0;
        const effectiveResumeScrollY = (Number.isFinite(resumeScrollY) && resumeScrollY >= 0)
            ? resumeScrollY
            : (hasSessionResume ? sessionResumeScrollY : NaN);

        const hasResumeParams = urlParams.has('openProductId') || urlParams.has('resumeScrollY') || fromOrdersQuery;
        if (Number.isFinite(effectiveResumeScrollY) && effectiveResumeScrollY >= 0) {
            setTimeout(() => {
                window.scrollTo({ top: effectiveResumeScrollY, behavior: 'auto' });
            }, 60);
        }
        if (resumeProductId > 0) {
            setTimeout(() => {
                this.showProductDetails(resumeProductId);
            }, 220);
        }
        if (hasResumeParams) {
            urlParams.delete('openProductId');
            urlParams.delete('resumeScrollY');
            urlParams.delete('fromOrders');
            const nextQuery = urlParams.toString();
            // Preserve the current app section hash using getCurrentSectionHash to avoid unexpectedly jumping to another section (e.g., #about)
            const currentHash = (typeof this.getCurrentSectionHash === 'function') ? this.getCurrentSectionHash() : (window.location.hash || '');
            const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${currentHash}`;
            window.history.replaceState({}, '', nextUrl);
        }
        if (hasSessionResume || fromOrdersQuery) {
            sessionStorage.removeItem('resumeScrollYFromOrders');
        }

        // #region agent log (dev only)
        if (this.isDevHost && this.enableDevAgent) {
            fetch('http://127.0.0.1:7242/ingest/edada99e-03b1-40b7-84f1-7a3e6b30377c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:21',message:'App initialization completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'E'})}).catch(()=>{});
        }
        // #endregion

        // Mobile bug fix: always remove loading class and hide loading screen after init
        document.body.classList.remove('loading');
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
        }
    }

    // Session management for guest users
    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('sessionId');
        if (!sessionId) {
            sessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('sessionId', sessionId);
        }
        return sessionId;
    }

    // Handle contact form submission
    async handleContactForm(e) {
        e.preventDefault();
        
        const name = document.getElementById('contact-name').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const subject = document.getElementById('contact-subject').value.trim();
        const message = document.getElementById('contact-message').value.trim();
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Validate fields
        if (!name || !email || !subject || !message) {
            this.showMessage('Please fill in all fields', 'error');
            // Highlight empty fields
            if (!name) document.getElementById('contact-name').focus();
            else if (!email) document.getElementById('contact-email').focus();
            else if (!subject) document.getElementById('contact-subject').focus();
            else if (!message) document.getElementById('contact-message').focus();
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            document.getElementById('contact-email').focus();
            return;
        }
        
        // Validate message length
        if (message.length < 10) {
            this.showMessage('Please enter a message with at least 10 characters', 'error');
            document.getElementById('contact-message').focus();
            return;
        }
        
        // Disable submit button and show loading
        if (submitBtn) {
            submitBtn.disabled = true;
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending Message...';
            submitBtn.style.opacity = '0.7';
            submitBtn.style.cursor = 'not-allowed';
            
            try {
                const response = await fetch(`${this.apiBase}/contact`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ name, email, subject, message })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    // Success - clear form and show success message
                    document.getElementById('contact-name').value = '';
                    document.getElementById('contact-email').value = '';
                    document.getElementById('contact-subject').value = '';
                    document.getElementById('contact-message').value = '';
                    
                    // Show success message with better UX
                    this.showMessage('✅ ' + (data.message || 'Thank you for contacting us! We will get back to you soon.'), 'success');
                    
                    // Scroll to top of contact section to show success message
                    setTimeout(() => {
                        const contactSection = document.getElementById('contact');
                        if (contactSection) {
                            contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 300);
                } else {
                    this.showMessage('❌ ' + (data.message || 'Failed to send message. Please try again.'), 'error');
                }
            } catch (error) {
                console.error('Contact form error:', error);
                this.showMessage('❌ Failed to send message. Please check your connection and try again.', 'error');
            } finally {
                // Re-enable submit button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalText;
                    submitBtn.style.opacity = '1';
                    submitBtn.style.cursor = 'pointer';
                }
            }
        }
    }

    // Wake up the Render server (for free tier that spins down after inactivity)
    wakeUpServer() {
        // Ping the API server to wake it up immediately when user lands on the site
        // This prevents the "cold start" delay on Render's free tier
        
        const apiUrl = `${this.apiBase}/test-db`;
        
        // Fire and forget - don't block UI, handle errors silently
        fetch(apiUrl, {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                console.log('✅ Server wake-up ping successful');
            }
        })
        .catch(error => {
            // Silently fail - this is just a wake-up ping, not critical
            // Server might be cold starting, which is expected
            console.log('Server wake-up ping sent');
        });
        
    }

    // Setup all event listeners
    setupEventListeners() {
        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const mainNav = document.getElementById('main-nav');
        if (mobileMenuToggle && mainNav) {
            mobileMenuToggle.addEventListener('click', () => {
                mainNav.classList.toggle('open');
                const icon = mobileMenuToggle.querySelector('i');
                if (icon) {
                    icon.classList.toggle('fa-bars');
                    icon.classList.toggle('fa-times');
                }
            });
            // Close menu when clicking on a nav link
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    mainNav.classList.remove('open');
                    const icon = mobileMenuToggle.querySelector('i');
                    if (icon) {
                        icon.classList.add('fa-bars');
                        icon.classList.remove('fa-times');
                    }
                });
            });
        }

        // Navigation - handle clicks on links and child elements (icons/spans)
        // Helper to normalize hrefs like "/#products" -> "#products"
        const normalizeHash = (href) => {
            if (!href) return null;
            const hashIndex = href.indexOf('#');
            if (hashIndex === -1) return null;
            return href.slice(hashIndex);
        };

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                // Get href from the link element (not the clicked child)
                const rawHref = link.getAttribute('href') || e.target.closest('.nav-link')?.getAttribute('href');
                const href = normalizeHash(rawHref);
                if (href) {
                    // Only intercept and smooth-scroll if the section exists on this page
                    const targetEl = document.querySelector(href);
                    if (targetEl) {
                        // Use native hash navigation (same as footer quick links)
                        // This keeps scrolling behavior identical to Quick Links and ensures correct landing
                        // Do not prevent default; set the hash so browser jumps
                        try {
                            window.location.hash = href;
                        } catch (e) {
                            // Fallback: use smooth scroll if setting hash fails
                            e.preventDefault();
                            this.scrollToSection(href);
                        }
                        // Update active state immediately
                        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                        link.classList.add('active');
                    } else {
                        // Let the browser follow the link (useful when on other pages)
                        // If it's a path like '/#products', navigate there to let server/client routing handle it
                        if (rawHref && (rawHref.startsWith('/') || rawHref.startsWith(window.location.origin))) {
                            window.location.href = rawHref;
                        }
                    }
                } else if (rawHref) {
                    // No hash present - allow normal navigation (e.g., go to / or /product.html)
                }
            });
        });
        
        // Prevent nav and footer quick links from being draggable (avoid accidental drag)
        try {
            document.querySelectorAll('#main-nav a, .nav a, .footer a').forEach(el => {
                el.setAttribute('draggable', 'false');
                el.addEventListener('dragstart', (e) => e.preventDefault());
            });
        } catch (e) {}

        // Update active nav link on scroll
        this.updateActiveNavLink();
        
        // Listen for scroll events to update active nav link
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.updateActiveNavLink();
            }, 100);
        });

        // Cart
        const cartBtn = document.getElementById('cart-btn');
        if (cartBtn) {
            // Ensure floating behavior even if CSS is overridden elsewhere
            try {
                cartBtn.style.position = 'fixed';
                cartBtn.style.right = '22px';
                cartBtn.style.bottom = '22px';
                cartBtn.style.zIndex = '2000';
                // Ensure the button is a direct child of <body> so fixed positioning works
                if (cartBtn.parentElement && cartBtn.parentElement !== document.body) {
                    document.body.appendChild(cartBtn);
                }
            } catch (e) {}
            cartBtn.addEventListener('click', () => this.openCart());
        }
        // Ensure cart sidebar is a direct child of body to avoid transformed ancestor issues
        const cartSidebarEl = document.getElementById('cart-sidebar');
        if (cartSidebarEl && cartSidebarEl.parentElement !== document.body) {
            try {
                document.body.appendChild(cartSidebarEl);
            } catch (e) {
                console.warn('Could not move cart sidebar to body:', e);
            }
        }
        // Also ensure cart overlay is moved to body so it covers the full viewport
        const cartOverlayEl = document.getElementById('cart-overlay');
        if (cartOverlayEl && cartOverlayEl.parentElement !== document.body) {
            try {
                document.body.appendChild(cartOverlayEl);
            } catch (e) {
                console.warn('Could not move cart overlay to body:', e);
            }
        }
        // Ensure checkout modal is a direct child of body so it can float above other UI
        const checkoutModalEl = document.getElementById('checkout-modal');
        if (checkoutModalEl && checkoutModalEl.parentElement !== document.body) {
            try {
                document.body.appendChild(checkoutModalEl);
                // Force fixed positioning and high z-index to guarantee it floats above cart/sidebar
                checkoutModalEl.style.position = 'fixed';
                checkoutModalEl.style.zIndex = '100005';
                const modalContent = checkoutModalEl.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.style.zIndex = '100006';
                    modalContent.style.position = 'relative';
                }
            } catch (e) {
                console.warn('Could not move checkout modal to body:', e);
            }
        }
        // Ensure add-address modal is a direct child of body and floats above checkout
        const addAddressModalEl = document.getElementById('add-address-modal');
        if (addAddressModalEl && addAddressModalEl.parentElement !== document.body) {
            try {
                document.body.appendChild(addAddressModalEl);
                addAddressModalEl.style.position = 'fixed';
                addAddressModalEl.style.zIndex = '100007';
                const addModalContent = addAddressModalEl.querySelector('.modal-content');
                if (addModalContent) {
                    addModalContent.style.position = 'relative';
                    addModalContent.style.zIndex = '100008';
                }
            } catch (e) {
                console.warn('Could not move add-address-modal to body:', e);
            }
        }
        const closeCartBtn = document.getElementById('close-cart');
        if (closeCartBtn) {
            closeCartBtn.addEventListener('click', () => this.closeCart());
        }
        
        // Close cart when clicking overlay
        const cartOverlay = document.getElementById('cart-overlay');
        if (cartOverlay) {
            cartOverlay.addEventListener('click', () => this.closeCart());
        }
        
        // Checkout button - use event delegation since it's rendered dynamically
        document.addEventListener('click', (e) => {
            const checkoutBtn = e.target.closest('#checkout-btn');
            if (checkoutBtn && !checkoutBtn.disabled) {
                e.preventDefault();
                if (!this.token) {
                    this.pendingCheckout = true;
                    this.openAuthFlow({ role: 'customer', mode: 'login' });
                    this.showMessage('Please log in to proceed to checkout', 'info');
                } else {
                    // Logged in user - proceed to checkout
                    this.openCheckoutModal();
                }
            }
        });

        // Notifications
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => this.toggleNotificationsDropdown());
        }
        const markAllBtn = document.getElementById('mark-all-read');
        if (markAllBtn) {
            markAllBtn.addEventListener('click', () => this.markAllNotificationsRead());
        }
        const notificationsViewBtn = document.getElementById('notifications-toggle-view');
        if (notificationsViewBtn) {
            notificationsViewBtn.addEventListener('click', () => this.toggleNotificationsFullView());
        }
        document.addEventListener('click', (e) => {
            const dropdown = document.getElementById('notifications-dropdown');
            const button = document.getElementById('notifications-btn');
            if (!dropdown || !button) return;
            if (!dropdown.classList.contains('open')) return;
            if (dropdown.contains(e.target) || button.contains(e.target)) return;
            dropdown.classList.remove('open');
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const dropdown = document.getElementById('notifications-dropdown');
            if (dropdown) dropdown.classList.remove('open');
        });
        const myOrdersBtn = document.getElementById('my-orders-btn');
        if (myOrdersBtn) {
            myOrdersBtn.addEventListener('click', (e) => {
                if (!this.token) return;
                const href = this.buildOrdersUrl();
                myOrdersBtn.setAttribute('href', href);
                localStorage.setItem('ordersReturnTo', this.getCurrentSectionHash());
                if (!href) e.preventDefault();
            });
        }

        // Auth modals
        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.openAuthFlow({ mode: 'login' }));
        }
        const registerBtn = document.getElementById('register-btn');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => this.openAuthFlow({ mode: 'register' }));
        }
        const superAdminPanelBtn = document.getElementById('super-admin-panel-btn');
        if (superAdminPanelBtn) {
            superAdminPanelBtn.addEventListener('click', () => this.goToAdminPanel());
        }
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
        const userAccountBtn = document.getElementById('user-account-btn');
        const userDropdownMenu = document.getElementById('user-dropdown-menu');
        if (userAccountBtn && userDropdownMenu) {
            userAccountBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isOpen = userDropdownMenu.style.display === 'block';
                userDropdownMenu.style.display = isOpen ? 'none' : 'block';
                userAccountBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            });
            document.addEventListener('click', (e) => {
                if (!userDropdownMenu.contains(e.target) && !userAccountBtn.contains(e.target)) {
                    userDropdownMenu.style.display = 'none';
                    userAccountBtn.setAttribute('aria-expanded', 'false');
                }
            });
        }
        const myAccountBtn = document.getElementById('my-account-btn');
        if (myAccountBtn) {
            myAccountBtn.addEventListener('click', () => {
                const dropdown = document.getElementById('user-dropdown-menu');
                const accountBtn = document.getElementById('user-account-btn');
                if (dropdown) dropdown.style.display = 'none';
                if (accountBtn) accountBtn.setAttribute('aria-expanded', 'false');
                this.openMyAccountModal();
            });
        }

        const saveMyAccountBtn = document.getElementById('save-my-account-btn');
        if (saveMyAccountBtn) {
            saveMyAccountBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.saveMyAccount();
            });
        }

        const changeMyPasswordBtn = document.getElementById('change-my-password-btn');
        if (changeMyPasswordBtn) {
            changeMyPasswordBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.changeMyAccountPassword();
            });
        }

        const toggleMyPasswordSectionBtn = document.getElementById('toggle-my-password-section');
        if (toggleMyPasswordSectionBtn) {
            toggleMyPasswordSectionBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleMyAccountPasswordSection(true);
            });
        }

        const myAccountPasswordBackBtn = document.getElementById('my-account-password-back');
        if (myAccountPasswordBackBtn) {
            myAccountPasswordBackBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleMyAccountPasswordSection(false);
            });
        }

        this.bindPasswordToggle('toggle-my-account-current-password', 'my-account-current-password');
        this.bindPasswordToggle('toggle-my-account-new-password', 'my-account-new-password');
        this.bindPasswordToggle('toggle-my-account-confirm-password', 'my-account-confirm-password');

        const closeMyAccountBtn = document.getElementById('close-my-account-modal');
        if (closeMyAccountBtn) {
            closeMyAccountBtn.addEventListener('click', () => this.closeMyAccountModal());
        }

        // My Account address PSGC cascading
        const myAccountZone = document.getElementById('my-account-zone');
        const myAccountProvince = document.getElementById('my-account-province');
        const myAccountCity = document.getElementById('my-account-city');
        const myAccountBarangay = document.getElementById('my-account-barangay');
        const myAccountStreet = document.getElementById('my-account-street');
        if (myAccountZone) myAccountZone.addEventListener('change', () => this.handleMyAccountZoneChange());
        if (myAccountProvince) myAccountProvince.addEventListener('change', () => this.handleMyAccountProvinceChange());
        if (myAccountCity) myAccountCity.addEventListener('change', () => this.handleMyAccountCityChange());
        if (myAccountBarangay) myAccountBarangay.addEventListener('change', () => this.updateMyAccountAddressPreview());
        if (myAccountStreet) myAccountStreet.addEventListener('input', () => this.updateMyAccountAddressPreview());

        const myAccountModal = document.getElementById('my-account-modal');
        if (myAccountModal) {
            myAccountModal.addEventListener('mousedown', (e) => {
                this._myAccountModalDownInside = !!e.target.closest('.modal-content');
            });
            myAccountModal.addEventListener('touchstart', (e) => {
                this._myAccountModalDownInside = !!e.target.closest('.modal-content');
            }, { passive: true });
            myAccountModal.addEventListener('click', (e) => {
                if (!(e.target && e.target.id === 'my-account-modal')) return;
                const hasSelection = !!(window.getSelection && String(window.getSelection() || '').trim());
                if (!this._myAccountModalDownInside && !hasSelection) {
                    this.closeMyAccountModal();
                }
                this._myAccountModalDownInside = false;
            });
        }

        // Role selector box (on auth form) – event delegation
        document.addEventListener('click', (e) => {
            // Support both old .role-box and new .role-box-enhanced
            const roleBox = e.target.closest('.role-box') || e.target.closest('.role-box-enhanced');
            if (roleBox) {
                e.preventDefault();
                const role = roleBox.getAttribute('data-role');
                this.selectRoleOnForm(role);
            }
        });

        // Unified auth form
        const authForm = document.getElementById('auth-form');
        if (authForm) {
            authForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const mode = this.authMode || (document.getElementById('auth-login-fields').style.display !== 'none' ? 'login' : 'register');
                if (mode === 'login') {
                    this.handleLogin(e);
                } else {
                    this.handleRegister(e);
                }
            });
        }

        // OTP buttons - only for registration (login no longer requires OTP)
        const resendRegisterOtpBtn = document.getElementById('resend-register-otp-btn');
        const resendOtpCooldown = document.getElementById('resend-otp-cooldown');
        if (resendRegisterOtpBtn) {
            resendRegisterOtpBtn.addEventListener('click', () => {
                if (resendRegisterOtpBtn.disabled) return;
                this.startResendOtpCooldown(60);
                if (this.authMode === 'register' || document.getElementById('auth-register-fields').style.display !== 'none') {
                    this.sendOtpForRegistration({ resend: true });
                } else {
                    this.sendOtp();
                }
            });
        }

        // OTP input validation (numbers only)
        const loginOtpInput = document.getElementById('login-otp');
        const registerOtpInput = document.getElementById('register-otp');
        [loginOtpInput, registerOtpInput].forEach(input => {
            if (input) {
                input.addEventListener('input', (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
                });
            }
        });
        // OTP input change detection for registration
        if (registerOtpInput) {
            registerOtpInput.addEventListener('input', () => {
                localStorage.setItem('register_otp', registerOtpInput.value.trim());
            });
            registerOtpInput.addEventListener('blur', () => {
                localStorage.setItem('register_otp', registerOtpInput.value.trim());
            });
        }

        // Email input change detection for registration step 1
        const registerEmailInput = document.getElementById('auth-email-register');
        if (registerEmailInput) {
            registerEmailInput.addEventListener('input', () => {
                const currentEmail = registerEmailInput.value.trim();
                // If email changed and doesn't match verified email, reset verification state
                if (this.otpEmail && currentEmail !== this.otpEmail) {
                    this.otpVerified = false;
                    this.otpSent = false;
                    this.otpEmail = null;
                    const otpSection = document.getElementById('register-otp-section');
                    if (otpSection) otpSection.style.display = 'none';
                    const otpInput = document.getElementById('register-otp');
                    if (otpInput) otpInput.value = '';
                } else if (!currentEmail) {
                    this.otpVerified = false;
                    this.otpSent = false;
                    this.otpEmail = null;
                    const otpSection = document.getElementById('register-otp-section');
                    if (otpSection) otpSection.style.display = 'none';
                    const otpInput = document.getElementById('register-otp');
                    if (otpInput) otpInput.value = '';
                }
                // Clear validation state while user edits the email so input is not persistently red
                registerEmailInput.classList.remove('invalid', 'valid');
                // Update button text
                this.updateRegisterStep1ButtonText();
                // Persist email to localStorage
                localStorage.setItem('register_email', registerEmailInput.value.trim());
            });
            // Also persist on blur (in case of autofill)
            registerEmailInput.addEventListener('blur', () => {
                localStorage.setItem('register_email', registerEmailInput.value.trim());
            });
        }

        // Registration step navigation buttons
        for (let i = 1; i <= 4; i++) {
            const nextBtn = document.getElementById(`register-next-${i}`);
            const backBtn = document.getElementById(`register-back-${i}`);
            if (nextBtn) {
                nextBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleRegistrationStep(i, 'next');
                });
            }
            if (backBtn) {
                backBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.handleRegistrationStep(i, 'back');
                });
            }
        }

        // Terms modal
        const termsModal = document.getElementById('terms-modal');
        const closeTermsBtn = document.getElementById('close-terms-modal');
        const termsModalCheckbox = document.getElementById('terms-modal-checkbox');
        const termsModalDone = document.getElementById('terms-modal-done');
        const mainTermsCheckbox = document.getElementById('auth-terms-checkbox');
        const termsTrigger = document.getElementById('terms-trigger');

        const openTermsModal = () => {
            if (!termsModal) return;
            if (termsModalCheckbox && mainTermsCheckbox) {
                termsModalCheckbox.checked = mainTermsCheckbox.checked;
            }
            if (termsModalDone) {
                termsModalDone.disabled = !termsModalCheckbox?.checked;
            }
            termsModal.classList.add('open');
            this.setPageScrollLocked(true);
        };

        if (termsTrigger && mainTermsCheckbox) {
            termsTrigger.addEventListener('click', (event) => {
                event.preventDefault();
                openTermsModal();
            });
            mainTermsCheckbox.addEventListener('click', (event) => {
                event.preventDefault();
                openTermsModal();
            });
        }
        if (closeTermsBtn && termsModal) {
            closeTermsBtn.addEventListener('click', () => {
                termsModal.classList.remove('open');
                this.setPageScrollLocked(false);
            });
        }
        if (termsModal) {
            termsModal.addEventListener('click', (event) => {
                if (event.target === termsModal) {
                    termsModal.classList.remove('open');
                    this.setPageScrollLocked(false);
                }
            });
        }
        if (termsModalCheckbox && termsModalDone) {
            termsModalCheckbox.addEventListener('change', () => {
                termsModalDone.disabled = !termsModalCheckbox.checked;
            });
        }
        if (termsModalDone && termsModalCheckbox && mainTermsCheckbox) {
            termsModalDone.addEventListener('click', () => {
                mainTermsCheckbox.checked = termsModalCheckbox.checked;
                if (termsModal) {
                    termsModal.classList.remove('open');
                }
                this.setPageScrollLocked(false);
            });
        }

        // Password confirmation validation
        const passwordConfirm = document.getElementById('auth-password-confirm');
        const passwordRegister = document.getElementById('auth-password-register');
        if (passwordConfirm && passwordRegister) {
            passwordConfirm.addEventListener('input', () => this.validatePasswordMatch());
            passwordRegister.addEventListener('input', () => this.validatePasswordMatch());
        }

        // Password toggle for confirm password
        const toggleConfirmPassword = document.getElementById('toggle-confirm-password');
        if (toggleConfirmPassword) {
            toggleConfirmPassword.addEventListener('click', () => {
                const input = passwordConfirm;
                const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                input.setAttribute('type', type);
                toggleConfirmPassword.querySelector('i').classList.toggle('fa-eye');
                toggleConfirmPassword.querySelector('i').classList.toggle('fa-eye-slash');
            });
        }

        // Password toggle for login
        const toggleLoginPassword = document.getElementById('toggle-login-password');
        const loginPasswordInput = document.getElementById('auth-password');
        if (toggleLoginPassword && loginPasswordInput) {
            toggleLoginPassword.addEventListener('click', () => {
                const icon = toggleLoginPassword.querySelector('i');
                if (loginPasswordInput.type === 'password') {
                    loginPasswordInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    loginPasswordInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }

        // Save form data as user types (for persistence)
        this.setupFormPersistence();

        // Restrict name inputs to letters and spaces only
        ['auth-firstname', 'auth-middlename', 'auth-lastname'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', (e) => {
                const cleaned = el.value.replace(/[^A-Za-z\s]/g, '');
                if (cleaned !== el.value) {
                    el.value = cleaned;
                }
            });
        });

        // Restrict username to letters, numbers and underscores only
        const usernameEl = document.getElementById('auth-username');
        if (usernameEl) {
            usernameEl.addEventListener('input', () => {
                const cleaned = usernameEl.value.replace(/[^A-Za-z0-9_]/g, '');
                if (cleaned !== usernameEl.value) {
                    usernameEl.value = cleaned;
                }
            });
            // Prevent spaces on keydown for convenience
            usernameEl.addEventListener('keydown', (ev) => {
                if (ev.key === ' ' || ev.key === 'Spacebar') ev.preventDefault();
            });
        }

        // Password toggle for register
        const toggleRegisterPassword = document.getElementById('toggle-register-password');
        if (toggleRegisterPassword) {
            toggleRegisterPassword.addEventListener('click', () => {
                const passwordInput = document.getElementById('auth-password-register');
                const icon = toggleRegisterPassword.querySelector('i');
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }

        // Password strength indicator removed

        // Dynamic name hint based on role
        document.addEventListener('click', (e) => {
            // Support both old .role-box and new .role-box-enhanced
            const roleBox = e.target.closest('.role-box') || e.target.closest('.role-box-enhanced');
            if (roleBox && roleBox.closest('#role-selector-register')) {
                const role = roleBox.getAttribute('data-role');
                const fullnameHint = document.getElementById('fullname-hint');
                if (fullnameHint) {
                    if (role === 'farmer') {
                        fullnameHint.textContent = 'For farmers, enter your shop/farm name in First Name.';
                    } else {
                        fullnameHint.textContent = 'Enter your first, middle (optional), and last name.';
                    }
                }
            }
        });

        // Real-time form validation feedback
        const registerFields = ['auth-username', 'auth-email-register', 'auth-password-register', 'auth-firstname', 'auth-lastname'];
        registerFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('blur', () => {
                    this.validateField(field);
                });
                field.addEventListener('input', () => {
                    if (field.classList.contains('invalid')) {
                        this.validateField(field);
                    }
                });
            }
        });

        const authCloseBtn = document.getElementById('auth-close-btn');
        if (authCloseBtn) {
            authCloseBtn.addEventListener('click', () => this.closeAuthFlow());
        }

        // Forgot password link
        const forgotLink = document.getElementById('forgot-password-link');
        if (forgotLink) {
            forgotLink.addEventListener('click', (e) => {
                e.preventDefault();
                this.openForgotPasswordModal();
            });
        }

        // Forgot password modal buttons
        const forgotCloseBtn = document.getElementById('forgot-password-close-btn');
        if (forgotCloseBtn) {
            forgotCloseBtn.addEventListener('click', () => this.closeForgotPasswordModal());
        }
        const forgotSendBtn = document.getElementById('forgot-send-btn');
        if (forgotSendBtn) {
            forgotSendBtn.addEventListener('click', () => this.sendForgotPasswordCode());
        }
        const forgotResendBtn = document.getElementById('forgot-resend-btn');
        if (forgotResendBtn) {
            forgotResendBtn.addEventListener('click', () => this.resendForgotPasswordCode());
        }
        const forgotBackToLogin = document.getElementById('forgot-back-to-login');
        if (forgotBackToLogin) {
            forgotBackToLogin.addEventListener('click', () => {
                this.closeForgotPasswordModal();
                this.openAuthFlow({ mode: 'login', role: localStorage.getItem('last_auth_role') || 'customer' });
            });
        }
        const forgotBackToEmail = document.getElementById('forgot-back-to-email');
        if (forgotBackToEmail) {
            forgotBackToEmail.addEventListener('click', () => {
                const stepEmail = document.getElementById('forgot-step-email');
                const stepOtp = document.getElementById('forgot-step-otp');
                if (stepOtp) stepOtp.style.display = 'none';
                if (stepEmail) stepEmail.style.display = 'block';
            });
        }
        const forgotBackToOtp = document.getElementById('forgot-back-to-otp');
        if (forgotBackToOtp) {
            forgotBackToOtp.addEventListener('click', () => {
                const stepPassword = document.getElementById('forgot-step-password');
                const stepOtp = document.getElementById('forgot-step-otp');
                if (stepPassword) stepPassword.style.display = 'none';
                if (stepOtp) stepOtp.style.display = 'block';
            });
        }
        const forgotVerifyOtpBtn = document.getElementById('forgot-verify-otp-btn');
        if (forgotVerifyOtpBtn) {
            forgotVerifyOtpBtn.addEventListener('click', () => this.verifyForgotOtp());
        }
        const forgotResetBtn = document.getElementById('forgot-reset-btn');
        if (forgotResetBtn) {
            forgotResetBtn.addEventListener('click', () => this.resetForgotPassword());
        }
        const backToLoginBtn = document.getElementById('forgot-back-to-login-btn');
        if (backToLoginBtn) {
            backToLoginBtn.addEventListener('click', () => {
                this.closeForgotPasswordModal();
                this.openAuthFlow({ mode: 'login', role: localStorage.getItem('last_auth_role') || 'customer' });
            });
        }

        // Forgot password OTP input: numbers only
        const forgotOtpInput = document.getElementById('forgot-otp');
        if (forgotOtpInput) {
            forgotOtpInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
            });
        }

        // Forgot password match validation
        const forgotPass = document.getElementById('forgot-new-password');
        const forgotPassConfirm = document.getElementById('forgot-new-password-confirm');
        if (forgotPass && forgotPassConfirm) {
            forgotPass.addEventListener('input', () => this.validateForgotPasswordMatch());
            forgotPassConfirm.addEventListener('input', () => this.validateForgotPasswordMatch());
        }

        // Password toggles (forgot)
        const toggleForgotPassword = document.getElementById('toggle-forgot-password');
        if (toggleForgotPassword && forgotPass) {
            toggleForgotPassword.addEventListener('click', () => {
                const icon = toggleForgotPassword.querySelector('i');
                if (forgotPass.type === 'password') {
                    forgotPass.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    forgotPass.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }
        const toggleForgotConfirmPassword = document.getElementById('toggle-forgot-confirm-password');
        if (toggleForgotConfirmPassword && forgotPassConfirm) {
            toggleForgotConfirmPassword.addEventListener('click', () => {
                const icon = toggleForgotConfirmPassword.querySelector('i');
                if (forgotPassConfirm.type === 'password') {
                    forgotPassConfirm.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    forgotPassConfirm.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }

        // Forms
        document.getElementById('checkout-form').addEventListener('submit', (e) => this.handleCheckout(e));
        
        // Phone number input - only allow digits
        const checkoutPhoneInput = document.getElementById('checkout-phone');
        if (checkoutPhoneInput) {
            checkoutPhoneInput.addEventListener('input', (e) => {
                e.target.value = this.formatPhoneInputValue(e.target.value);
            });
        }

        // Registration contact number input: format as '9XX XXX XXXX' and preserve cursor position
        const registerPhoneInput = document.getElementById('auth-phone');
        if (registerPhoneInput) {
            registerPhoneInput.addEventListener('input', function(e) {
                const input = e.target;
                let value = input.value;
                let selectionStart = input.selectionStart;

                // Remove all non-numeric characters
                let digits = value.replace(/\D/g, '');
                if (digits.startsWith('0')) digits = digits.substring(1);
                digits = digits.substring(0, 10);

                // Format as 9XX XXX XXXX
                let formatted = '';
                if (digits.length <= 3) {
                    formatted = digits;
                } else if (digits.length <= 6) {
                    formatted = digits.slice(0, 3) + ' ' + digits.slice(3);
                } else {
                    formatted = digits.slice(0, 3) + ' ' + digits.slice(3, 6) + ' ' + digits.slice(6);
                }

                // Calculate new cursor position
                let pos = selectionStart;
                let rawLeft = value.slice(0, pos).replace(/\D/g, '');
                let newPos = rawLeft.length;
                if (newPos > 3 && newPos <= 6) newPos += 1; // after first space
                else if (newPos > 6) newPos += 2; // after two spaces

                // If deleting a space, move cursor back
                if (value[pos - 1] === ' ' && formatted.length < value.length) {
                    newPos--;
                }

                input.value = formatted;
                input.setSelectionRange(newPos, newPos);
            });
        }
        
        
        // Saved address selector
        const savedAddresses = document.getElementById('saved-addresses');
        if (savedAddresses) {
            savedAddresses.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.applySavedAddress(e.target.value);
                }
            });
        }

        // Add address button in checkout
        const openAddAddressBtn = document.getElementById('open-add-address-modal');
        if (openAddAddressBtn) {
            openAddAddressBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.openAddAddressModal();
            });
        }

        // Add address form
        const addAddressForm = document.getElementById('add-address-form');
        if (addAddressForm) {
            addAddressForm.addEventListener('submit', (e) => this.saveAddressFromCheckout(e));
        }

        const floatingZone = document.getElementById('floating-address-zone');
        const floatingProvince = document.getElementById('floating-address-province');
        const floatingCity = document.getElementById('floating-address-city');
        const floatingBarangay = document.getElementById('floating-address-barangay');
        const floatingStreet = document.getElementById('floating-address-street');
        const registerZone = document.getElementById('auth-zone');
        const registerProvince = document.getElementById('auth-province');
        const registerCity = document.getElementById('auth-city');
        const registerBarangay = document.getElementById('auth-barangay');
        const registerStreet = document.getElementById('auth-street');
        if (floatingZone) {
            floatingZone.addEventListener('change', () => this.handleFloatingAddressZoneChange());
        }
        if (floatingProvince) {
            floatingProvince.addEventListener('change', () => this.handleFloatingAddressProvinceChange());
        }
        if (floatingCity) {
            floatingCity.addEventListener('change', () => this.handleFloatingAddressCityChange());
        }
        if (floatingBarangay) {
            floatingBarangay.addEventListener('change', () => this.buildCheckoutAddress());
        }
        if (floatingStreet) {
            floatingStreet.addEventListener('input', () => this.buildCheckoutAddress());
        }
        if (registerZone) {
            registerZone.addEventListener('change', () => this.handleRegistrationZoneChange());
        }
        if (registerProvince) {
            registerProvince.addEventListener('change', () => this.handleRegistrationProvinceChange());
        }
        if (registerCity) {
            registerCity.addEventListener('change', () => this.handleRegistrationCityChange());
        }
        if (registerBarangay) {
            registerBarangay.addEventListener('change', () => this.updateRegistrationAddressPreview());
        }
        if (registerStreet) {
            registerStreet.addEventListener('input', () => this.updateRegistrationAddressPreview());
        }
        this.setupRegistrationAddressForm().catch((error) => {
            console.error('Registration PSGC setup error:', error);
        });
        this.setupFloatingAddressForm().catch((error) => {
            console.error('Floating PSGC setup error:', error);
        });

        // Cancel add address
        const cancelAddAddressBtn = document.getElementById('cancel-add-address');
        const closeAddAddressBtn = document.getElementById('close-add-address-modal');
        if (cancelAddAddressBtn) {
            cancelAddAddressBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeAddAddressModal();
            });
        }
        if (closeAddAddressBtn) {
            closeAddAddressBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeAddAddressModal();
            });
        }

        // Phone number input for floating address form
        const floatingPhoneInput = document.getElementById('floating-address-phone');
        if (floatingPhoneInput) {
            floatingPhoneInput.addEventListener('input', (e) => {
                e.target.value = this.formatPhoneInputValue(e.target.value);
            });
        }

        // Modal close buttons (but exclude add address modal close button)
        document.querySelectorAll('.modal .close-btn').forEach(btn => {
            if (btn.id !== 'close-add-address-modal') {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeModals();
                });
            }
        });

        // Shop More button inside checkout modal: close checkout and cart so user can browse more
        const shopMoreBtn = document.getElementById('shop-more-btn');
        if (shopMoreBtn) {
            shopMoreBtn.addEventListener('click', (e) => {
                e.preventDefault();
                // Only close the checkout modal and shopping cart; do not navigate or scroll.
                try { this.closeModals(); } catch (err) {}
                try { this.closeCart(); } catch (err) {}
                // Provide a subtle UX cue: focus the products grid if present so user can continue browsing
                try {
                    const productsGrid = document.getElementById('products-grid');
                    if (productsGrid) productsGrid.focus && productsGrid.focus();
                } catch (err) {}
            });
        }

        // Auth mode toggle (will be set up dynamically in auth modal)

        // Search and filters
        const searchInputEl = document.getElementById('search-input');
        if (searchInputEl) {
            searchInputEl.addEventListener('input', (e) => {
                this.currentSearch = e.target.value;
                this.currentPage = 1; // Reset to first page on search
                this.loadProducts();
            });
        }

        const sortSelectEl = document.getElementById('products-sort');
        if (sortSelectEl) {
            sortSelectEl.addEventListener('change', (e) => {
                this.currentSort = e.target.value || 'latest';
                this.currentPage = 1;
                this.syncSortControls();
                this.loadProducts();
            });
        }

        const sortButtons = document.querySelectorAll('.sort-option-btn[data-sort-option]');
        sortButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const sortValue = String(btn.getAttribute('data-sort-option') || 'latest');
                this.currentSort = sortValue;
                this.currentPage = 1;

                const priceSortEl = document.getElementById('products-price-sort');
                if (priceSortEl) priceSortEl.value = '';

                this.syncSortControls();
                this.loadProducts();
            });
        });

        const priceSortEl = document.getElementById('products-price-sort');
        if (priceSortEl) {
            priceSortEl.addEventListener('change', (e) => {
                const selected = String(e.target.value || '').trim();
                this.currentSort = selected || 'latest';
                this.currentPage = 1;
                this.syncSortControls();
                this.loadProducts();
            });
        }

        this.syncSortControls();

        // Pagination removed - now showing all products on one page

        // Categories
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const category = card.getAttribute('data-category');
                this.currentCategory = category;
                const activeBtn = document.querySelector(`#products-category-tabs [data-product-category="${category}"]`);
                if (activeBtn) {
                    document.querySelectorAll('#products-category-tabs [data-product-category]').forEach((btn) => btn.classList.remove('active'));
                    activeBtn.classList.add('active');
                }
                this.loadProducts();
                this.scrollToSection('#products');
            });
        });

        // Shop now button
        const shopNowBtn = document.getElementById('shop-now-btn');
        if (shopNowBtn) {
            shopNowBtn.addEventListener('click', () => {
                window.location.hash = '#products';
                this.scrollToSection('#products');
            });
        }

        // Modal close functionality (only via X button)
        // Additional modal close handlers (but exclude add address modal)
        document.querySelectorAll('.modal .close-btn').forEach(btn => {
            if (btn.id !== 'close-add-address-modal') {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.closeModals();
                });
            }
        });

        // Contact form submission
        const contactForm = document.querySelector('.contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleContactForm(e);
            });
        }
        
        // Product details modal close
        const closeProductDetailsBtn = document.getElementById('close-product-details');
        if (closeProductDetailsBtn) {
            closeProductDetailsBtn.addEventListener('click', () => {
                this.closeProductDetails();
            });
        }
        
        const productDetailsOverlay = document.querySelector('.product-details-overlay');
        if (productDetailsOverlay) {
            productDetailsOverlay.addEventListener('click', () => {
                this.closeProductDetails();
            });
        }

        const quantityEl = document.getElementById('product-details-quantity');
        if (quantityEl) {
            const normalize = () => this.normalizeProductQuantityInput();
            quantityEl.addEventListener('input', normalize);
            quantityEl.addEventListener('change', normalize);
            quantityEl.addEventListener('blur', normalize);
        }

        this.bindProductCategoryTabListeners();

        document.getElementById('close-shop-details-modal')?.addEventListener('click', () => this.closeShopDetailsModal());
        document.getElementById('close-shop-details-footer-btn')?.addEventListener('click', () => this.closeShopDetailsModal());
        document.getElementById('shop-details-modal')?.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'shop-details-modal') this.closeShopDetailsModal();
        });
    }

    openForgotPasswordModal() {
        // Keep UX clean: close auth modal if open
        try { this.closeAuthFlow(); } catch (e) {}

        const modal = document.getElementById('forgot-password-modal');
        if (!modal) return;

        // Reset state
        this.forgotEmail = null;
        this.forgotOtp = null;
        this.stopForgotCooldown();
        this.resetRecaptcha('forgot');

        const stepEmail = document.getElementById('forgot-step-email');
        const stepOtp = document.getElementById('forgot-step-otp');
        const stepPassword = document.getElementById('forgot-step-password');
        const stepSuccess = document.getElementById('forgot-step-success');
        if (stepEmail) stepEmail.style.display = 'block';
        if (stepOtp) stepOtp.style.display = 'none';
        if (stepPassword) stepPassword.style.display = 'none';
        if (stepSuccess) stepSuccess.style.display = 'none';

        const emailInput = document.getElementById('forgot-email');
        const otpInput = document.getElementById('forgot-otp');
        const np = document.getElementById('forgot-new-password');
        const npc = document.getElementById('forgot-new-password-confirm');
        if (otpInput) otpInput.value = '';
        if (np) np.value = '';
        if (npc) npc.value = '';
        this.validateForgotPasswordMatch();

        // Prefill email from login field if it looks like an email
        try {
            const loginEmail = document.getElementById('auth-email')?.value?.trim();
            if (emailInput && loginEmail && loginEmail.includes('@')) {
                emailInput.value = loginEmail;
            }
        } catch (e) {}

        try {
            if (modal.parentElement !== document.body) document.body.appendChild(modal);
        } catch (e) {}
        // Disable floating cart button while modal is open to avoid accidental clicks
        try {
            const cartBtn = document.getElementById('cart-btn');
            if (cartBtn) {
                cartBtn.classList.add('disabled-while-modal');
                cartBtn.setAttribute('aria-hidden', 'true');
            }
        } catch (e) {}
        modal.classList.add('open');
        if (emailInput) emailInput.focus();
    }

    closeForgotPasswordModal() {
        const modal = document.getElementById('forgot-password-modal');
        if (modal) modal.classList.remove('open');
        // Re-enable floating cart button
        try {
            const cartBtn = document.getElementById('cart-btn');
            if (cartBtn) {
                cartBtn.classList.remove('disabled-while-modal');
                cartBtn.removeAttribute('aria-hidden');
            }
        } catch (e) {}
        this.stopForgotCooldown();
        this.forgotEmail = null;
        this.forgotOtp = null;
        this.resetRecaptcha('forgot');
    }

    startForgotCooldown(seconds) {
        this.stopForgotCooldown();
        this.forgotCooldownRemaining = seconds;

        const cooldownEl = document.getElementById('forgot-resend-cooldown');
        const resendBtn = document.getElementById('forgot-resend-btn');
        if (cooldownEl) cooldownEl.style.display = 'inline';
        if (resendBtn) resendBtn.disabled = true;

        const tick = () => {
            const cd = document.getElementById('forgot-resend-cooldown');
            const btn = document.getElementById('forgot-resend-btn');
            if (this.forgotCooldownRemaining <= 0) {
                if (cd) cd.style.display = 'none';
                if (btn) btn.disabled = false;
                this.stopForgotCooldown();
                return;
            }
            if (cd) cd.textContent = `${this.forgotCooldownRemaining}s`;
            this.forgotCooldownRemaining -= 1;
        };

        tick();
        this.forgotCooldownTimer = setInterval(tick, 1000);
    }

    stopForgotCooldown() {
        if (this.forgotCooldownTimer) {
            clearInterval(this.forgotCooldownTimer);
            this.forgotCooldownTimer = null;
        }
        const cooldownEl = document.getElementById('forgot-resend-cooldown');
        const resendBtn = document.getElementById('forgot-resend-btn');
        if (cooldownEl) {
            cooldownEl.style.display = 'none';
            cooldownEl.textContent = '';
        }
        if (resendBtn) resendBtn.disabled = false;
    }

    validateForgotPasswordMatch() {
        const p1 = document.getElementById('forgot-new-password');
        const p2 = document.getElementById('forgot-new-password-confirm');
        const hint = document.getElementById('forgot-password-match-hint');
        if (!p1 || !p2 || !hint) return true;

        const a = (p1.value || '').trim();
        const b = (p2.value || '').trim();
        if (!a && !b) {
            hint.textContent = '';
            return true;
        }
        if (a.length > 0 && a.length < 6) {
            hint.textContent = 'Password must be at least 6 characters.';
            hint.style.color = '#d32f2f';
            return false;
        }
        if (a !== b) {
            hint.textContent = 'Passwords do not match.';
            hint.style.color = '#d32f2f';
            return false;
        }
        hint.textContent = 'Passwords match.';
        hint.style.color = '#2e7d32';
        return true;
    }

    async sendForgotPasswordCode() {
        const emailInput = document.getElementById('forgot-email');
        const sendBtn = document.getElementById('forgot-send-btn');
        if (!emailInput) return;

        const email = (emailInput.value || '').trim();
        if (!email || !email.includes('@')) {
            this.showMessage('Please enter a valid email address.', 'error');
            emailInput.focus();
            return;
        }

        const recaptchaResponse = this.getRecaptchaResponse('forgot');
        if (!recaptchaResponse) {
            this.setRecaptchaError('forgot', 'Please complete the CAPTCHA before continuing.');
            this.showMessage('Please complete the CAPTCHA before continuing.', 'error');
            return;
        }

        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.7';
        }

        try {
            const response = await fetch(`${this.apiBase}/auth/forgot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, 'g-recaptcha-response': recaptchaResponse })
            });
            const data = await response.json().catch(() => ({}));

            this.resetRecaptcha('forgot');

            if (response.status === 429) {
                const retryAfter = Number(data.retryAfter || data.cooldownSeconds || 60);
                this.startForgotCooldown(retryAfter);
            } else {
                this.startForgotCooldown(60);
            }

            // Keep message generic
            this.showMessage(data.message || "If that email exists, we've sent a verification code.", 'info');

            this.forgotEmail = email;

            const stepEmail = document.getElementById('forgot-step-email');
            const stepOtp = document.getElementById('forgot-step-otp');
            if (stepEmail) stepEmail.style.display = 'none';
            if (stepOtp) stepOtp.style.display = 'block';

            const otpInput = document.getElementById('forgot-otp');
            if (otpInput) otpInput.focus();

            if (data.debugOtp) {
                console.log('DEBUG forgot password OTP:', data.debugOtp);
            }
        } catch (error) {
            console.error('Forgot password send error:', error);
            this.resetRecaptcha('forgot');
            this.showMessage('Failed to send code. Please try again.', 'error');
        } finally {
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.style.opacity = '1';
            }
        }
    }

    async resendForgotPasswordCode() {
        const email = this.forgotEmail || (document.getElementById('forgot-email')?.value || '').trim();
        if (!email) {
            this.showMessage('Enter your email first.', 'error');
            return;
        }

        const recaptchaResponse = this.getRecaptchaResponse('forgot');
        if (!recaptchaResponse) {
            this.setRecaptchaError('forgot', 'Please complete the CAPTCHA before resending the code.');
            this.showMessage('Please complete the CAPTCHA before resending the code.', 'error');
            return;
        }

        const resendBtn = document.getElementById('forgot-resend-btn');
        if (resendBtn && resendBtn.disabled) return;

        try {
            const response = await fetch(`${this.apiBase}/auth/forgot/resend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, 'g-recaptcha-response': recaptchaResponse })
            });
            const data = await response.json().catch(() => ({}));

            this.resetRecaptcha('forgot');

            if (response.status === 429) {
                const retryAfter = Number(data.retryAfter || data.cooldownSeconds || 60);
                this.startForgotCooldown(retryAfter);
            } else {
                this.startForgotCooldown(60);
            }

            this.showMessage(data.message || "If that email exists, we've sent a verification code.", 'info');
            if (data.debugOtp) {
                console.log('DEBUG forgot password OTP:', data.debugOtp);
            }
        } catch (error) {
            console.error('Forgot password resend error:', error);
            this.resetRecaptcha('forgot');
            this.showMessage('Failed to resend code. Please try again.', 'error');
        }
    }

    async verifyForgotOtp() {
        const email = this.forgotEmail || (document.getElementById('forgot-email')?.value || '').trim();
        const otp = (document.getElementById('forgot-otp')?.value || '').trim();
        const btn = document.getElementById('forgot-verify-otp-btn');

        if (!email || !email.includes('@')) {
            this.showMessage('Please enter a valid email.', 'error');
            return;
        }
        if (!otp || otp.length !== 6) {
            this.showMessage('Please enter the 6-digit code.', 'error');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.7';
        }

        try {
            const response = await fetch(`${this.apiBase}/auth/forgot/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp })
            });
            const data = await response.json().catch(() => ({}));

            if (response.ok && data.verified) {
                this.forgotEmail = email;
                this.forgotOtp = otp;

                const stepOtp = document.getElementById('forgot-step-otp');
                const stepPassword = document.getElementById('forgot-step-password');
                if (stepOtp) stepOtp.style.display = 'none';
                if (stepPassword) stepPassword.style.display = 'block';

                const p1 = document.getElementById('forgot-new-password');
                if (p1) p1.focus();
                this.showMessage('Code verified. Please set a new password.', 'success');
            } else {
                this.showMessage(data.message || 'Invalid or expired code.', 'error');
            }
        } catch (error) {
            console.error('Forgot password verify otp error:', error);
            this.showMessage('Failed to verify code. Please try again.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }
    }

    async resetForgotPassword() {
        const email = this.forgotEmail || (document.getElementById('forgot-email')?.value || '').trim();
        const otp = this.forgotOtp || (document.getElementById('forgot-otp')?.value || '').trim();
        const p1 = (document.getElementById('forgot-new-password')?.value || '').trim();
        const p2 = (document.getElementById('forgot-new-password-confirm')?.value || '').trim();
        const btn = document.getElementById('forgot-reset-btn');

        if (!email || !email.includes('@') || !otp || otp.length !== 6) {
            this.showMessage('Please verify your code first.', 'error');
            return;
        }
        if (!this.validateForgotPasswordMatch()) {
            this.showMessage('Please fix the password fields.', 'error');
            return;
        }
        if (!p1 || p1.length < 6) {
            this.showMessage('Password must be at least 6 characters.', 'error');
            return;
        }
        if (p1 !== p2) {
            this.showMessage('Passwords do not match.', 'error');
            return;
        }

        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.7';
        }

        try {
            const response = await fetch(`${this.apiBase}/auth/forgot/reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, otp, newPassword: p1 })
            });
            const data = await response.json().catch(() => ({}));
            if (response.ok) {
                const stepPassword = document.getElementById('forgot-step-password');
                const stepSuccess = document.getElementById('forgot-step-success');
                if (stepPassword) stepPassword.style.display = 'none';
                if (stepSuccess) stepSuccess.style.display = 'block';
                this.showMessage('Password reset successful. You can log in now.', 'success');
                this.stopForgotCooldown();
            } else {
                this.showMessage(data.message || 'Failed to reset password.', 'error');
            }
        } catch (error) {
            console.error('Forgot password reset error:', error);
            this.showMessage('Failed to reset password. Please try again.', 'error');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }
    }

    // Authentication
    checkAuthStatus() {
        if (this.token) {
            this.redirectAuthenticatedLandingByToken();
            this.showUserMenu();
            this.migrateGuestCart();
        } else {
            this.showGuestMenu();
        }
    }

    normalizeAuthToken(rawToken) {
        let token = String(rawToken || '').trim();
        if (!token) return null;

        if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
            token = token.slice(1, -1).trim();
        }

        if (/^Bearer\s+/i.test(token)) {
            token = token.replace(/^Bearer\s+/i, '').trim();
        }

        if (!token || token === 'null' || token === 'undefined') return null;
        return token;
    }

    decodeJwtPayload(token) {
        try {
            if (!token) return null;
            const parts = String(token).split('.');
            if (parts.length < 2) return null;
            const base64Url = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4);
            return JSON.parse(atob(padded));
        } catch (_) {
            return null;
        }
    }

    redirectAuthenticatedLandingByToken() {
        const isLanding = window.location.pathname === '/' || window.location.pathname.includes('index.html');
        if (!isLanding) return;

        const payload = this.decodeJwtPayload(this.token);
        const role = String(payload?.role || '').toLowerCase();
        if (role === 'farmer') {
            window.location.replace('/farmer.html');
            return;
        }
        if (role === 'staff' || role === 'super_admin') {
            window.location.replace('/admin.html');
        }
    }

    showUserMenu() {
        document.getElementById('user-menu').style.display = 'none';
        document.getElementById('user-profile').style.display = 'block';
        const myOrdersBtn = document.getElementById('my-orders-btn');
        if (myOrdersBtn) {
            myOrdersBtn.style.display = 'flex';
            myOrdersBtn.setAttribute('href', this.buildOrdersUrl());
        }
        const notificationsWrapper = document.getElementById('notifications-wrapper');
        if (notificationsWrapper) {
            notificationsWrapper.style.display = 'block';
        }
        // Show the notification icon/button when user is logged in
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.style.display = 'inline-flex';
        }
        this.loadUserProfile();
        this.updateOrdersCount();
    }

    showGuestMenu() {
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('user-profile').style.display = 'none';
        const userDropdownMenu = document.getElementById('user-dropdown-menu');
        const userAccountBtn = document.getElementById('user-account-btn');
        if (userDropdownMenu) userDropdownMenu.style.display = 'none';
        if (userAccountBtn) userAccountBtn.setAttribute('aria-expanded', 'false');
        const myOrdersBtn = document.getElementById('my-orders-btn');
        if (myOrdersBtn) {
            myOrdersBtn.style.display = 'none';
        }
        const notificationsWrapper = document.getElementById('notifications-wrapper');
        if (notificationsWrapper) {
            notificationsWrapper.style.display = 'none';
        }
        // Hide the notification icon/button in guest mode (keep logic intact)
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.style.display = 'none';
        }
    }

    async updateOrdersCount() {
        if (!this.token) return;
        try {
            const response = await fetch(`${this.apiBase}/orders`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                const orders = data.orders || [];
                const pendingOrders = orders.filter(o => ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(o.status)).length;
                const ordersCountEl = document.getElementById('orders-count');
                if (ordersCountEl) {
                    if (pendingOrders > 0) {
                        ordersCountEl.textContent = pendingOrders;
                        ordersCountEl.style.display = 'inline-flex';
                    } else {
                        ordersCountEl.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            console.error('Error updating orders count:', error);
        }
    }

    async loadNotifications() {
        if (!this.token) return;
        try {
            const response = await fetch(`${this.apiBase}/notifications`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.renderNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    renderNotifications(notifications) {
        const list = document.getElementById('notifications-list');
        const countEl = document.getElementById('notifications-count');
        if (!list || !countEl) return;

        const unreadCount = notifications.filter(n => !n.is_read).length;
        countEl.textContent = unreadCount;
        countEl.style.display = unreadCount > 0 ? 'inline-flex' : 'none';

        if (!notifications.length) {
            list.innerHTML = '<div class="empty-state">No notifications.</div>';
            return;
        }

        list.innerHTML = notifications.map(note => {
            const productImage = note.product_image_url || window.__PLACEHOLDER_IMAGE__;
            const productLabel = note.product_name ? `<small class="notification-product">${note.product_name}</small>` : '';
            const noteDate = note.created_at ? new Date(note.created_at) : null;
            const dateLabel = noteDate && !Number.isNaN(noteDate.getTime())
                ? noteDate.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '';
            return `
            <div class="notification-item ${note.is_read ? '' : 'unread'}" data-id="${note.id}" data-order-id="${note.order_id || ''}">
                <img class="notification-thumb" src="${productImage}" alt="${note.product_name || 'Product'}" onerror="this.src=window.__PLACEHOLDER_IMAGE__">
                <div class="notification-content">
                    <strong>${note.title || 'Notification'}</strong>
                    <p>${note.message || ''}</p>
                    ${productLabel}
                    ${dateLabel ? `<small class="notification-date">${dateLabel}</small>` : ''}
                </div>
            </div>
        `;
        }).join('');

        list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                const orderId = Number(item.getAttribute('data-order-id') || 0);
                this.markNotificationRead(id, { navigateToOrderId: orderId > 0 ? orderId : null });
            });
        });
    }

    toggleNotificationsDropdown() {
        const dropdown = document.getElementById('notifications-dropdown');
        if (!dropdown) return;
        dropdown.classList.toggle('open');
    }

    toggleNotificationsFullView() {
        const dropdown = document.getElementById('notifications-dropdown');
        const button = document.getElementById('notifications-toggle-view');
        if (!dropdown || !button) return;
        const isFull = dropdown.classList.toggle('full-view');
        button.textContent = isFull ? 'Compact' : 'Full';
    }

    async markNotificationRead(id, options = {}) {
        const { navigateToOrderId = null } = options;
        try {
            const response = await fetch(`${this.apiBase}/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                this.loadNotifications();
                if (navigateToOrderId) {
                    const next = this.buildOrdersUrl({ highlightOrderId: navigateToOrderId });
                    window.location.href = next;
                }
            }
        } catch (error) {
            console.error('Error marking notification read:', error);
        }
    }

    async markAllNotificationsRead() {
        try {
            const response = await fetch(`${this.apiBase}/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                this.loadNotifications();
            }
        } catch (error) {
            console.error('Error marking all notifications read:', error);
        }
    }

    async loadUserProfile() {
        try {
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUserProfile = data.user;
                const displayName = data.user.username || data.user.full_name || 'Account';
                const userNameEl = document.getElementById('user-name');
                const userInitialEl = document.getElementById('user-initial');
                if (userNameEl) userNameEl.textContent = displayName;
                if (userInitialEl) userInitialEl.textContent = String(displayName).charAt(0).toUpperCase();

                // Show admin panel button for super admin
                const adminPanelBtn = document.getElementById('super-admin-panel-btn');
                if (data.user.role === 'super_admin' && adminPanelBtn) {
                    adminPanelBtn.style.display = 'inline-block';
                } else if (adminPanelBtn) {
                    adminPanelBtn.style.display = 'none';
                }

                // Super admin can access main site via admin panel button (no auto-redirect)

                // Auto-redirect staff users to their dashboard
                if (data.user.role === 'staff' && (window.location.pathname === '/' || window.location.pathname.includes('index.html'))) {
                    window.location.href = '/admin.html';
                    return;
                }

                // Auto-redirect farmers to their dashboard
                if (data.user.role === 'farmer' && (window.location.pathname === '/' || window.location.pathname.includes('index.html'))) {
                    window.location.href = '/farmer.html';
                    return;
                }
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }

    async openMyAccountModal() {
        const modal = document.getElementById('my-account-modal');
        if (!modal || !this.currentUserProfile) return;

        const profile = this.currentUserProfile;
        const usernameEl = document.getElementById('my-account-username');
        const firstNameEl = document.getElementById('my-account-firstname');
        const middleNameEl = document.getElementById('my-account-middlename');
        const lastNameEl = document.getElementById('my-account-lastname');
        const emailEl = document.getElementById('my-account-email');
        const phoneEl = document.getElementById('my-account-phone');
        const provinceEl = document.getElementById('my-account-province');
        const cityEl = document.getElementById('my-account-city');
        const barangayEl = document.getElementById('my-account-barangay');
        const streetEl = document.getElementById('my-account-street');
        const addressPreviewEl = document.getElementById('my-account-address');
        const nameParts = this.deriveNameParts(profile);

        if (usernameEl) usernameEl.value = profile.username || '';
        if (firstNameEl) firstNameEl.value = nameParts.firstName || '';
        if (middleNameEl) middleNameEl.value = nameParts.middleName || '';
        if (lastNameEl) lastNameEl.value = nameParts.lastName || '';
        if (emailEl) emailEl.value = profile.email || '';
        if (phoneEl) phoneEl.value = this.formatPhoneInputValue(String(profile.phone || '').replace(/^\+63/, ''));

        // Reset address selects
        const zoneEl = document.getElementById('my-account-zone');
        if (zoneEl) {
            zoneEl.disabled = true;
            zoneEl.innerHTML = '<option value="">Loading address options...</option>';
        }
        if (cityEl) { cityEl.innerHTML = '<option value="">Select City / Municipality</option>'; cityEl.disabled = true; }
        if (barangayEl) { barangayEl.innerHTML = '<option value="">Select Barangay</option>'; barangayEl.disabled = true; }
        if (provinceEl) { provinceEl.innerHTML = '<option value="">Select Province</option>'; provinceEl.disabled = true; }
        if (streetEl) streetEl.value = '';
        // Show existing address as preview until user re-selects
        if (addressPreviewEl) addressPreviewEl.value = profile.address || '';

        this.clearMyAccountPasswordFields();
        modal.classList.add('open');

        const psgc = await this.waitForPsgc();
        if (zoneEl && psgc) {
            psgc.loadZones(zoneEl);
            zoneEl.value = '';
            zoneEl.disabled = false;
        } else if (zoneEl) {
            zoneEl.innerHTML = '<option value="">Address options unavailable</option>';
            zoneEl.disabled = true;
        }
    }

    async handleMyAccountZoneChange() {
        if (!window.PSGC) return;
        const zone = document.getElementById('my-account-zone')?.value || '';
        const provinceEl = document.getElementById('my-account-province');
        const cityEl = document.getElementById('my-account-city');
        const barangayEl = document.getElementById('my-account-barangay');
        await window.PSGC.onZoneChange(zone, { provinceEl, cityEl, barangayEl }).catch(() => {});
        this.updateMyAccountAddressPreview();
    }

    async handleMyAccountProvinceChange() {
        const provinceEl = document.getElementById('my-account-province');
        const cityEl = document.getElementById('my-account-city');
        const barangayEl = document.getElementById('my-account-barangay');
        if (!provinceEl || !cityEl || !barangayEl || !window.PSGC) return;
        const province = provinceEl.value;
        if (province) {
            await window.PSGC.loadCities(province, cityEl).catch(() => {});
            cityEl.disabled = false;
        } else {
            cityEl.innerHTML = '<option value="">Select City / Municipality</option>';
            cityEl.disabled = true;
        }
        barangayEl.innerHTML = '<option value="">Select Barangay</option>';
        barangayEl.disabled = true;
        this.updateMyAccountAddressPreview();
    }

    async handleMyAccountCityChange() {
        const cityEl = document.getElementById('my-account-city');
        const barangayEl = document.getElementById('my-account-barangay');
        if (!cityEl || !barangayEl || !window.PSGC) return;
        const city = cityEl.value;
        if (city) {
            await window.PSGC.loadBarangays(city, barangayEl).catch(() => {});
            barangayEl.disabled = false;
        } else {
            barangayEl.innerHTML = '<option value="">Select Barangay</option>';
            barangayEl.disabled = true;
        }
        this.updateMyAccountAddressPreview();
    }

    updateMyAccountAddressPreview() {
        const province = document.getElementById('my-account-province')?.value?.trim() || '';
        const city = document.getElementById('my-account-city')?.value?.trim() || '';
        const barangay = document.getElementById('my-account-barangay')?.value?.trim() || '';
        const street = document.getElementById('my-account-street')?.value?.trim() || '';
        const previewEl = document.getElementById('my-account-address');
        if (!previewEl) return;
        if (province || city || barangay || street) {
            previewEl.value = window.PSGC
                ? window.PSGC.formatAddress({ street, barangay, city, province })
                : [street, barangay, city, province].filter(Boolean).join(', ');
        } else {
            // Keep existing address text as preview when no new selections made
        }
    }

    closeMyAccountModal() {
        const modal = document.getElementById('my-account-modal');
        if (modal) {
            modal.classList.remove('open');
            this.clearMyAccountPasswordFields();
        }
    }

    toggleMyAccountPasswordSection(forceOpen = null) {
        const fields = document.getElementById('my-account-password-fields');
        const mainFields = document.getElementById('my-account-main-fields');
        const toggleBtn = document.getElementById('toggle-my-password-section');
        if (!fields) return;
        const willOpen = forceOpen === null ? !!fields.hidden : !!forceOpen;
        fields.hidden = !willOpen;
        if (mainFields) {
            mainFields.hidden = willOpen;
        }
        if (toggleBtn) {
            toggleBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
        }
    }

    bindPasswordToggle(buttonId, inputId) {
        const button = document.getElementById(buttonId);
        const input = document.getElementById(inputId);
        if (!button || !input) return;
        button.addEventListener('click', () => {
            const icon = button.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                if (icon) {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                }
            } else {
                input.type = 'password';
                if (icon) {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    }

    clearMyAccountPasswordFields() {
        const currentEl = document.getElementById('my-account-current-password');
        const nextEl = document.getElementById('my-account-new-password');
        const confirmEl = document.getElementById('my-account-confirm-password');
        const currentToggle = document.getElementById('toggle-my-account-current-password')?.querySelector('i');
        const nextToggle = document.getElementById('toggle-my-account-new-password')?.querySelector('i');
        const confirmToggle = document.getElementById('toggle-my-account-confirm-password')?.querySelector('i');
        if (currentEl) currentEl.value = '';
        if (nextEl) nextEl.value = '';
        if (confirmEl) confirmEl.value = '';
        if (currentEl) currentEl.type = 'password';
        if (nextEl) nextEl.type = 'password';
        if (confirmEl) confirmEl.type = 'password';
        if (currentToggle) {
            currentToggle.classList.remove('fa-eye-slash');
            currentToggle.classList.add('fa-eye');
        }
        if (nextToggle) {
            nextToggle.classList.remove('fa-eye-slash');
            nextToggle.classList.add('fa-eye');
        }
        if (confirmToggle) {
            confirmToggle.classList.remove('fa-eye-slash');
            confirmToggle.classList.add('fa-eye');
        }
        this.toggleMyAccountPasswordSection(false);
    }

    async saveMyAccount() {
        const first_name = document.getElementById('my-account-firstname')?.value?.trim() || '';
        const middle_name = document.getElementById('my-account-middlename')?.value?.trim() || '';
        const last_name = document.getElementById('my-account-lastname')?.value?.trim() || '';
        const phoneRaw = document.getElementById('my-account-phone')?.value || '';
        const province = document.getElementById('my-account-province')?.value?.trim() || '';
        const city = document.getElementById('my-account-city')?.value?.trim() || '';
        const barangay = document.getElementById('my-account-barangay')?.value?.trim() || '';
        const street = document.getElementById('my-account-street')?.value?.trim() || '';
        const phoneDigits = String(phoneRaw).replace(/\D/g, '');
        const full_name = [first_name, middle_name, last_name].filter(Boolean).join(' ').trim();

        // If any address field is touched, all four must be filled
        let address = null;
        const anyAddressFilled = province || city || barangay || street;
        if (anyAddressFilled) {
            if (!province || !city || !barangay || !street) {
                this.showMessage('Please complete all address fields: province, city, barangay, and street.', 'error');
                return;
            }
            address = window.PSGC
                ? window.PSGC.formatAddress({ street, barangay, city, province })
                : [street, barangay, city, province].filter(Boolean).join(', ');
        }

        if (!first_name || !last_name || phoneDigits.length !== 10) {
            this.showMessage('Please complete first name, last name, and a 10-digit phone number.', 'error');
            return;
        }

        const payload = {
            full_name,
            first_name,
            middle_name: middle_name || null,
            last_name,
            phone: `+63${phoneDigits}`
        };
        if (address !== null) payload.address = address;

        try {
            const response = await fetch(`${this.apiBase}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Failed to save account changes.', 'error');
                return;
            }

            this.showMessage('My Account updated successfully.', 'success');
            await this.loadUserProfile();
            this.closeMyAccountModal();
        } catch (error) {
            console.error('Save my account error:', error);
            this.showMessage('Failed to save account changes.', 'error');
        }
    }

    async changeMyAccountPassword() {
        const currentPassword = document.getElementById('my-account-current-password')?.value || '';
        const newPassword = document.getElementById('my-account-new-password')?.value || '';
        const confirmPassword = document.getElementById('my-account-confirm-password')?.value || '';

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showMessage('Please fill in all password fields.', 'error');
            return;
        }

        if (newPassword.length < 6) {
            this.showMessage('New password must be at least 6 characters.', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showMessage('New passwords do not match.', 'error');
            return;
        }

        if (newPassword === currentPassword) {
            this.showMessage('New password must be different from current password.', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                this.showMessage(data.message || 'Failed to change password.', 'error');
                return;
            }

            this.showMessage(data.message || 'Password changed successfully.', 'success');
            this.clearMyAccountPasswordFields();
        } catch (error) {
            console.error('Change my account password error:', error);
            this.showMessage('Failed to change password.', 'error');
        }
    }

    async sendOtp() {
        return this.sendOtpForRegistration();
    }

    async verifyOtp() {
        const mode = this.authMode || (document.getElementById('auth-login-fields').style.display !== 'none' ? 'login' : 'register');
        const otpInput = mode === 'login' ? document.getElementById('login-otp') : document.getElementById('register-otp');
        const otp = otpInput.value.trim();

        if (!otp || otp.length !== 6) {
            this.showMessage('Please enter a valid 6-digit OTP', 'error');
            return;
        }

        if (!this.otpEmail) {
            this.showMessage('Please send OTP first', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/otp/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: this.otpEmail,
                    otp: otp,
                    purpose: mode
                })
            });

            const data = await response.json();

            if (response.ok && data.verified) {
                this.otpVerified = true;
                this.updateSubmitButtonText();
                this.showMessage('OTP verified successfully!', 'success');
                return true;
            } else {
                this.showMessage(data.message || 'Invalid OTP', 'error');
                return false;
            }
        } catch (error) {
            console.error('Verify OTP error:', error);
            this.showMessage('Failed to verify OTP. Please try again.', 'error');
            return false;
        }
    }

    showOtpSection() {
        const mode = this.authMode || (document.getElementById('auth-login-fields').style.display !== 'none' ? 'login' : 'register');
        const otpSection = mode === 'login' 
            ? document.getElementById('login-otp-section')
            : document.getElementById('register-otp-section');
        const sendOtpBtn = document.getElementById('send-otp-btn');

        if (otpSection) {
            otpSection.style.display = 'block';
        }
        if (sendOtpBtn) {
            sendOtpBtn.style.display = 'none';
        }
        
        this.updateSubmitButtonText();
        
        // Focus on OTP input
        const otpInput = mode === 'login' ? document.getElementById('login-otp') : document.getElementById('register-otp');
        if (otpInput) {
            setTimeout(() => otpInput.focus(), 100);
        }
    }

    updateSubmitButtonText() {
        const mode = this.authMode || (document.getElementById('auth-login-fields').style.display !== 'none' ? 'login' : 'register');
        const submitBtn = document.getElementById('auth-submit-btn');
        if (submitBtn) {
            // Hide submit button during registration (we use step navigation instead)
            if (mode === 'register') {
                submitBtn.style.display = 'none';
                return;
            }
            // For login mode, show and update button text (no OTP required)
            submitBtn.style.display = 'block';
            submitBtn.textContent = 'Login';
        }
    }

    // Password strength feature removed

    validateField(field) {
        if (!field) return;

        // Remove previous validation classes
        field.classList.remove('valid', 'invalid');

        // If the field is empty, leave it neutral (no red/green) — avoid marking required empty fields as invalid immediately
        if (!field.value.trim()) {
            return;
        }

        // Validate based on field type
        if (field.checkValidity()) {
            field.classList.add('valid');
        } else {
            field.classList.add('invalid');
        }
    }

    getRecaptchaSiteKey() {
        return window.agriCatchConfig?.RECAPTCHA_SITE_KEY || '6Ldmst0sAAAAAAV8rDvnnbsHQ1nJvvaiy2xfOZWj';
    }

    resolveRecaptchaScope(scope = 'auth') {
        if (scope !== 'auth') return scope;
        const loginFields = document.getElementById('auth-login-fields');
        const mode = this.authMode || (loginFields && loginFields.style.display !== 'none' ? 'login' : 'register');
        return mode === 'login' ? 'authLogin' : 'authRegister';
    }

    getRecaptchaErrorElementId(scope = 'auth') {
        const resolvedScope = this.resolveRecaptchaScope(scope);
        if (resolvedScope === 'forgot') return 'forgot-recaptcha-error';
        return resolvedScope === 'authLogin' ? 'auth-recaptcha-login-error' : 'auth-recaptcha-error';
    }

    renderRecaptchaWidgets() {
        if (!window.grecaptcha || typeof window.grecaptcha.render !== 'function') {
            return false;
        }

        const renderWidget = (scope, containerId) => {
            const container = document.getElementById(containerId);
            if (!container) return;
            if (this.recaptchaWidgetIds[scope] !== null) return;

            try {
                this.recaptchaWidgetIds[scope] = window.grecaptcha.render(containerId, {
                    sitekey: this.getRecaptchaSiteKey(),
                    callback: () => this.clearRecaptchaError(scope),
                    'expired-callback': () => this.setRecaptchaError(scope, 'CAPTCHA expired. Please verify again.'),
                    'error-callback': () => this.setRecaptchaError(scope, 'CAPTCHA failed to load. Please refresh and try again.')
                });
            } catch (error) {
                console.error(`Failed to render ${scope} reCAPTCHA:`, error);
            }
        };

        if (window.grecaptcha.ready) {
            window.grecaptcha.ready(() => {
                renderWidget('authLogin', 'auth-recaptcha-login');
                renderWidget('authRegister', 'auth-recaptcha');
                renderWidget('forgot', 'forgot-recaptcha');
            });
        } else {
            renderWidget('authLogin', 'auth-recaptcha-login');
            renderWidget('authRegister', 'auth-recaptcha');
            renderWidget('forgot', 'forgot-recaptcha');
        }

        return true;
    }

    getRecaptchaResponse(scope = 'auth') {
        if (!window.grecaptcha || typeof window.grecaptcha.getResponse !== 'function') {
            return '';
        }
        const resolvedScope = this.resolveRecaptchaScope(scope);
        if (this.recaptchaWidgetIds[resolvedScope] === null) {
            this.renderRecaptchaWidgets();
        }
        const widgetId = this.recaptchaWidgetIds[resolvedScope];
        if (widgetId === null || widgetId === undefined) {
            return '';
        }
        return String(window.grecaptcha.getResponse(widgetId) || '').trim();
    }

    resetRecaptcha(scope = 'auth') {
        const scopes = scope === 'auth' ? ['authLogin', 'authRegister'] : [this.resolveRecaptchaScope(scope)];
        scopes.forEach((resolvedScope) => {
            const widgetId = this.recaptchaWidgetIds[resolvedScope];
            if (widgetId === null || widgetId === undefined) return;
            if (window.grecaptcha && typeof window.grecaptcha.reset === 'function') {
                try {
                    window.grecaptcha.reset(widgetId);
                } catch (error) {
                    console.warn(`Failed to reset ${resolvedScope} reCAPTCHA:`, error);
                }
            }
            this.clearRecaptchaError(resolvedScope);
        });
    }

    setRecaptchaError(scope = 'auth', message) {
        const errorEl = document.getElementById(this.getRecaptchaErrorElementId(scope));
        if (!errorEl) return;
        if (message) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        } else {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    clearRecaptchaError(scope = 'auth') {
        this.setRecaptchaError(scope, '');
    }

    setRegisterRecaptchaVisible(visible) {
        const wrap = document.getElementById('auth-recaptcha-wrap');
        if (wrap) {
            wrap.style.display = visible ? 'block' : 'none';
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const email = document.getElementById('auth-email').value.trim();
        const password = document.getElementById('auth-password').value;

        if (!email || !password) {
            this.showMessage('Please enter email and password', 'error');
            return;
        }

        const recaptchaResponse = this.getRecaptchaResponse('auth');
        if (!recaptchaResponse) {
            this.setRecaptchaError('auth', 'Please complete the CAPTCHA before logging in.');
            this.showMessage('Please complete the CAPTCHA before logging in.', 'error');
            return;
        }

        // Prepare payload without sending a client-chosen role
        const payload = { email, password, 'g-recaptcha-response': recaptchaResponse };

        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            let data;
            const ct = response.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                data = await response.json();
            } else {
                const text = await response.text();
                this.resetRecaptcha('auth');
                if (!response.ok) {
                    this.showMessage(text || 'Login failed', 'error');
                    return;
                }
                this.showMessage('Unexpected non-JSON login response', 'error');
                return;
            }

            if (response.ok) {
                this.resetRecaptcha('auth');
                const userRole = data.user?.role;

                this.token = data.token;
                localStorage.setItem('token', this.token);

                // Clear and close auth UI
                this.clearFormData('login');
                localStorage.removeItem('last_registration_step');
                localStorage.removeItem('last_otp_sent');
                localStorage.removeItem('last_otp_verified');
                localStorage.removeItem('last_otp_email');
                this.clearAuthForm();
                this.closeAuthFlow();

                // Redirect / update UI based on server-determined role
                if (userRole === 'super_admin' || userRole === 'staff') {
                    this.showMessage('Staff login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = '/admin.html';
                    }, 1000);
                } else if (userRole === 'farmer') {
                    this.showMessage('Farmer login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = '/farmer.html';
                    }, 1000);
                } else {
                    // Customer or unknown role: stay in UI
                    this.showUserMenu();
                    this.migrateGuestCart();
                    this.showMessage('Login successful!', 'success');
                    if (this.pendingCheckout) {
                        this.pendingCheckout = false;
                        setTimeout(() => this.openCheckoutModal(), 500);
                    }
                    if (this.returnUrl) {
                        setTimeout(() => { window.location.href = this.returnUrl; }, 1000);
                    }
                }

                return;
            } else {
                this.resetRecaptcha('auth');
                // If login failed due to OTP verification, reset OTP state
                if (data.message && (data.message.includes('OTP verification') || data.message.includes('OTP'))) {
                    this.otpVerified = false;
                    this.updateSubmitButtonText();
                    this.showMessage(data.message || 'OTP verification required. Please verify your OTP first.', 'error');
                } else {
                    this.showMessage(data.message || 'Login failed', 'error');
                }
            }
        } catch (error) {
            console.error('Login error:', error);
            this.resetRecaptcha('auth');
            this.showMessage('Login failed. Please try again.', 'error');
        }
    }

    validatePasswordMatch() {
        const password = document.getElementById('auth-password-register').value;
        const confirmPassword = document.getElementById('auth-password-confirm').value;
        const hint = document.getElementById('password-match-hint');
        
        if (!hint) return;
        
        if (confirmPassword.length === 0) {
            hint.textContent = '';
            hint.className = '';
            return;
        }
        
        if (password === confirmPassword) {
            hint.textContent = '✓ Passwords match';
            hint.className = 'match';
        } else {
            hint.textContent = '✗ Passwords do not match';
            hint.className = 'no-match';
        }
    }

    async handleRegistrationStep(step, direction) {
        if (this.isLoading) return; // Prevent multiple clicks during loading
        
        console.log('handleRegistrationStep called:', { step, direction });
        
        if (direction === 'next') {
            // Validate current step before proceeding
            if (!this.validateRegistrationStep(step)) {
                console.log('Step validation failed for step:', step);
                return;
            }
            
            // Show loading animation
            this.setButtonLoading(`register-next-${step}`, true);
            
            // Special handling for step 1 (Email + OTP Verification)
            if (step === 1) {
                const email = document.getElementById('auth-email-register').value.trim();
                
                // CRITICAL: Only allow proceeding if OTP is verified for the current email
                if (this.otpVerified && this.otpEmail && this.otpEmail === email) {
                    // OTP is verified and email matches - proceed to step 2
                    console.log('OTP verified for this email, proceeding to step 2');
                    this.setButtonLoading(`register-next-${step}`, false);
                    this.goToRegistrationStep(2);
                    // Clear persisted registration fields after OTP is verified and proceeding
                    localStorage.removeItem('register_email');
                    localStorage.removeItem('register_otp');
                    return;
                }
                
                // OTP not verified - check if OTP section is shown
                const otpSection = document.getElementById('register-otp-section');
                if (!otpSection || otpSection.style.display === 'none') {
                    // OTP section not shown - send OTP first
                    console.log('Sending OTP for registration...');
                    this.sendOtpForRegistration();
                    return;
                } else {
                    // OTP section is shown - verify OTP first before proceeding
                    console.log('Verifying OTP for registration...');
                    // Don't return here - let verifyOtpForRegistration handle the flow
                    // It will call goToRegistrationStep(2) on success
                    await this.verifyOtpForRegistration();
                    return;
                }
            }
            
            // Special handling for step 2 (Username and Password) - check username availability
            if (step === 2) {
                const username = document.getElementById('auth-username').value.trim();
                
                if (!username) {
                    this.setButtonLoading(`register-next-${step}`, false);
                    return;
                }
                
                // Check username availability before proceeding
                this.setButtonLoading(`register-next-${step}`, true);
                const usernameAvailable = await this.checkUsernameAvailability(username);
                this.setButtonLoading(`register-next-${step}`, false);
                
                if (!usernameAvailable) {
                    // Error message already shown in checkUsernameAvailability
                    return;
                }
                
                // Username is available, proceed to next step
                console.log('Moving to step:', step + 1);
                setTimeout(() => {
                    this.setButtonLoading(`register-next-${step}`, false);
                    this.goToRegistrationStep(step + 1);
                }, 300);
                return;
            }
            
            // Move to next step
            if (step < this.maxRegistrationSteps) {
                console.log('Moving to step:', step + 1);
                setTimeout(() => {
                    this.setButtonLoading(`register-next-${step}`, false);
                    this.goToRegistrationStep(step + 1);
                }, 300);
            }
        } else if (direction === 'back') {
            if (step > 1) {
                // Prevent going back to step 1 if OTP is already verified
                if (step - 1 === 1 && this.otpVerified) {
                    console.log('Cannot go back to step 1 - OTP already verified');
                    this.showMessage('Step 1 is locked after OTP verification. Please refresh the page to start over.', 'info');
                    return;
                }
                console.log('Moving back to step:', step - 1);
                this.goToRegistrationStep(step - 1);
            }
        }
    }

    setButtonLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        if (!button) return;
        
        this.isLoading = isLoading;
        
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');
        
        if (isLoading) {
            button.disabled = true;
            if (btnText) btnText.style.display = 'none';
            if (btnLoader) btnLoader.style.display = 'inline-flex';
        } else {
            button.disabled = false;
            if (btnText) btnText.style.display = 'inline';
            if (btnLoader) btnLoader.style.display = 'none';
        }
    }

    validateRegistrationStep(step) {
        switch(step) {
            case 1:
                const email = document.getElementById('auth-email-register').value.trim();
                
                if (!email) {
                    this.showMessage('Please enter your email address', 'error');
                    document.getElementById('auth-email-register').focus();
                    return false;
                }
                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                    this.showMessage('Please enter a valid email address', 'error');
                    document.getElementById('auth-email-register').focus();
                    return false;
                }
                
                // Check if OTP section is visible - if so, allow verification to happen in handleRegistrationStep
                const otpSection = document.getElementById('register-otp-section');
                const otpInput = document.getElementById('register-otp');
                const hasOtpEntered = otpInput && otpInput.value.trim().length === 6;
                
                // If OTP section is visible and OTP is entered, skip validation here
                // (verification will happen in handleRegistrationStep)
                if (otpSection && otpSection.style.display !== 'none' && hasOtpEntered) {
                    // OTP is entered and section is visible - allow verification to proceed
                    return true;
                }
                
                // CRITICAL: OTP must be verified before proceeding to step 2
                if (!this.otpVerified || !this.otpEmail || this.otpEmail !== email) {
                    // If OTP section is visible but no OTP entered, show error
                    if (otpSection && otpSection.style.display !== 'none') {
                        const otp = otpInput ? otpInput.value.trim() : '';
                        if (!otp || otp.length !== 6) {
                            this.showMessage('Please enter a valid 6-digit OTP', 'error');
                            if (otpInput) otpInput.focus();
                            return false;
                        }
                    } else {
                        // OTP section not visible - show message to send OTP first
                        // Removed message: 'Please verify your email with the OTP code first'
                        // Show OTP section if it's hidden
                        if (otpSection && otpSection.style.display === 'none') {
                            // If OTP hasn't been sent yet, send it
                            if (!this.otpSent) {
                                this.sendOtpForRegistration();
                            } else {
                                otpSection.style.display = 'block';
                            }
                        }
                        // Focus on OTP input if visible, otherwise focus on email
                        if (otpInput && otpSection && otpSection.style.display !== 'none') {
                            otpInput.focus();
                        } else {
                            document.getElementById('auth-email-register').focus();
                        }
                        return false;
                    }
                }
                return true;
                
            case 2:
                const username = document.getElementById('auth-username').value.trim();
                const password = document.getElementById('auth-password-register').value;
                const confirmPassword = document.getElementById('auth-password-confirm').value;
                
                if (!username) {
                    this.showMessage('Please enter a username', 'error');
                    document.getElementById('auth-username').focus();
                    return false;
                }
                if (username.length < 3 || username.length > 20) {
                    this.showMessage('Username must be between 3 and 20 characters', 'error');
                    document.getElementById('auth-username').focus();
                    return false;
                }
                if (!/^[a-zA-Z0-9_]+$/.test(username)) {
                    this.showMessage('Username can only contain letters, numbers, and underscores', 'error');
                    document.getElementById('auth-username').focus();
                    return false;
                }
                if (!password) {
                    this.showMessage('Please enter a password', 'error');
                    document.getElementById('auth-password-register').focus();
                    return false;
                }
                if (password.length < 6) {
                    this.showMessage('Password must be at least 6 characters long', 'error');
                    document.getElementById('auth-password-register').focus();
                    return false;
                }
                if (!confirmPassword) {
                    this.showMessage('Please confirm your password', 'error');
                    document.getElementById('auth-password-confirm').focus();
                    return false;
                }
                if (password !== confirmPassword) {
                    this.showMessage('Passwords do not match', 'error');
                    document.getElementById('auth-password-confirm').focus();
                    return false;
                }
                return true;
                
            case 3:
                const firstName = document.getElementById('auth-firstname').value.trim();
                const middleName = document.getElementById('auth-middlename').value.trim();
                const lastName = document.getElementById('auth-lastname').value.trim();
                const phone = document.getElementById('auth-phone').value.trim();
                const street = document.getElementById('auth-street').value.trim();
                const province = document.getElementById('auth-province')?.value.trim();
                const city = document.getElementById('auth-city')?.value.trim();
                const barangay = document.getElementById('auth-barangay')?.value.trim();
                const zone = document.getElementById('auth-zone')?.value.trim();
                
                if (!firstName) {
                    this.showMessage('Please enter your first name', 'error');
                    document.getElementById('auth-firstname').focus();
                    return false;
                }
                if (!lastName) {
                    this.showMessage('Please enter your last name', 'error');
                    document.getElementById('auth-lastname').focus();
                    return false;
                }
                if (!phone) {
                    this.showMessage('Please enter your contact number', 'error');
                    document.getElementById('auth-phone').focus();
                    return false;
                }
                // Validate phone number: must match 9XX XXX XXXX (10 digits, starts with 9, remove leading 0)
                let phoneDigits = phone.replace(/\D/g, '');
                if (phoneDigits.startsWith('0')) phoneDigits = phoneDigits.substring(1);
                if (phoneDigits.length !== 10 || phoneDigits[0] !== '9') {
                    this.showMessage('Please enter a valid contact number (10 digits starting with 9).', 'error');
                    document.getElementById('auth-phone').focus();
                    return false;
                }
                if (!street) {
                    this.showMessage('Please enter your street/building/house number', 'error');
                    document.getElementById('auth-street')?.focus();
                    return false;
                }
                if (!province || !city || !barangay) {
                    this.showMessage('Please select your zone, province, city, and barangay from the dropdowns', 'error');
                    document.getElementById('auth-zone')?.focus();
                    return false;
                }
                this.updateRegistrationAddressPreview();
                const address = document.getElementById('auth-address').value.trim();
                if (!address) {
                    this.showMessage('Please enter your address', 'error');
                    document.getElementById('auth-address').focus();
                    return false;
                }
                return true;
                
            case 4:
                if (!this.selectedRole) {
                    this.showMessage('Please select your account type', 'error');
                    return false;
                }
                const termsChecked = document.getElementById('auth-terms-checkbox').checked;
                if (!termsChecked) {
                    this.showMessage('You must agree to the Terms and Conditions to continue', 'error');
                    return false;
                }
                return true;
                
            default:
                return true;
        }
    }

    goToRegistrationStep(step) {
        // Prevent going back to step 1 if OTP is already verified (lock step 1)
        if (step === 1 && this.otpVerified) {
            console.log('Cannot navigate to step 1 - OTP already verified and step 1 is locked');
            this.showMessage('Step 1 is locked after OTP verification. Please refresh the page to start over.', 'info');
            // Stay on current step instead of going to step 1
            return;
        }
        
        // Hide all steps
        for (let i = 1; i <= this.maxRegistrationSteps; i++) {
            const stepEl = document.getElementById(`register-step-${i}`);
            if (stepEl) {
                stepEl.style.display = 'none';
            }
            const progressStep = document.querySelector(`.progress-step[data-step="${i}"]`);
            if (progressStep) {
                progressStep.classList.remove('active', 'completed');
            }
        }
        
        // Show current step
        const currentStepEl = document.getElementById(`register-step-${step}`);
        if (currentStepEl) {
            currentStepEl.style.display = 'block';
        }
        
        // Update progress indicator
        // Mark all steps before current step as completed
        for (let i = 1; i < step; i++) {
            const progressStep = document.querySelector(`.progress-step[data-step="${i}"]`);
            if (progressStep) {
                progressStep.classList.add('completed');
            }
        }
        
        // If OTP is verified, always mark step 2 as completed (even when on step 1)
        if (this.otpVerified) {
            const step2Progress = document.querySelector(`.progress-step[data-step="2"]`);
            if (step2Progress) {
                step2Progress.classList.add('completed');
            }
        }
        
        // If we're on step 2 or beyond, mark step 1 as completed
        if (step >= 2) {
            const step1Progress = document.querySelector(`.progress-step[data-step="1"]`);
            if (step1Progress) {
                step1Progress.classList.add('completed');
            }
        }
        
        const currentProgressStep = document.querySelector(`.progress-step[data-step="${step}"]`);
        if (currentProgressStep) {
            currentProgressStep.classList.add('active');
        }
        
        this.registrationStep = step;
        
        // Lock step 1 fields if OTP is verified (make them read-only/disabled)
        const emailInput = document.getElementById('auth-email-register');
        const otpInput = document.getElementById('register-otp');
        const otpSection = document.getElementById('register-otp-section');
        this.setRegisterRecaptchaVisible(step === 1 && !this.otpVerified && (!otpSection || otpSection.style.display === 'none'));
        
        if (this.otpVerified && step >= 2) {
            if (emailInput) {
                emailInput.disabled = true;
                emailInput.style.opacity = '0.6';
                emailInput.style.cursor = 'not-allowed';
                emailInput.title = 'Email is locked after OTP verification';
            }
            
            if (otpInput) {
                otpInput.disabled = true;
                otpInput.style.opacity = '0.6';
                otpInput.style.cursor = 'not-allowed';
                otpInput.title = 'OTP is locked after verification';
            }
            
            // Hide OTP section since it's locked
            if (otpSection) {
                otpSection.style.display = 'none';
            }
        } else if (!this.otpVerified) {
            // Re-enable fields if OTP is not verified
            if (emailInput) {
                emailInput.disabled = false;
                emailInput.style.opacity = '1';
                emailInput.style.cursor = 'text';
                emailInput.title = '';
            }
            
            if (otpInput) {
                otpInput.disabled = false;
                otpInput.style.opacity = '1';
                otpInput.style.cursor = 'text';
                otpInput.title = '';
            }
        }
        
        // Disable back button that would go to step 1 if OTP is verified
        const backButton2 = document.getElementById('register-back-2');
        const backButton3 = document.getElementById('register-back-3');
        const backButton4 = document.getElementById('register-back-4');

        // Only disable back button on step 2 (which goes to step 1) when OTP is verified
        if (backButton2 && this.otpVerified && step >= 2) {
            backButton2.disabled = true;
            backButton2.style.opacity = '0.5';
            backButton2.style.cursor = 'not-allowed';
            backButton2.title = 'Cannot go back - Step 1 is locked after OTP verification';
        } else if (backButton2) {
            backButton2.disabled = false;
            backButton2.style.opacity = '1';
            backButton2.style.cursor = 'pointer';
            backButton2.title = '';
        }

        // Back buttons on steps 3 and 4 should always be enabled (they go to steps 2 and 3, not step 1)
        if (backButton3) {
            backButton3.disabled = false;
            backButton3.style.opacity = '1';
            backButton3.style.cursor = 'pointer';
            backButton3.title = '';
        }
        if (backButton4) {
            backButton4.disabled = false;
            backButton4.style.opacity = '1';
            backButton4.style.cursor = 'pointer';
            backButton4.title = '';
        }
        
        // Reset loading states
        this.isLoading = false;
        for (let i = 1; i <= this.maxRegistrationSteps; i++) {
            this.setButtonLoading(`register-next-${i}`, false);
        }
        
        // Focus on first input in the step
        setTimeout(() => {
            const firstInput = currentStepEl?.querySelector('input, textarea, .role-box-enhanced');
            if (firstInput && firstInput.tagName !== 'BUTTON') {
                firstInput.focus();
            }
        }, 100);
        
        // Update button text for step 1 if we're on step 1
        if (step === 1) {
            this.updateRegisterStep1ButtonText();
        }
    }

    updateRegisterStep1ButtonText() {
        // Only update if we're on step 1
        const step1El = document.getElementById('register-step-1');
        if (!step1El || step1El.style.display === 'none') {
            return;
        }
        
        const emailInput = document.getElementById('auth-email-register');
        const nextButtonText = document.getElementById('register-next-1-text');
        const otpSection = document.getElementById('register-otp-section');
        
        if (!emailInput || !nextButtonText) {
            return;
        }
        
        const currentEmail = emailInput.value.trim();
        
        // Check if email matches verified email
        if (this.otpVerified && this.otpEmail && currentEmail === this.otpEmail) {
            // Email matches verified email - show "Next"
            nextButtonText.textContent = 'Next';
        } else if (otpSection && otpSection.style.display !== 'none') {
            // OTP section is visible - show "Confirm OTP" (since resend button is already there)
            nextButtonText.textContent = 'Confirm OTP';
        } else {
            // Email doesn't match or not verified, and OTP section not visible - show "Send Verification Code"
            nextButtonText.textContent = 'Send Verification Code';
        }
    }

    async sendOtpForRegistration(options = {}) {
        const email = document.getElementById('auth-email-register').value.trim();
        const requireRecaptcha = !options.resend;

        if (!email) {
            this.setButtonLoading('register-next-1', false);
            this.showMessage('Please enter your email address first', 'error');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.setButtonLoading('register-next-1', false);
            this.showMessage('Please enter a valid email address', 'error');
            document.getElementById('auth-email-register').focus();
            return;
        }

        let recaptchaResponse = '';
        if (requireRecaptcha) {
            recaptchaResponse = this.getRecaptchaResponse('auth');
            if (!recaptchaResponse) {
                this.setButtonLoading('register-next-1', false);
                this.setRecaptchaError('auth', 'Please complete the CAPTCHA before sending the verification code.');
                this.showMessage('Please complete the CAPTCHA before sending the verification code.', 'error');
                return;
            }
        }

        // Show OTP section immediately when button is clicked (before API call)
        const otpSection = document.getElementById('register-otp-section');
        if (otpSection) {
            otpSection.style.display = 'block';
        }
        this.setRegisterRecaptchaVisible(false);

        // Clear the OTP input field
        const otpInput = document.getElementById('register-otp');
        if (otpInput) {
            otpInput.value = '';
        }

        // Update button text to "Confirm OTP" immediately since OTP section is now visible
        const nextButtonText = document.getElementById('register-next-1-text');
        if (nextButtonText) {
            nextButtonText.textContent = 'Confirm OTP';
        }

        try {
            console.log('Sending OTP request:', { email, purpose: 'register', apiBase: this.apiBase });
            const response = await fetch(`${this.apiBase}/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, purpose: 'register', resend: !!options.resend, 'g-recaptcha-response': recaptchaResponse })
            });
            
            console.log('OTP response status:', response.status);
            const data = await response.json();
            console.log('OTP response data:', data);

            this.resetRecaptcha('auth');
            
            this.setButtonLoading('register-next-1', false);
            let cooldownSeconds = 60;
            // Handle rate limiting (cooldown)
            if (response.status === 429) {
                cooldownSeconds = data.cooldownSeconds || data.retryAfter || 60;
                this.showMessage(data.message || `Please wait ${cooldownSeconds} seconds before requesting another OTP`, 'error');
                this.startResendOtpCooldown(cooldownSeconds);
                // Keep OTP section visible even on cooldown
                return;
            }
            
            if (response.ok) {
                this.otpSent = true;
                this.otpEmail = email;
                // Reset OTP verified state when resending
                this.otpVerified = false;
                // OTP section is already shown above, just ensure it's visible
                if (otpSection) {
                    otpSection.style.display = 'block';
                }
                // Update button text to "Confirm OTP" after successful send
                if (nextButtonText) {
                    nextButtonText.textContent = 'Confirm OTP';
                }
                // Display OTP for testing if provided by backend
                if (data.otp) {
                    console.log('🔑 OTP Code (for testing):', data.otp);
                    console.log('📧 Email:', email);
                    console.log('⏰ Valid for 10 minutes');
                    // Display OTP in the UI
                    const otpDisplay = document.getElementById('otp-test-display');
                    const otpCodeDisplay = document.getElementById('otp-code-display');
                    if (otpDisplay && otpCodeDisplay) {
                        otpCodeDisplay.textContent = data.otp;
                        otpDisplay.style.display = 'block';
                    }
                } else {
                    // Hide OTP display if not in testing mode
                    const otpDisplay = document.getElementById('otp-test-display');
                    if (otpDisplay) {
                        otpDisplay.style.display = 'none';
                    }
                }
                // Start cooldown if provided by backend
                cooldownSeconds = data.cooldownSeconds || data.retryAfter || 60;
                this.startResendOtpCooldown(cooldownSeconds);
                // Don't navigate - stay on step 1, just show OTP section
                this.setButtonLoading('register-next-1', false);
            } else {
                // Show more detailed error message
                let errorMessage = data.message || 'Failed to send OTP';
                // Check for specific error cases
                if (data.message && data.message.includes('already registered')) {
                    // Short, clear message for already-registered emails
                    errorMessage = 'This email is already registered.';
                    // Mark the email input as invalid so it shows red and focus it
                    const emailInputEl = document.getElementById('auth-email-register');
                    if (emailInputEl) {
                        emailInputEl.classList.add('invalid');
                        try { emailInputEl.focus(); } catch (e) {}
                    }
                } else if (data.error) {
                    console.error('OTP send error details:', data.error);
                    if (data.error.includes('Invalid login') || data.error.includes('authentication failed')) {
                        errorMessage = 'SMTP authentication failed. Please check email configuration.';
                    } else if (data.error.includes('ECONNREFUSED') || data.error.includes('connection')) {
                        errorMessage = 'Cannot connect to email server. Please check your internet connection.';
                    } else if (data.error.includes('timeout')) {
                        errorMessage = 'Email server timeout. Please try again in a moment.';
                    } else {
                        errorMessage = `${errorMessage}. Error: ${data.error}`;
                    }
                }
                console.error('OTP send failed:', { status: response.status, message: errorMessage, data });
                this.showMessage(errorMessage, 'error');
                // Keep OTP section visible and set button text to 'Confirm OTP' even on error
                const nextButtonText = document.getElementById('register-next-1-text');
                if (nextButtonText) {
                    nextButtonText.textContent = 'Confirm OTP';
                }
                // Start cooldown if provided by backend
                cooldownSeconds = data.cooldownSeconds || data.retryAfter || 60;
                this.startResendOtpCooldown(cooldownSeconds);
                // Keep OTP section visible even on error (user already clicked, they expect to see it)
            }
        } catch (error) {
            this.setButtonLoading('register-next-1', false);
            console.error('Send OTP error:', error);
            this.resetRecaptcha('auth');
            // Keep OTP section visible and set button text to 'Confirm OTP' even on network error
            const nextButtonText = document.getElementById('register-next-1-text');
            if (nextButtonText) {
                nextButtonText.textContent = 'Confirm OTP';
            }
            // Start default cooldown on error
            this.startResendOtpCooldown(60);
            // Keep OTP section visible even on network error
        }
    }

    async verifyOtpForRegistration() {
        const otp = document.getElementById('register-otp').value.trim();
        
        if (!otp || otp.length !== 6) {
            this.setButtonLoading('register-next-1', false);
            this.showMessage('Please enter a valid 6-digit OTP', 'error');
            return;
        }
        
        if (!this.otpEmail) {
            this.setButtonLoading('register-next-1', false);
            this.showMessage('Please send OTP first', 'error');
            return;
        }
        
        try {
            this.setButtonLoading('register-next-1', true);
            const response = await fetch(`${this.apiBase}/otp/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: this.otpEmail,
                    otp: otp,
                    purpose: 'register'
                })
            });
            
            const data = await response.json();
            
            this.setButtonLoading('register-next-1', false);
            
            if (response.ok && data.verified) {
                this.otpVerified = true;
                this.showMessage('OTP verified successfully!', 'success');
                
                // Lock step 1 fields immediately after OTP verification
                const emailInput = document.getElementById('auth-email-register');
                const otpInput = document.getElementById('register-otp');
                const otpSection = document.getElementById('register-otp-section');
                
                if (emailInput) {
                    emailInput.disabled = true;
                    emailInput.style.opacity = '0.6';
                    emailInput.style.cursor = 'not-allowed';
                    emailInput.title = 'Email is locked after OTP verification';
                }
                
                if (otpInput) {
                    otpInput.disabled = true;
                    otpInput.style.opacity = '0.6';
                    otpInput.style.cursor = 'not-allowed';
                    otpInput.title = 'OTP is locked after verification';
                }
                
                if (otpSection) {
                    otpSection.style.display = 'none';
                }
                this.setRegisterRecaptchaVisible(false);
                
                // Update button text in case user goes back to step 1
                this.updateRegisterStep1ButtonText();
                // Move to step 2 (Username and Password)
                this.goToRegistrationStep(2);
                // Clear persisted registration fields after OTP is verified and proceeding
                localStorage.removeItem('register_email');
                localStorage.removeItem('register_otp');
            } else {
                this.showMessage(data.message || 'Invalid OTP', 'error');
            }
        } catch (error) {
            this.setButtonLoading('register-next-1', false);
            console.error('Verify OTP error:', error);
            this.showMessage('Failed to verify OTP. Please try again.', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();

        // Validate step 4 (role + terms)
        if (!this.validateRegistrationStep(4)) {
            return;
        }

        // Show loading on submit button
        this.setButtonLoading('register-submit-btn', true);

        const email = document.getElementById('auth-email-register').value.trim();
        const username = document.getElementById('auth-username').value.trim();
        const password = document.getElementById('auth-password-register').value;
        const fullname = this.buildRegistrationFullName();
        const firstName = document.getElementById('auth-firstname')?.value.trim() || '';
        const middleName = document.getElementById('auth-middlename')?.value.trim() || '';
        const lastName = document.getElementById('auth-lastname')?.value.trim() || '';

        // Enforce letters and spaces only for name fields
        const nameRegex = /^[A-Za-z\s]+$/;
        if (firstName && !nameRegex.test(firstName)) {
            this.setButtonLoading('register-submit-btn', false);
            this.showMessage('First name may contain letters and spaces only', 'error');
            document.getElementById('auth-firstname').focus();
            return;
        }
        if (middleName && !nameRegex.test(middleName)) {
            this.setButtonLoading('register-submit-btn', false);
            this.showMessage('Middle name may contain letters and spaces only', 'error');
            document.getElementById('auth-middlename').focus();
            return;
        }
        if (lastName && !nameRegex.test(lastName)) {
            this.setButtonLoading('register-submit-btn', false);
            this.showMessage('Last name may contain letters and spaces only', 'error');
            document.getElementById('auth-lastname').focus();
            return;
        }
        let phone = document.getElementById('auth-phone').value.trim();
        const address = this.buildRegistrationAddress();

        // Validate phone number: must be exactly 10 digits
        const phoneDigits = phone.replace(/\D/g, '');
        if (!phone || phoneDigits.length !== 10) {
            this.setButtonLoading('register-submit-btn', false);
            this.showMessage('Contact number must be exactly 10 digits', 'error');
            document.getElementById('auth-phone').focus();
            return;
        }
        
        // Prepend +63 to phone number for storage
        phone = '+63' + phoneDigits;

        // Validate required fields with specific messages
        if (!username) {
            this.showMessage('Please enter a username', 'error');
            document.getElementById('auth-username').focus();
            return;
        }
        if (username.length < 3 || username.length > 20) {
            this.showMessage('Username must be between 3 and 20 characters', 'error');
            document.getElementById('auth-username').focus();
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.showMessage('Username can only contain letters, numbers, and underscores', 'error');
            document.getElementById('auth-username').focus();
            return;
        }
        if (!email) {
            this.showMessage('Please enter your email address', 'error');
            document.getElementById('auth-email-register').focus();
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            document.getElementById('auth-email-register').focus();
            return;
        }
        if (!password) {
            this.showMessage('Please enter a password', 'error');
            document.getElementById('auth-password-register').focus();
            return;
        }
        if (password.length < 6) {
            this.showMessage('Password must be at least 6 characters long', 'error');
            document.getElementById('auth-password-register').focus();
            return;
        }
        if (!fullname) {
            this.showMessage('Please enter your name details', 'error');
            document.getElementById('auth-firstname').focus();
            return;
        }

        // Ensure reCAPTCHA widgets are attempted to render (OTP step already enforces CAPTCHA).
        try { this.renderRecaptchaWidgets(); } catch (err) { /* noop */ }

        // If OTP not sent yet, send it
        if (!this.otpSent) {
            await this.sendOtp();
            return;
        }

        // If OTP sent but not verified, verify it first
        if (!this.otpVerified) {
            const verified = await this.verifyOtp();
            if (!verified) {
                return;
            }
        }

        // OTP verified, proceed with registration

        const formData = {
            username: username,
            email: email,
            password: password,
            full_name: fullname,
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            phone: phone, // Already includes +63 prefix
            address: address,
            role: this.selectedRole || 'customer'
        };

        try {
            const response = await fetch(`${this.apiBase}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            this.resetRecaptcha('auth');

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('token', this.token);
                // Clear form data and saved step on successful registration
                this.clearFormData('register');
                localStorage.removeItem('last_registration_step');
                localStorage.removeItem('last_otp_sent');
                localStorage.removeItem('last_otp_verified');
                localStorage.removeItem('last_otp_email');
                this.clearAuthForm();
                this.closeAuthFlow();
                // Redirect based on created role
                const role = data.user?.role || 'customer';
                if (role === 'staff' || role === 'super_admin') {
                    this.showMessage('Staff registration successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = '/admin.html';
                    }, 800);
                    return;
                }
                if (role === 'farmer') {
                    this.showMessage('Farmer registration successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = '/farmer.html';
                    }, 800);
                    return;
                }

                this.showUserMenu();
                this.migrateGuestCart();
                this.showMessage('Registration successful! Welcome to AgriCatch!', 'success');
                // Handle return URL for customers
                if (this.returnUrl) {
                    setTimeout(() => {
                        window.location.href = this.returnUrl;
                    }, 1000);
                }
            } else {
                this.setButtonLoading('register-submit-btn', false);
                this.resetRecaptcha('auth');
                // Provide user-friendly error messages
                let errorMessage = data.message || 'Registration failed';
                if (errorMessage.includes('already exists') || errorMessage.includes('User already exists')) {
                    if (errorMessage.toLowerCase().includes('email')) {
                        errorMessage = 'This email is already registered. Please use a different email or try logging in.';
                        document.getElementById('auth-email-register').focus();
                    } else if (errorMessage.toLowerCase().includes('username')) {
                        errorMessage = 'This username is already taken. Please choose a different username.';
                        document.getElementById('auth-username').focus();
                    } else {
                        errorMessage = 'This email or username is already registered. Please use different credentials.';
                    }
                }
                this.showMessage(errorMessage, 'error');
            }
        } catch (error) {
            this.setButtonLoading('register-submit-btn', false);
            console.error('Registration error:', error);
            this.resetRecaptcha('auth');
            this.showMessage('Registration failed. Please try again.', 'error');
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('token');
        const userDropdownMenu = document.getElementById('user-dropdown-menu');
        const userAccountBtn = document.getElementById('user-account-btn');
        if (userDropdownMenu) userDropdownMenu.style.display = 'none';
        if (userAccountBtn) userAccountBtn.setAttribute('aria-expanded', 'false');
        this.showGuestMenu();
        this.updateCartCount();
        // Hide admin panel (if present on current page)
        const adminPanel = document.getElementById('admin-panel');
        if (adminPanel) adminPanel.style.display = 'none';
        this.showMessage('Logged out successfully', 'success');
    }

    async migrateGuestCart() {
        if (!this.token) return;

        try {
            await fetch(`${this.apiBase}/cart/merge`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ sessionId: this.sessionId })
            });
            this.updateCartCount();
        } catch (error) {
            console.error('Error migrating cart:', error);
        }
    }

    getCategoryIconClass(categoryName) {
        const normalized = String(categoryName || '').trim().toLowerCase();
        if (normalized === 'vegetables') return 'fas fa-seedling';
        if (normalized === 'fruits') return 'fas fa-apple-whole';
        if (normalized === 'meat & poultry') return 'fas fa-drumstick-bite';
        if (normalized === 'rice') return 'fas fa-leaf';
        if (normalized === 'rice, grains & staples') return 'fas fa-leaf';
        return 'fas fa-box-open';
    }

    bindProductCategoryTabListeners() {
        document.querySelectorAll('#products-category-tabs [data-product-category]').forEach((button) => {
            button.addEventListener('click', () => {
                this.currentCategory = button.getAttribute('data-product-category') || '';
                this.currentPage = 1;
                document.querySelectorAll('#products-category-tabs [data-product-category]').forEach((btn) => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
                this.loadProducts();
            });
        });
    }

    renderProductCategoryTabs(categories = []) {
        const tabsContainer = document.getElementById('products-category-tabs');
        if (!tabsContainer) return;

        const safeCategories = Array.isArray(categories) ? categories : [];
        const allButton = `
            <button class="btn btn-small btn-secondary ${this.currentCategory === '' ? 'active' : ''}" data-product-category="">
                <span>All</span>
            </button>
        `;

        const categoryButtons = safeCategories.map((category) => {
            const categoryName = String(category.name || '').trim();
            if (!categoryName) return '';
            const activeClass = this.currentCategory === categoryName ? 'active' : '';
            return `
                <button class="btn btn-small btn-secondary ${activeClass}" data-product-category="${categoryName}">
                    <span>${categoryName}</span>
                </button>
            `;
        }).join('');

        tabsContainer.innerHTML = allButton + categoryButtons;
        this.bindProductCategoryTabListeners();
    }

    async loadProductCategories() {
        try {
            const response = await fetch(`${this.apiBase}/products/categories`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });

            if (!response.ok) {
                throw new Error('Failed to load product categories');
            }

            const data = await response.json();
            this.renderProductCategoryTabs(data.categories || []);
        } catch (error) {
            console.error('Error loading product categories:', error);
            this.renderProductCategoryTabs([]);
        }
    }

    isProductExpired(product) {
        if (!product?.expiry_date) return false;
        const expiryDate = new Date(product.expiry_date);
        if (Number.isNaN(expiryDate.getTime())) return false;
        const now = new Date();
        expiryDate.setHours(23, 59, 59, 999);
        return expiryDate.getTime() < now.getTime();
    }

    isProductPurchasable(product) {
        const stock = Number(product?.stock_quantity ?? 0);
        const isAvailable = (
            product?.is_available === undefined
            || product?.is_available === true
            || product?.is_available === 't'
            || product?.is_available === 'true'
            || product?.is_available === 1
            || product?.is_available === '1'
        );
        return isAvailable && stock > 0 && !this.isProductExpired(product);
    }

    syncSortControls() {
        const current = String(this.currentSort || 'latest').trim();

        const legacySelect = document.getElementById('products-sort');
        if (legacySelect) {
            legacySelect.value = current;
        }

        const sortButtons = document.querySelectorAll('.sort-option-btn[data-sort-option]');
        sortButtons.forEach((btn) => {
            const option = String(btn.getAttribute('data-sort-option') || '');
            btn.classList.toggle('active', option === current);
        });

        const priceSortEl = document.getElementById('products-price-sort');
        if (priceSortEl) {
            const isPriceSort = current === 'price_low_high' || current === 'price_high_low';
            priceSortEl.value = isPriceSort ? current : '';
        }
    }

    async fetchJsonWithTimeout(url, options = {}, timeoutMs = 25000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    // Products
    async loadProducts() {
        const container = document.getElementById('products-grid');
        if (!container) {
            console.error('Products grid container not found');
            return;
        }

        const previousHeight = container.offsetHeight;
        try {
            // Keep current grid height while loading to prevent layout collapse/jump to footer.
            if (previousHeight > 0) {
                container.style.minHeight = `${previousHeight}px`;
            }
            container.setAttribute('aria-busy', 'true');
            if (!container.children.length) {
                container.innerHTML = '<div class="loading">Loading products...</div>';
            }

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 12 // 3 columns × 4 rows = 12 products per page
            });

            if (this.currentCategory && this.currentCategory !== '') {
                params.append('category', this.currentCategory);
            }
            if (this.currentSearch) params.append('search', this.currentSearch);
            if (this.currentSort) params.append('sort', this.currentSort);

            console.log('Loading products from:', `${this.apiBase}/products?${params}`);
            let response;
            try {
                response = await this.fetchJsonWithTimeout(`${this.apiBase}/products?${params}`, {
                    headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
                }, 25000);
            } catch (firstErr) {
                // Render cold starts can be slow; wake server and retry once with a longer timeout.
                console.warn('Products request timed out, attempting wake-up retry...', firstErr?.message || firstErr);
                try {
                    await this.fetchJsonWithTimeout(`${this.apiBase}/test-db`, { cache: 'no-cache' }, 15000);
                } catch (_) {
                    // best effort warmup
                }
                response = await this.fetchJsonWithTimeout(`${this.apiBase}/products?${params}`, {
                    headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
                }, 70000);
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
                console.error('Products API error:', errorData, 'Status:', response.status);
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            console.log('Products loaded:', data.products?.length || 0, 'products');
            
            if (!data.products || data.products.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>No products available at the moment.</p></div>';
                this.renderPagination(data.pagination);
                return;
            }

            if (data.products && data.products.length > 0) {
                console.log('Rendering', data.products.length, 'products');
                this.renderProducts(data.products);
                this.renderPagination(data.pagination);
            } else {
                console.warn('No products in response:', data);
                container.innerHTML = '<div class="empty-state"><p>No products available at the moment.</p></div>';
            }
        } catch (error) {
            console.error('Error loading products:', error);
            if (container) {
                container.innerHTML = `<div class="error-state"><p>Error loading products: ${error.message}</p><p>Please check your connection and try again.</p><p>API Base: ${this.apiBase}</p></div>`;
            }
            // Only show message if showMessage exists
            if (typeof this.showMessage === 'function') {
                this.showMessage('Error loading products: ' + error.message, 'error');
            }
        } finally {
            container.removeAttribute('aria-busy');
            container.style.minHeight = '';
        }
    }

    async loadFeaturedProducts() {
        const container = document.getElementById('featured-grid');
        if (!container) return;

        try {
            container.innerHTML = '<div class="loading">Loading featured products...</div>';
            const params = new URLSearchParams({ limit: '6' });

            let response;
            try {
                response = await this.fetchJsonWithTimeout(`${this.apiBase}/products/featured?${params.toString()}`, {
                    headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
                }, 25000);
            } catch (firstErr) {
                console.warn('Featured products request timed out, retrying once...', firstErr?.message || firstErr);
                response = await this.fetchJsonWithTimeout(`${this.apiBase}/products/featured?${params.toString()}`, {
                    headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
                }, 70000);
            }

            if (!response.ok) {
                throw new Error('Failed to load featured products');
            }

            const data = await response.json();
            const featured = Array.isArray(data.products) ? data.products : [];

            if (!featured.length) {
                container.innerHTML = '<div class="empty-state"><p>No featured products available right now.</p></div>';
                return;
            }

            container.innerHTML = featured.map((product) => {
                const imageUrl = product.image_url && String(product.image_url).trim() !== ''
                    ? product.image_url
                    : window.__PLACEHOLDER_IMAGE__;
                const soldCount = Number(product.sold_qty ?? product.sales_count ?? 0) || 0;
                const itemLabel = product.id ? `onclick="app.showProductDetails(${product.id})" style="cursor:pointer;"` : '';
                const productRating = Number(product.average_rating || 0);
                const ratingValue = this.fmtNumber(productRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                const shipFrom = product.location || product.farm_location || 'your local area';
                const isPurchasable = this.isProductPurchasable(product);
                return `
                    <div class="product-card" ${itemLabel}>
                        <img src="${imageUrl}" alt="${product.name}" class="product-image" onerror="this.src=window.__PLACEHOLDER_IMAGE__">
                        <div class="product-info">
                            <div class="featured-seller-badge">Best Seller</div>
                            <h3 class="product-name">${product.name}</h3>
                            <div class="product-price">${this.fmtCurrency(product.price)} per ${product.unit || 'item'}</div>
                            <div class="product-meta product-card-summary">
                                <div class="product-meta-row">
                                    <div class="product-meta-left">
                                        <div class="product-stock" aria-label="Stock available">
                                            ${(() => { const qty = Number(product.stock_quantity ?? product.stock ?? 0); const unit = String(product.unit || 'item'); const stockWord = qty === 1 ? 'stock' : 'stocks'; return `${qty} ${unit} ${stockWord}`; })()}
                                        </div>
                                        <div class="product-rating-wrap" aria-hidden="false">
                                            <div class="product-rating-text" aria-label="Average rating ${ratingValue} out of 5">
                                                <i class="fas fa-star product-rating-icon" aria-hidden="true"></i>
                                                <span class="product-rating-value">${ratingValue}</span>
                                            </div>
                                        </div>
                                        <div class="product-ship-from" aria-label="Shipping origin">
                                            Ships from ${shipFrom}
                                        </div>
                                        <div class="product-sold-left">
                                            <span class="sold-count">Sold ${this.fmtNumber(soldCount)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                                <button type="button" class="add-to-cart-btn"
                                    onclick="event.stopPropagation(); app.addToCart(${product.id})"
                                    ${isPurchasable ? '' : 'disabled'}>
                                ${isPurchasable ? 'Add to Cart' : 'Unavailable'}
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error('Error loading featured products:', error);
            container.innerHTML = '<div class="empty-state"><p>Unable to load featured products.</p></div>';
        }
    }

    renderProducts(products) {
        const container = document.getElementById('products-grid');
        
        if (!container) {
            console.error('Products grid container not found in renderProducts');
            return;
        }

        if (products.length === 0) {
            container.innerHTML = '<div class="loading">No products found</div>';
            return;
        }

        console.log('Rendering products to container:', container, 'Products count:', products.length);
        container.innerHTML = products.map(product => {
            const isPurchasable = this.isProductPurchasable(product);
            const totalReviews = this.fmtNumber(product.total_reviews || 0);
            const averageRatingValue = Number(product.average_rating || 0);
            const averageRating = this.fmtNumber(averageRatingValue, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
            const shipFrom = product.location || product.farm_location || 'your local area';
            
            // Ensure image URL is properly formatted
            let productImageUrl = product.image_url || '';
            if (productImageUrl && !productImageUrl.startsWith('http') && !productImageUrl.startsWith('/')) {
                productImageUrl = '/' + productImageUrl;
            }
            if (!productImageUrl || productImageUrl === 'null' || productImageUrl === 'undefined') {
                productImageUrl = window.__PLACEHOLDER_IMAGE__;
            }
            
            return `
            <div class="product-card" onclick="app.showProductDetails(${product.id})" style="cursor: pointer;" data-product-id="${product.id}">
                 <img src="${productImageUrl}"
                     alt="${product.name}" class="product-image" onerror="this.src=window.__PLACEHOLDER_IMAGE__" draggable="false" ondragstart="event.preventDefault()">
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-price">${this.fmtCurrency(product.price)} per ${product.unit}</div>
                    <div class="product-meta product-card-summary">
                        <div class="product-stock" aria-label="Stock available">
                            ${(() => { const qty = Number(product.stock_quantity ?? product.stock ?? 0); const unit = String(product.unit || 'item'); const stockWord = qty === 1 ? 'stock' : 'stocks'; return `${qty} ${unit} ${stockWord}`; })()}
                        </div>
                        <div class="product-rating-wrap" aria-hidden="false">
                            <div class="product-rating-text" aria-label="${totalReviews} reviews, average ${averageRating} out of 5">
                                <i class="fas fa-star product-rating-icon" aria-hidden="true"></i>
                                <span class="product-rating-value">${averageRating}</span>
                            </div>
                        </div>
                        <div class="product-ship-from" aria-label="Shipping origin">
                            Ships from ${shipFrom}
                        </div>
                    </div>
                        <button type="button" class="add-to-cart-btn"
                            onclick="event.stopPropagation(); app.addToCart(${product.id})"
                            ${isPurchasable ? '' : 'disabled'}>
                        ${isPurchasable ? 'Add to Cart' : 'Unavailable'}
                    </button>
                </div>
            </div>
        `;
        }).join('');
    }

    renderPagination(pagination) {
        // Remove existing pagination if any
        const existingPagination = document.getElementById('products-pagination');
        if (existingPagination) {
            existingPagination.remove();
        }

        // Only show pagination if total products exceed 12
        if (!pagination || pagination.totalProducts <= 12) {
            return;
        }

        const productsSection = document.getElementById('products');
        // Ensure pagination is appended to the PRODUCTS section container (not the first .products on the page)
        const container = productsSection ? productsSection.querySelector('.container') : document.querySelector('.products .container');
        
        const paginationDiv = document.createElement('div');
        paginationDiv.id = 'products-pagination';
        paginationDiv.className = 'pagination';

        const prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'btn btn-secondary pagination-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
        if (!pagination.hasPrevPage) prevBtn.disabled = true;
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (prevBtn.disabled) return;
            this.changePage(pagination.currentPage - 1);
        });

        const infoSpan = document.createElement('span');
        infoSpan.className = 'pagination-info';
        infoSpan.textContent = `Page ${pagination.currentPage} of ${pagination.totalPages}`;

        const nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'btn btn-secondary pagination-btn';
        nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
        if (!pagination.hasNextPage) nextBtn.disabled = true;
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (nextBtn.disabled) return;
            this.changePage(pagination.currentPage + 1);
        });

        paginationDiv.appendChild(prevBtn);
        paginationDiv.appendChild(infoSpan);
        paginationDiv.appendChild(nextBtn);
        container.appendChild(paginationDiv);
    }

    async changePage(page) {
        if (!Number.isFinite(page) || page < 1) return;

        // Save scroll position before loading new page content
        const prevY = window.scrollY || window.pageYOffset || 0;
        this.currentPage = page;

        try {
            await this.loadProducts();
        } finally {
            // Restore scroll position after load, clamped to valid document height
            const docEl = document.documentElement;
            const maxY = Math.max(0, docEl.scrollHeight - window.innerHeight);
            const safeY = Math.max(0, Math.min(prevY, maxY));
            
            // Use setTimeout to ensure restore happens after DOM settle
            setTimeout(() => {
                window.scrollTo(0, safeY);
            }, 0);
        }
    }

    // Show product details in floating modal
    async showProductDetails(productId) {
        try {
            // Open modal immediately with a lightweight loading placeholder
            const modal = document.getElementById('product-details-modal');
            try { if (modal && modal.parentElement !== document.body) document.body.appendChild(modal); } catch (e) {}
            if (modal) {
                // Minimal placeholder so UI responds instantly
                const nameEl = document.getElementById('product-details-name');
                const descEl = document.getElementById('product-details-description');
                const imgEl = document.getElementById('product-details-image');
                if (nameEl) nameEl.textContent = 'Loading...';
                if (descEl) descEl.textContent = '';
                if (imgEl) {
                    imgEl.src = window.__PLACEHOLDER_IMAGE__;
                    imgEl.style.opacity = '0.6';
                }
                modal.classList.add('active', 'open');
                this.setPageScrollLocked(true);
            }

            const response = await fetch(`${this.apiBase}/products/${productId}`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });

            if (!response.ok) {
                throw new Error('Failed to load product details');
            }

            const data = await response.json();
            // API returns { product: {...} }, so extract the product object
            const product = data.product || data;
            console.log('Product data received:', product); // Debug log
            
            // Format dates from farmer's input
            let harvestDate = 'Not specified';
            if (product.harvest_date) {
                try {
                    const harvest = new Date(product.harvest_date);
                    harvestDate = harvest.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });
                } catch (e) {
                    harvestDate = product.harvest_date; // Use raw value if date parsing fails
                }
            }
            
            let expiryDate = 'Not specified';
            if (product.expiry_date) {
                try {
                    const expiry = new Date(product.expiry_date);
                    expiryDate = expiry.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' });
                } catch (e) {
                    expiryDate = product.expiry_date; // Use raw value if date parsing fails
                }
            }
            
            // Get image element and ensure proper image URL from farmer
            const imageElement = document.getElementById('product-details-image');
            let imageUrl = product.image_url || '';
            
            // Handle relative paths - ensure they start with /
            if (imageUrl && !imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
                imageUrl = '/' + imageUrl;
            }
            
            // If no image URL, use project logo placeholder (avoid external requests)
            if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl.trim() === '') {
                imageUrl = window.__PLACEHOLDER_IMAGE__;
            }
            
            // Set image with error handling - PRIORITY: Image must sync with farmer's upload
            imageElement.src = imageUrl;
            imageElement.alt = product.name || 'Product Image';
            
            // Add error handler to ensure image loads correctly
            imageElement.onerror = function() {
                console.warn('Product image failed to load:', imageUrl);
                this.src = window.__PLACEHOLDER_IMAGE__;
                this.onerror = null; // Prevent infinite loop
            };
            
            // Add load handler to ensure image is displayed
            imageElement.onload = function() {
                this.style.opacity = '1';
            };
            
            // Show loading state initially
            imageElement.style.opacity = '0.5';
            imageElement.style.transition = 'opacity 0.3s ease';
            
            // Store product data for quantity calculations
            this.currentProductDetails = product;
            this.currentProductId = productId;
            this.currentProductCartQuantity = 0;
            
            // Populate details from farmer's input only - ensure all fields are populated
            const nameEl = document.getElementById('product-details-name');
            const nameRatingEl = document.getElementById('product-details-name-rating');
            const descriptionEl = document.getElementById('product-details-description');
            const farmerEl = document.getElementById('product-details-farmer');
            const locationEl = document.getElementById('product-details-location');
            const stockEl = document.getElementById('product-details-stock');
            const harvestEl = document.getElementById('product-details-harvest');
            const expiryEl = document.getElementById('product-details-expiry');
            const priceEl = document.getElementById('product-details-price');
            const quantityEl = document.getElementById('product-details-quantity');
            const farmerActionsEl = document.getElementById('product-details-farmer-actions');
            
            if (nameEl) nameEl.textContent = product.name || 'Product Name';
            if (nameRatingEl) {
                const productRating = this.fmtNumber(product.average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                const soldCount = this.fmtNumber(product.sales_count || 0);
                nameRatingEl.innerHTML = `
                    <div class="name-rating-row">
                        <div class="name-rating-left">${productRating} <i class="fas fa-star rating-icon" aria-hidden="true"></i> (${this.fmtNumber(product.total_reviews || 0)} reviews)</div>
                        <div class="name-rating-right">Sold ${soldCount}</div>
                    </div>
                `;
            }
            if (descriptionEl) descriptionEl.textContent = product.description || 'No description available.';
            if (farmerEl) {
                const shopRating = this.fmtNumber(product.farmer_average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                const farmerName = product.farmer_name || product.full_name || 'Local Farmer';
                farmerEl.textContent = '';
                farmerEl.appendChild(document.createTextNode(`${farmerName} • Shop ${shopRating} `));
                const star = document.createElement('i');
                star.className = 'fas fa-star rating-icon';
                star.setAttribute('aria-hidden', 'true');
                farmerEl.appendChild(star);
            }
            if (farmerActionsEl) {
                const farmerId = Number(product.farmer_id || 0);
                farmerActionsEl.innerHTML = `
                    <button type="button" class="btn btn-small btn-secondary" data-action="chat-farmer" ${farmerId ? '' : 'disabled'}>
                        <i class="fas fa-comments"></i> Chat
                    </button>
                    <button type="button" class="btn btn-small btn-primary" data-action="view-shop" ${farmerId ? '' : 'disabled'}>
                        <i class="fas fa-store"></i> View Shop
                    </button>
                `;

                const chatBtn = farmerActionsEl.querySelector('[data-action="chat-farmer"]');
                const viewBtn = farmerActionsEl.querySelector('[data-action="view-shop"]');

                if (chatBtn) {
                    chatBtn.addEventListener('click', (evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                        this.startChatWithFarmer(product);
                    });
                }

                if (viewBtn) {
                    viewBtn.addEventListener('click', (evt) => {
                        evt.preventDefault();
                        evt.stopPropagation();
                        this.viewFarmerShop(product);
                    });
                }
            }
            if (locationEl) locationEl.textContent = product.location || product.farm_location || 'Location not specified';
            if (stockEl) stockEl.textContent = `${this.fmtNumber(product.stock_quantity || 0)} ${product.unit || 'unit'}`;
            if (harvestEl) harvestEl.textContent = harvestDate;
            if (expiryEl) expiryEl.textContent = expiryDate;
            if (priceEl) {
                const unit = product.unit || 'unit';
                priceEl.textContent = `${this.fmtCurrency(product.price || 0)} per ${unit}`;
            }
            if (quantityEl) {
                quantityEl.value = 1;
                quantityEl.max = product.stock_quantity || 1;
            }

            await this.refreshCurrentProductCartQuantity(productId);
            this.normalizeProductQuantityInput();
            
            // Calculate and display total
            this.updateProductTotal();
            
            // Update add to cart button
            const addCartBtn = document.getElementById('product-details-add-cart');
            if (addCartBtn) {
                addCartBtn.onclick = async () => {
                    if (!this.isProductPurchasable(product)) {
                        this.showMessage('This product is currently unavailable.', 'error');
                        return;
                    }
                    const quantity = parseInt(document.getElementById('product-details-quantity').value) || 1;
                    const maxAddable = this.getMaxAddableQuantity();
                    if (quantity > maxAddable) {
                        this.showMessage(`Only ${maxAddable} more can be added based on current stock.`, 'error');
                        this.normalizeProductQuantityInput();
                        return;
                    }
                    // Disable button to avoid duplicate requests
                    addCartBtn.disabled = true;
                    try {
                        await this.addToCart(productId, quantity);
                        await this.refreshCurrentProductCartQuantity(productId);
                        this.normalizeProductQuantityInput();
                    } finally {
                        addCartBtn.disabled = false;
                    }
                };
                const maxAddable = this.getMaxAddableQuantity();
                const canAdd = this.isProductPurchasable(product) && maxAddable > 0;
                addCartBtn.disabled = !canAdd;
                addCartBtn.innerHTML = canAdd
                    ? '<i class="fas fa-shopping-cart"></i> Add to Cart'
                    : '<i class="fas fa-ban"></i> Unavailable';
            }
            
            // Update quantity button states
            this.updateQuantityButtons();
            this.loadSimilarSellers(productId);
            
            // Show modal
            const modalEl = document.getElementById('product-details-modal');
            if (modalEl) {
                // Ensure modal is attached to body so fixed positioning and z-index work like auth modal
                try { if (modalEl.parentElement !== document.body) document.body.appendChild(modalEl); } catch (e) {}
                modalEl.classList.add('active', 'open');
                this.setPageScrollLocked(true);

                // Add Escape key handler to close modal like auth modal
                try {
                    this._productModalKeydown = (ev) => {
                        if (ev.key === 'Escape') this.closeProductDetails();
                    };
                    document.addEventListener('keydown', this._productModalKeydown);
                } catch (e) {}
            }
        } catch (error) {
            console.error('Error loading product details:', error);
            this.showMessage('Failed to load product details', 'error');
        }
    }
    
    closeProductDetails() {
        const modal = document.getElementById('product-details-modal');
        if (modal) {
            modal.classList.remove('active', 'open');
        }
        const shopModal = document.getElementById('shop-details-modal');
        if (shopModal) {
            shopModal.classList.remove('active', 'open');
        }
        this.setPageScrollLocked(false);
        try {
            if (this._productModalKeydown) {
                document.removeEventListener('keydown', this._productModalKeydown);
                this._productModalKeydown = null;
            }
        } catch (e) {}
        this.currentProductDetails = null;
        this.currentProductId = null;
        const similar = document.getElementById('similar-sellers');
        if (similar) similar.innerHTML = '';
        const farmerActionsEl = document.getElementById('product-details-farmer-actions');
        if (farmerActionsEl) farmerActionsEl.innerHTML = '';
    }

    startChatWithFarmer(product) {
        const farmerId = Number(product?.farmer_id || 0);
        if (!farmerId) {
            this.showMessage('Farmer chat is not available for this listing.', 'error');
            return;
        }

        if (!this.token) {
            this.showMessage('Please log in first to chat with the farmer.', 'error');
            this.openAuthFlow({ role: 'customer', mode: 'login', returnUrl: window.location.pathname + window.location.search + window.location.hash });
            return;
        }

        const productId = Number(product?.id || this.currentProductId || 0);
        const resumeParams = new URLSearchParams();
        if (productId) resumeParams.set('openProductId', String(productId));
        resumeParams.set('resumeScrollY', String(window.scrollY || 0));
        const returnUrl = `${window.location.pathname}?${resumeParams.toString()}${window.location.hash || '#products'}`;
        window.location.href = `/chat.html?farmerId=${farmerId}${productId ? `&productId=${productId}` : ''}&returnUrl=${encodeURIComponent(returnUrl)}`;
    }

    viewFarmerShop(product) {
        const farmerId = Number(product?.farmer_id || 0);
        if (!farmerId) {
            this.showMessage('Shop details are not available for this listing.', 'error');
            return;
        }

        this.openShopDetailsModal(farmerId, product?.farmer_name || 'Shop');
    }

    async openShopDetailsModal(farmerId, fallbackName = 'Shop') {
        const modal = document.getElementById('shop-details-modal');
        const titleEl = document.getElementById('shop-details-title');
        const bodyEl = document.getElementById('shop-details-body');
        if (!modal || !bodyEl) return;

        if (titleEl) titleEl.textContent = `${fallbackName} Details`;
        bodyEl.innerHTML = '<div class="loading">Loading shop details...</div>';
        modal.classList.add('open', 'active');
        this.setPageScrollLocked(true);

        try {
            const response = await fetch(`${this.apiBase}/farmers/${farmerId}/profile`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });
            if (!response.ok) throw new Error('Failed to load shop details');

            const data = await response.json();
            const profile = data.profile || {};
            const rating = this.fmtNumber(profile.average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

            bodyEl.innerHTML = `
                <div class="shop-details-grid">
                    <div><strong>Shop Name:</strong> ${this.escapeHtml(profile.full_name || fallbackName)}</div>
                    <div><strong>Location:</strong> ${this.escapeHtml(profile.location || 'Not specified')}</div>
                    <div><strong>Contact:</strong> ${this.escapeHtml(profile.phone || 'Not available')}</div>
                    <div><strong>Total Sales:</strong> ${this.fmtNumber(profile.total_sales || 0)}</div>
                    <div><strong>Average Rating:</strong> ${rating} <i class="fas fa-star rating-icon" aria-hidden="true"></i></div>
                    <div><strong>Total Reviews:</strong> ${this.fmtNumber(profile.total_reviews || 0)}</div>
                </div>
                <div style="margin-top:0.85rem;"><strong>Description:</strong><br>${this.escapeHtml(profile.shop_description || 'No shop description yet.')}</div>
            `;
        } catch (error) {
            console.error('Shop details error:', error);
            bodyEl.innerHTML = '<div class="empty-state"><p>Unable to load shop details right now.</p></div>';
        }
    }

    closeShopDetailsModal() {
        const modal = document.getElementById('shop-details-modal');
        if (modal) modal.classList.remove('open', 'active');

        const productModalOpen = !!document.getElementById('product-details-modal')?.classList.contains('active');
        if (!productModalOpen) {
            this.setPageScrollLocked(false);
        }
    }

    async loadSimilarSellers(productId) {
        const container = document.getElementById('similar-sellers');
        if (!container) return;

        try {
            container.innerHTML = '<h3>Similar Farmer Shops</h3><div class="loading">Loading similar offers...</div>';
            const response = await fetch(`${this.apiBase}/products/${productId}/similar-sellers`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });

            if (!response.ok) throw new Error('Failed to fetch similar sellers');
            const data = await response.json();
            const similar = (Array.isArray(data.similar) ? data.similar : []).slice(0, 3);

            if (!similar.length) {
                container.innerHTML = '<h3>Similar Farmer Shops</h3><div class="empty-state"><p>No other sellers found for this item yet.</p></div>';
                return;
            }

            container.innerHTML = `
                <h3>Similar Farmer Shops</h3>
                <div class="reviews-list">
                    ${similar.map((item) => {
                        const badges = (item.badges || []).map((badge) => `<span class="status-pill">${this.escapeHtml(badge)}</span>`).join(' ');
                        const farmerName = this.escapeHtml(item.farmer_name || 'Farmer Shop');
                        const unit = this.escapeHtml(item.unit || 'item');
                        const shopRating = this.fmtNumber(item.farmer_average_rating || 0, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                        const canOpen = Number(item.id) > 0;
                        return `
                            <div class="review-card ${canOpen ? 'clickable' : ''}" ${canOpen ? `onclick="app.showProductDetails(${Number(item.id)})" style="cursor:pointer;"` : ''}>
                                <div class="review-header">
                                    <div class="review-farmer-meta">
                                        <strong>${farmerName}</strong>
                                        <span class="review-shop-rating">${shopRating} <i class="fas fa-star rating-icon" aria-hidden="true"></i></span>
                                    </div>
                                    <span>${this.fmtCurrency(item.price)} / ${unit}</span>
                                </div>
                                <p>
                                    Sold: ${this.fmtNumber(item.sales_count || 0)}
                                </p>
                                <div>${badges}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } catch (error) {
            console.error('Error loading similar sellers:', error);
            container.innerHTML = '<h3>Similar Farmer Shops</h3><div class="empty-state"><p>Unable to load similar offers right now.</p></div>';
        }
    }
    
    increaseQuantity() {
        const quantityEl = document.getElementById('product-details-quantity');
        if (!quantityEl || !this.currentProductDetails) return;
        
        const currentQty = parseInt(quantityEl.value) || 1;
        const maxStock = this.getMaxAddableQuantity();
        const newQty = Math.min(currentQty + 1, maxStock);
        
        quantityEl.value = newQty;
        this.updateProductTotal();
        this.updateQuantityButtons();
    }
    
    decreaseQuantity() {
        const quantityEl = document.getElementById('product-details-quantity');
        if (!quantityEl) return;
        
        const currentQty = parseInt(quantityEl.value) || 1;
        const newQty = Math.max(currentQty - 1, 1);
        
        quantityEl.value = newQty;
        this.updateProductTotal();
        this.updateQuantityButtons();
    }
    
    updateProductTotal() {
        const quantityEl = document.getElementById('product-details-quantity');
        const totalEl = document.getElementById('product-details-total');
        
        if (!quantityEl || !totalEl || !this.currentProductDetails) return;
        
        const quantity = parseInt(quantityEl.value) || 1;
        const price = parseFloat(this.currentProductDetails.price || 0);
        const total = quantity * price;

        totalEl.textContent = this.fmtCurrency(total);
    }
    
    updateQuantityButtons() {
        const quantityEl = document.getElementById('product-details-quantity');
        const decreaseBtn = document.getElementById('product-details-decrease');
        const increaseBtn = document.getElementById('product-details-increase');
        
        if (!quantityEl || !this.currentProductDetails) return;
        
        const currentQty = parseInt(quantityEl.value) || 1;
        const maxStock = this.getMaxAddableQuantity();
        
        if (decreaseBtn) {
            decreaseBtn.disabled = currentQty <= 1;
        }
        if (increaseBtn) {
            increaseBtn.disabled = currentQty >= maxStock;
        }
    }

    getMaxAddableQuantity() {
        const stockQty = Number(this.currentProductDetails?.stock_quantity || 0);
        const existingInCart = Number(this.currentProductCartQuantity || 0);
        return Math.max(0, stockQty - existingInCart);
    }

    async refreshCurrentProductCartQuantity(productId) {
        if (!productId) return 0;
        try {
            const query = new URLSearchParams({ sessionId: this.sessionId });
            const response = await fetch(`${this.apiBase}/cart?${query.toString()}`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });
            if (!response.ok) return 0;
            const data = await response.json();
            const items = Array.isArray(data.cartItems) ? data.cartItems : [];
            const item = items.find((cartItem) => Number(cartItem.product_id) === Number(productId));
            this.currentProductCartQuantity = Number(item?.quantity || 0);
            return this.currentProductCartQuantity;
        } catch (_) {
            this.currentProductCartQuantity = 0;
            return 0;
        }
    }

    normalizeProductQuantityInput() {
        const quantityEl = document.getElementById('product-details-quantity');
        if (!quantityEl || !this.currentProductDetails) return;

        const maxStock = this.getMaxAddableQuantity();
        const parsed = Number.parseInt(String(quantityEl.value || '').replace(/[^0-9]/g, ''), 10);
        const value = Number.isFinite(parsed) ? parsed : 1;
        const normalized = maxStock <= 0 ? 1 : Math.min(Math.max(value, 1), maxStock);

        quantityEl.value = normalized;
        quantityEl.max = maxStock;
        this.updateProductTotal();
        this.updateQuantityButtons();
    }

    // Cart functionality
    async addToCart(productId, quantity = 1) {
        try {
            const response = await fetch(`${this.apiBase}/cart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.token && { 'Authorization': `Bearer ${this.token}` })
                },
                body: JSON.stringify({
                    productId,
                    quantity,
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.updateCartCount();
                this.showMessage('Item added to cart!', 'success', { position: 'center' });
                
                // If cart is already open, refresh the cart display
                const cartSidebar = document.getElementById('cart-sidebar');
                if (cartSidebar && cartSidebar.classList.contains('open')) {
                    await this.openCart(); // This will refresh the cart display
                }
            } else {
                this.showMessage(data.message || 'Failed to add item to cart', 'error');
            }
        } catch (error) {
            console.error('Error adding to cart:', error);
            this.showMessage('Failed to add item to cart', 'error');
        }
    }

    async toggleWishlist(productId, isInWishlist) {
        if (!this.token) {
            this.showMessage('Login to use wishlist', 'error');
            return;
        }

        try {
            const url = `${this.apiBase}/wishlist${isInWishlist ? `/${productId}` : ''}`;
            const response = await fetch(url, {
                method: isInWishlist ? 'DELETE' : 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: isInWishlist ? null : JSON.stringify({ productId })
            });

            if (response.ok) {
                this.loadProducts();
            } else {
                const data = await response.json();
                this.showMessage(data.message || 'Wishlist update failed', 'error');
            }
        } catch (error) {
            console.error('Wishlist error:', error);
            this.showMessage('Wishlist update failed', 'error');
        }
    }

    async updateCartCount() {
        try {
            // Backend handles both logged in (via token) and guest (via sessionId)
            const params = `?sessionId=${this.sessionId}`;

            const response = await fetch(`${this.apiBase}/cart${params}`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });

            if (response.ok) {
                const data = await response.json();
                const cartCountEl = document.getElementById('cart-count');
                const count = data.summary ? (data.summary.itemCount || 0) : 0;
                if (cartCountEl) {
                    cartCountEl.textContent = count;
                    cartCountEl.style.display = count > 0 ? 'inline-flex' : 'none';
                }
            }
        } catch (error) {
            console.error('Error updating cart count:', error);
        }
    }

    async openCart() {
        try {
            // Backend handles both logged in (via token) and guest (via sessionId)
            const params = `?sessionId=${this.sessionId}`;

            const response = await fetch(`${this.apiBase}/cart${params}`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });

            if (response.ok) {
                const data = await response.json();
                this.renderCart(data);
                const cartSidebar = document.getElementById('cart-sidebar');
                const cartOverlay = document.getElementById('cart-overlay');
                if (cartSidebar) {
                    cartSidebar.classList.add('open');
                }
                if (cartOverlay) {
                    cartOverlay.classList.add('active');
                }
                // Prevent background scrolling when cart is open
                document.body.style.overflow = 'hidden';
            } else {
                console.error('Cart API error:', response.status);
                const errorData = await response.json().catch(() => ({}));
                this.showMessage(errorData.message || 'Error loading cart', 'error');
            }
        } catch (error) {
            console.error('Error loading cart:', error);
            this.showMessage('Error loading cart', 'error');
        }
    }

    renderCart(data) {
        const cartItems = document.getElementById('cart-items');
        const cartTotal = document.getElementById('cart-total');
        const checkoutBtn = document.getElementById('checkout-btn');

        if (data.cartItems.length === 0) {
            cartItems.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Your cart is empty</p>
                    <p style="font-size: 0.9rem; color: var(--gray); margin-top: -1rem;">Start adding products to your cart!</p>
                    <button class="btn btn-primary" onclick="app.closeCart(); app.scrollToSection('#products');">
                        <i class="fas fa-store"></i> Shop Now
                    </button>
                </div>
            `;
            cartTotal.textContent = '0.00';
            checkoutBtn.disabled = true;
            checkoutBtn.style.opacity = '0.6';
            return;
        }
        
        checkoutBtn.style.opacity = '1';

        cartItems.innerHTML = data.cartItems.map(item => {
            const isUnavailable = item.is_available_for_checkout === false;
            const badge = isUnavailable
                ? `<span class="status-pill pending" style="margin-left:6px;">Unavailable</span>`
                : '';
            const disabledAttr = isUnavailable ? 'disabled' : '';
            return `
            <div class="cart-item">
                <img src="${item.image_url || '/images/logo.png'}"
                     alt="${item.name}" class="cart-item-image" onerror="this.src='/images/logo.png'">
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name} ${badge}</div>
                    <div class="cart-item-price">${this.fmtCurrency(item.price)} ${item.unit ? 'per ' + item.unit : ''}</div>
                    ${item.farmer_name ? `<div class="cart-item-farmer">From ${item.farmer_name}</div>` : ''}
                    <div class="cart-item-stock">Stocks: ${this.fmtNumber(item.stock_quantity ?? 0)}</div>
                    <div class="cart-item-quantity">
                        <div class="quantity-controls">
                            <button class="quantity-btn" onclick="app.updateCartItem(${item.id}, ${item.quantity - 1})" title="Decrease quantity" ${disabledAttr}>−</button>
                            <input
                                type="number"
                                class="quantity-value-input"
                                value="${item.quantity}"
                                min="1"
                                max="${Math.max(1, Number(item.stock_quantity) || 1)}"
                                inputmode="numeric"
                                aria-label="Cart quantity"
                                onchange="app.handleCartQuantityInput(${item.id}, this.value, ${Math.max(1, Number(item.stock_quantity) || 1)}, this)"
                                onkeydown="if(event.key === 'Enter'){event.preventDefault(); this.blur();}" ${disabledAttr}>
                            <button class="quantity-btn" onclick="app.updateCartItem(${item.id}, ${item.quantity + 1})" title="Increase quantity" ${disabledAttr}>+</button>
                        </div>
                        <button class="remove-item" onclick="app.removeCartItem(${item.id})" title="Remove item">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        }).join('');

        cartTotal.textContent = this.fmtNumber(data.summary.subtotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const hasUnavailable = !!data.summary?.has_unavailable_items;
        checkoutBtn.disabled = hasUnavailable;
        checkoutBtn.style.opacity = hasUnavailable ? '0.6' : '1';
    }

    closeCart() {
        const cartSidebar = document.getElementById('cart-sidebar');
        const cartOverlay = document.getElementById('cart-overlay');
        if (cartSidebar) {
            cartSidebar.classList.remove('open');
            if (cartOverlay) cartOverlay.classList.remove('active');
            document.body.style.overflow = ''; // Restore body scroll
        }
    }

    async updateCartItem(cartId, quantity) {
        if (quantity < 1) return;

        try {
            const requestBody = { quantity };
            const headers = {
                'Content-Type': 'application/json'
            };

            // Add session ID for guest users
            if (!this.token) {
                requestBody.sessionId = this.sessionId;
            } else {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const response = await fetch(`${this.apiBase}/cart/${cartId}`, {
                method: 'PUT',
                headers: headers,
                body: JSON.stringify(requestBody)
            });

            if (response.ok) {
                this.updateCartCount();
                this.openCart(); // Refresh cart display
                
                // If checkout modal is open, refresh it too
                const checkoutModal = document.getElementById('checkout-modal');
                if (checkoutModal && checkoutModal.classList.contains('open')) {
                    await this.openCheckoutModal();
                }
            } else {
                const data = await response.json();
                this.showMessage(data.message || 'Failed to update cart', 'error');
            }
        } catch (error) {
            console.error('Error updating cart item:', error);
            this.showMessage('Failed to update cart item', 'error');
        }
    }
    
    async updateCheckoutItem(cartId, quantity) {
        await this.updateCartItem(cartId, quantity);
    }

    async handleCartQuantityInput(cartId, rawValue, maxStock, inputEl) {
        const parsed = Number.parseInt(String(rawValue || '').trim(), 10);
        const safeMax = Number.isFinite(Number(maxStock)) && Number(maxStock) > 0 ? Number(maxStock) : 1;
        const nextQuantity = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), safeMax) : 1;
        if (inputEl) inputEl.value = String(nextQuantity);
        await this.updateCartItem(cartId, nextQuantity);
    }

    async handleCheckoutQuantityInput(cartId, rawValue, maxStock, inputEl) {
        const parsed = Number.parseInt(String(rawValue || '').trim(), 10);
        const safeMax = Number.isFinite(Number(maxStock)) && Number(maxStock) > 0 ? Number(maxStock) : 1;
        const nextQuantity = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), safeMax) : 1;
        if (inputEl) inputEl.value = String(nextQuantity);
        await this.updateCheckoutItem(cartId, nextQuantity);
    }
    
    async removeCheckoutItem(cartId) {
        await this.removeCartItem(cartId);
    }

    async removeCartItem(cartId) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }

            const requestBody = {};
            if (!this.token) {
                requestBody.sessionId = this.sessionId;
            }

            const response = await fetch(`${this.apiBase}/cart/${cartId}`, {
                method: 'DELETE',
                headers: headers,
                body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined
            });

            if (response.ok) {
                this.updateCartCount();
                this.openCart(); // Refresh cart display
                
                // If checkout modal is open, refresh it too
                const checkoutModal = document.getElementById('checkout-modal');
                if (checkoutModal && checkoutModal.classList.contains('open')) {
                    await this.openCheckoutModal();
                }
            } else {
                const data = await response.json();
                this.showMessage(data.message || 'Failed to remove item', 'error');
            }
        } catch (error) {
            console.error('Error removing cart item:', error);
            this.showMessage('Failed to remove item', 'error');
        }
    }

    // Checkout
    async openCheckoutModal() {
        if (!this.token) {
            this.pendingCheckout = true;
            this.openAuthFlow({ role: 'customer', mode: 'login' });
            this.showMessage('Please log in to proceed to checkout', 'info');
            return;
        }

        try {
            // Load cart items for checkout
            const response = await fetch(`${this.apiBase}/cart`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                const data = await response.json();

                if (data.cartItems.length === 0) {
                    this.showMessage('Your cart is empty', 'error');
                    return;
                }

                if (data.summary?.has_unavailable_items) {
                    this.showMessage('Your cart has unavailable items. Please remove them before checkout.', 'error');
                    return;
                }

                // Delivery date input was removed from the UI; skip min-date setup.

                this.renderCheckout(data);
                document.getElementById('checkout-modal').classList.add('open');
                this.setPageScrollLocked(true);
            }
        } catch (error) {
            console.error('Error loading checkout:', error);
            this.showMessage('Error loading checkout', 'error');
        }
    }

    renderCheckout(data) {
        const checkoutItems = document.getElementById('checkout-items-list');
        const checkoutItemsContainer = checkoutItems?.closest('.checkout-items-container');
        const checkoutSubtotal = document.getElementById('checkout-subtotal');
        const checkoutTotal = document.getElementById('checkout-total');
        const checkoutTotalFooter = document.getElementById('checkout-total-footer');

        if (!checkoutItems) return;

        checkoutItems.innerHTML = data.cartItems.map(item => {
            const itemTotal = parseFloat(item.price) * item.quantity;
            const imageUrl = item.image_url || window.__PLACEHOLDER_IMAGE__;
            const isUnavailable = item.is_available_for_checkout === false;
            const disabledAttr = isUnavailable ? 'disabled' : '';
            const badge = isUnavailable
                ? `<small class="checkout-item-stock" style="color:#b91c1c; font-weight:600;">Unavailable</small>`
                : '';
            return `
            <div class="checkout-item">
                <div class="checkout-item-image">
                    <img src="${imageUrl}" 
                         alt="${item.name}" 
                         onerror="this.src=window.__PLACEHOLDER_IMAGE__">
                </div>
                <div class="checkout-item-details">
                    <strong class="checkout-item-name">${item.name}</strong>
                    <div class="checkout-item-meta">
                        <small>${this.fmtCurrency(item.price)} per ${item.unit || 'item'}</small>
                        ${item.farmer_name ? `<small class="checkout-item-farmer">By ${item.farmer_name}</small>` : ''}
                        <small class="checkout-item-stock">Stocks: ${this.fmtNumber(item.stock_quantity ?? 0)}</small>
                        ${badge}
                    </div>
                    <div class="checkout-item-controls">
                        <button type="button" class="checkout-qty-btn" onclick="app.updateCheckoutItem(${item.id}, ${item.quantity - 1})" ${(item.quantity <= 1 || isUnavailable) ? 'disabled' : ''} aria-label="Decrease quantity">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input
                            type="number"
                            class="checkout-qty-input"
                            value="${item.quantity}"
                            min="1"
                            max="${Math.max(1, Number(item.stock_quantity) || 1)}"
                            inputmode="numeric"
                            aria-label="Checkout quantity"
                            onchange="app.handleCheckoutQuantityInput(${item.id}, this.value, ${Math.max(1, Number(item.stock_quantity) || 1)}, this)"
                            onkeydown="if(event.key === 'Enter'){event.preventDefault(); this.blur();}" ${disabledAttr}>
                        <button type="button" class="checkout-qty-btn" onclick="app.updateCheckoutItem(${item.id}, ${item.quantity + 1})" aria-label="Increase quantity" ${disabledAttr}>
                            <i class="fas fa-plus"></i>
                        </button>
                        <button type="button" class="checkout-remove-btn" onclick="app.removeCheckoutItem(${item.id})" aria-label="Remove item">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="checkout-item-price">${this.fmtCurrency(itemTotal)}</div>
            </div>
        `;
        }).join('');

        if (checkoutItemsContainer) {
            if ((data.cartItems || []).length > 7) {
                const sampleItem = checkoutItems.querySelector('.checkout-item');
                const measuredHeight = sampleItem ? sampleItem.getBoundingClientRect().height : 0;
                const rowHeight = measuredHeight > 24 ? measuredHeight : 92;
                checkoutItemsContainer.style.maxHeight = `${Math.round(rowHeight * 7 + 12)}px`;
                checkoutItemsContainer.style.overflowY = 'auto';
            } else {
                checkoutItemsContainer.style.maxHeight = '';
                checkoutItemsContainer.style.overflowY = '';
            }
        }

        const subtotal = parseFloat(data.summary.subtotal) || 0;
        const DELIVERY_FEE = 35;
        const grandTotal = subtotal + DELIVERY_FEE;

        if (checkoutSubtotal) {
            checkoutSubtotal.textContent = this.fmtNumber(subtotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (checkoutTotal) {
            checkoutTotal.textContent = this.fmtNumber(grandTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
        if (checkoutTotalFooter) {
            checkoutTotalFooter.textContent = this.fmtNumber(grandTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }

    async loadSavedAddresses() {
        const select = document.getElementById('saved-addresses');
        if (!select || !this.token) return;

        try {
            const response = await fetch(`${this.apiBase}/addresses`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const data = await response.json();
                this.savedAddresses = data.addresses || [];
                
                // Build address display text with full name and phone
                select.innerHTML = '<option value="">Select an address</option>' +
                    this.savedAddresses.map(addr => {
                        // Format phone with +63 prefix
                        let phoneDisplay = addr.phone || '';
                        if (phoneDisplay && !phoneDisplay.startsWith('+63')) {
                            phoneDisplay = '+63' + phoneDisplay;
                        }
                        
                        // Combine address parts
                        const addressParts = [
                            addr.address_line1,
                            addr.address_line2,
                            addr.city,
                            addr.province,
                            addr.postal_code
                        ].filter(part => part && part.trim());
                        const fullAddress = addressParts.join(', ');
                        
                        // Create display text
                        const displayText = `${addr.full_name || 'Unnamed'} - ${phoneDisplay} - ${fullAddress.substring(0, 50)}${fullAddress.length > 50 ? '...' : ''}`;
                        
                        return `<option value="${addr.id}">${displayText}</option>`;
                    }).join('');
            }
        } catch (error) {
            console.error('Load saved addresses error:', error);
        }
    }

    applySavedAddress(addressId) {
        const address = (this.savedAddresses || []).find(a => String(a.id) === String(addressId));
        if (!address) return;
        
        // Populate full name
        const fullNameInput = document.getElementById('checkout-fullname');
        if (fullNameInput) {
            fullNameInput.value = address.full_name || '';
        }
        
        // Populate phone number (remove +63 prefix if present)
        const phoneInput = document.getElementById('checkout-phone');
        if (phoneInput) {
            let phone = address.phone || '';
            if (phone.startsWith('+63')) {
                phone = phone.substring(3);
            }
            phoneInput.value = this.formatPhoneInputValue(phone);
        }
    }

    async handleCheckout(e) {
        e.preventDefault();

        const fullName = document.getElementById('checkout-fullname').value.trim();
        const phone = document.getElementById('checkout-phone').value.trim();
        const phoneDigits = phone.replace(/\D/g, '');
        const deliveryAddress = 'Trabajo Market, M. Dela Fuente St., Sampaloc, Manila, Metro Manila';
        // Delivery date removed from UI; send today's date to satisfy backend requirement
        const deliveryDate = (new Date()).toISOString().split('T')[0];
        const specialInstructions = document.getElementById('special-instructions').value.trim();

        // Validate required fields
        if (!fullName) {
            this.showMessage('Please enter recipient\'s full name', 'error');
            document.getElementById('checkout-fullname').focus();
            return;
        }

        if (!phoneDigits || phoneDigits.length !== 10) {
            this.showMessage('Please enter a valid 10-digit phone number', 'error');
            document.getElementById('checkout-phone').focus();
            return;
        }

        // Delivery date no longer required.

        // Format phone with +63 prefix
        const phoneWithPrefix = `+63${phoneDigits}`;

        // Combine full name, phone, and address into delivery_address
        const fullDeliveryInfo = `${fullName} | ${phoneWithPrefix} | ${deliveryAddress}`;

        const formData = {
            delivery_address: fullDeliveryInfo,
            delivery_date: deliveryDate,
            special_instructions: specialInstructions || null,
            sessionId: this.sessionId
        };

        try {
            const response = await fetch(`${this.apiBase}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                this.closeModals();
                this.closeCart();
                this.updateCartCount();
                this.showMessage('Order placed successfully! You will pay cash on delivery.', 'success');
            } else {
                console.error('Checkout failed:', data);
                this.showMessage(data.message || 'Failed to place order. Please try again.', 'error');
            }
        } catch (error) {
            console.error('Checkout error:', error);
            this.showMessage('Failed to place order. Please check your connection and try again.', 'error');
        }
    }

    // Unified Auth Flow Management
    openAuthFlow(options = {}) {
        // If no mode specified, restore the last used mode
        let { mode, role, returnUrl = null } = options;
        const authModal = document.getElementById('auth-modal');
        if (authModal && !authModal.classList.contains('open')) {
            this._authLastFocusedElement = (document.activeElement instanceof HTMLElement)
                ? document.activeElement
                : null;
        }
        // If caller requests customer-only (e.g., from checkout), honor it
        const customerOnly = !!options.customerOnly || !!this.pendingCheckout;
        
        if (!mode) {
            mode = localStorage.getItem('last_auth_mode') || 'login';
        }
        if (!role) {
            role = localStorage.getItem('last_auth_role') || 'customer';
        }
        if (role === 'admin') role = 'staff';
        
        if (returnUrl) {
            this.returnUrl = returnUrl;
        }

        // Open auth modal; login role is now identified by backend
        this.selectedRole = role;
        this.authMode = mode;
        // Register flow still supports role selection (customer/farmer)
        try {
            const regSel = document.getElementById('role-selector-register');
            if (customerOnly) {
                if (regSel) {
                    regSel.querySelectorAll('.role-box-enhanced').forEach(btn => {
                        if (btn.getAttribute('data-role') !== 'customer') btn.style.display = 'none';
                    });
                }
                // force role to customer
                role = 'customer';
                this.selectedRole = 'customer';
            } else {
                if (regSel) regSel.querySelectorAll('.role-box-enhanced').forEach(btn => btn.style.display = 'inline-flex');
            }
        } catch (e) {
            console.warn('Error adjusting role selector visibility:', e);
        }

        this.openAuthModal(role, mode);
    }

    /** Called when user clicks a role box on the auth form. */
    selectRoleOnForm(role) {
        const mode = this.authMode || 'login';
        // Register only allows farmer/customer
        if (mode === 'register' && (role === 'staff' || !['farmer', 'customer'].includes(role))) {
            return;
        }
        this.selectedRole = role;

        const regSel = document.getElementById('role-selector-register');
        [regSel].forEach(el => {
            if (!el) return;
            el.querySelectorAll('.role-box-enhanced').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-role') === role);
            });
        });

        const authTitle = document.getElementById('auth-modal-title');
        if (authTitle) {
            authTitle.textContent = mode === 'login' ? 'Login' : 'Register';
        }
        
        // Update fullname hint based on selected role in step 4
        const fullnameHint = document.getElementById('fullname-hint');
        if (fullnameHint && mode === 'register' && this.registrationStep >= 3) {
            if (role === 'farmer') {
                fullnameHint.textContent = 'For farmers, enter your shop/farm name in First Name.';
            } else {
                fullnameHint.textContent = 'Enter your first, middle (optional), and last name.';
            }
        }
    }

    openAuthModal(role, mode) {
        // If cart is open, close it so auth modal is not covered
        try { this.closeCart(); } catch (e) {}
        const authModal = document.getElementById('auth-modal');
        const authTitle = document.getElementById('auth-modal-title');
        const authSubmitBtn = document.getElementById('auth-submit-btn');
        const sendOtpBtn = document.getElementById('send-otp-btn');
        const authModeToggle = document.getElementById('auth-mode-toggle');
        const authLoginRecaptchaWrap = document.getElementById('auth-login-recaptcha-wrap');
        const loginFields = document.getElementById('auth-login-fields');
        const registerFields = document.getElementById('auth-register-fields');
        const loginOtpSection = document.getElementById('login-otp-section');
        const registerOtpSection = document.getElementById('register-otp-section');

        // Reset OTP state
        this.otpSent = false;
        this.otpVerified = false;
        this.otpEmail = null;
        this.resetRecaptcha('auth');
        this.setRegisterRecaptchaVisible(mode === 'register');

        // Reset registration UI before restoring step state so step 1 recalculates cleanly.
        if (loginOtpSection) loginOtpSection.style.display = 'none';
        if (registerOtpSection) registerOtpSection.style.display = 'none';
        
        // Always start registration from step 1 on page load/refresh (clear saved state)
        if (mode === 'register') {
            // Clear saved registration state to start fresh (wrapped in try-catch to prevent breaking app)
            try {
                this.clearRegistrationState();
            } catch (error) {
                console.error('Error clearing registration state:', error);
                // Continue anyway - just reset the step
                this.registrationStep = 1;
            }
            
            // Always start from step 1
            this.registrationStep = 1;
            try {
                this.goToRegistrationStep(1);
            } catch (error) {
                console.error('Error going to registration step 1:', error);
            }
        } else {
            // Reset to step 1 for login mode
            this.registrationStep = 1;
        }

        // Password strength UI removed - nothing to reset

        // Ensure valid role for mode
        if (mode === 'register' && !['farmer', 'customer'].includes(role)) {
            role = 'customer';
        }
        this.selectedRole = role;

        // Show Send OTP button, hide initially
        if (sendOtpBtn) sendOtpBtn.style.display = 'block';

        // Role selectors are now inside their respective mode containers, so they show/hide automatically
        this.selectRoleOnForm(role);

        // Update title
        if (authTitle) {
            authTitle.textContent = mode === 'login' ? 'Login' : 'Register';
        }

        if (mode === 'login') {
            loginFields.style.display = 'block';
            registerFields.style.display = 'none';
            this.setAuthFieldsDisabled(loginFields, false);
            this.setAuthFieldsDisabled(registerFields, true);
            // Show main submit button for login
            if (authSubmitBtn) {
                authSubmitBtn.style.display = 'block';
                authSubmitBtn.textContent = 'Login';
            }
            if (authLoginRecaptchaWrap) {
                authLoginRecaptchaWrap.style.display = 'block';
            }
            if (sendOtpBtn) {
                sendOtpBtn.style.display = 'none';
            }
            if (authModeToggle) {
                authModeToggle.innerHTML = `Don't have an account? <a href="#" id="switch-to-register">Register here</a>`;
                const switchLink = document.getElementById('switch-to-register');
                if (switchLink) {
                    switchLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.switchAuthMode('register');
                    });
                }
            }
        } else {
            loginFields.style.display = 'none';
            registerFields.style.display = 'block';
            this.setAuthFieldsDisabled(loginFields, true);
            this.setAuthFieldsDisabled(registerFields, false);
            // Hide main submit button during registration (we use step navigation instead)
            if (authSubmitBtn) {
                authSubmitBtn.style.display = 'none';
            }
            if (authLoginRecaptchaWrap) {
                authLoginRecaptchaWrap.style.display = 'none';
            }
            if (sendOtpBtn) {
                sendOtpBtn.style.display = 'none';
            }
            if (authModeToggle) {
                authModeToggle.innerHTML = `Already have an account? <a href="#" id="switch-to-login">Login</a>`;
                const switchLink = document.getElementById('switch-to-login');
                if (switchLink) {
                    switchLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.switchAuthMode('login');
                    });
                }
            }
        }

        // Clear the other mode's visible fields to avoid showing wrong data
        if (mode === 'login') {
            // Clear registration fields visually (but keep in storage)
            const registerFields = document.getElementById('auth-register-fields');
            if (registerFields) {
                registerFields.querySelectorAll('input, textarea, select').forEach(field => {
                    field.value = '';
                });
            }
        } else {
            // Clear login fields visually (but keep in storage)
            const loginFields = document.getElementById('auth-login-fields');
            if (loginFields) {
                loginFields.querySelectorAll('input').forEach(input => {
                    input.value = '';
                });
            }
        }
        
        // Only restore saved form data when modal first opens (fields are empty)
        // Don't restore when navigating between registration steps
        const shouldRestore = mode === 'login' 
            ? (!document.getElementById('auth-email')?.value && !document.getElementById('auth-password')?.value)
            : (!document.getElementById('auth-email-register')?.value && !document.getElementById('auth-password-register')?.value);
        
        if (shouldRestore) {
            this.restoreFormData(mode);
        }
        
        // Ensure auth modal is attached to body so fixed positioning and z-index work
        try {
            if (authModal && authModal.parentElement !== document.body) document.body.appendChild(authModal);
        } catch (e) {}
        authModal.classList.add('open');
        this.setPageScrollLocked(true);
        this.activateAuthFocusTrap();
        this.focusAuthModalPrimaryField(mode);
    }

    getAuthModalFocusableElements() {
        const authModal = document.getElementById('auth-modal');
        if (!authModal || !authModal.classList.contains('open')) return [];

        const selector = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        return Array.from(authModal.querySelectorAll(selector)).filter((el) => {
            if (!(el instanceof HTMLElement)) return false;
            if (el.getAttribute('aria-hidden') === 'true') return false;
            const style = window.getComputedStyle(el);
            if (style.visibility === 'hidden' || style.display === 'none') return false;
            return el.getClientRects().length > 0;
        });
    }

    focusAuthModalPrimaryField(mode) {
        const preferredIds = mode === 'register'
            ? ['auth-email-register', 'auth-username', 'auth-firstname']
            : ['auth-email', 'auth-password'];

        for (const id of preferredIds) {
            const el = document.getElementById(id);
            if (el && !el.disabled && el.getClientRects().length > 0) {
                el.focus();
                return;
            }
        }

        const focusable = this.getAuthModalFocusableElements();
        if (focusable.length > 0) {
            focusable[0].focus();
        }
    }

    activateAuthFocusTrap() {
        const authModal = document.getElementById('auth-modal');
        if (!authModal) return;

        this.deactivateAuthFocusTrap();

        this._authFocusTrapHandler = (event) => {
            if (event.key !== 'Tab') return;
            if (!authModal.classList.contains('open')) return;

            const focusable = this.getAuthModalFocusableElements();
            if (focusable.length === 0) {
                event.preventDefault();
                authModal.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (!authModal.contains(active)) {
                event.preventDefault();
                first.focus();
                return;
            }

            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
                return;
            }

            if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', this._authFocusTrapHandler, true);
    }

    deactivateAuthFocusTrap() {
        if (!this._authFocusTrapHandler) return;
        document.removeEventListener('keydown', this._authFocusTrapHandler, true);
        this._authFocusTrapHandler = null;
    }

    /** Disable/enable inputs in a mode container so hidden fields don't block validation or submit. */
    setAuthFieldsDisabled(container, disabled) {
        if (!container) return;
        container.querySelectorAll('input, textarea, select').forEach(field => {
            field.disabled = disabled;
        });
    }

    switchAuthMode(newMode) {
        // Clear the previous mode's visible fields when switching
        const previousMode = this.authMode || 'login';
        if (previousMode === 'login') {
            const loginFields = document.getElementById('auth-login-fields');
            if (loginFields) {
                loginFields.querySelectorAll('input').forEach(input => {
                    input.value = '';
                });
            }
        } else {
            const registerFields = document.getElementById('auth-register-fields');
            if (registerFields) {
                registerFields.querySelectorAll('input, textarea').forEach(field => {
                    field.value = '';
                });
            }
        }
        
        this.authMode = newMode;
        // Register only allows farmer/customer; if current role is staff, switch to customer
        let role = this.selectedRole;
        if (newMode === 'register' && role === 'staff') role = 'customer';
        this.selectedRole = role;
        this.openAuthModal(role, newMode);
    }

    async checkUsernameAvailability(username) {
        if (!username || username.trim().length === 0) {
            return false;
        }

        try {
            const response = await fetch(`${this.apiBase}/auth/check-username/${encodeURIComponent(username)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.available) {
                return true;
            } else {
                // Username is not available or there was an error
                const errorMessage = data.message || 'This username is already taken. Please choose a different username.';
                this.showMessage(errorMessage, 'error');
                document.getElementById('auth-username').focus();
                return false;
            }
        } catch (error) {
            console.error('Check username availability error:', error);
            this.showMessage('Failed to check username availability. Please try again.', 'error');
            return false;
        }
    }

    setupPhoneInput() {
        const phoneInput = document.getElementById('auth-phone');
        if (!phoneInput) return;

        // Format phone number as XXX XXX XXXX
        const formatPhoneNumber = (value) => {
            // Remove all non-numeric characters
            let numbers = value.replace(/\D/g, '');
            // Remove leading 0 if present
            if (numbers.startsWith('0')) numbers = numbers.substring(1);
            // Limit to 10 digits
            const digits = numbers.substring(0, 10);
            // Format with spaces: XXX XXX XXXX
            if (digits.length <= 3) {
                return digits;
            } else if (digits.length <= 6) {
                return digits.substring(0, 3) + ' ' + digits.substring(3);
            } else {
                return digits.substring(0, 3) + ' ' + digits.substring(3, 6) + ' ' + digits.substring(6);
            }
        };

        // Only allow numbers and format with spaces
        phoneInput.addEventListener('input', (e) => {
            let value = e.target.value;
            let formatted = formatPhoneNumber(value);
            // If user tries to type 0 as first digit, remove it
            if (formatted.startsWith('0')) formatted = formatted.substring(1);
            e.target.value = formatted;
        });

        // Prevent paste of non-numeric characters and enforce rules
        phoneInput.addEventListener('paste', (e) => {
            e.preventDefault();
            let paste = (e.clipboardData || window.clipboardData).getData('text');
            let numbers = paste.replace(/\D/g, '');
            if (numbers.startsWith('0')) numbers = numbers.substring(1);
            phoneInput.value = formatPhoneNumber(numbers);
            phoneInput.dispatchEvent(new Event('input'));
        });

        // Prevent typing non-numeric characters and block leading 0
        phoneInput.addEventListener('keypress', (e) => {
            const char = String.fromCharCode(e.which);
            // Only allow numbers
            if (!/[0-9]/.test(char)) {
                e.preventDefault();
            }
            // Prevent typing 0 as first digit
            if (e.target.selectionStart === 0 && char === '0') {
                e.preventDefault();
            }
            // Prevent typing if already 10 digits
            const numbers = e.target.value.replace(/\D/g, '');
            if (numbers.length >= 10) {
                e.preventDefault();
            }
        });
    }

    setupFormPersistence() {
        // Save login form data
        const loginEmail = document.getElementById('auth-email');
        const loginPassword = document.getElementById('auth-password');
        
        if (loginEmail) {
            loginEmail.addEventListener('input', () => {
                this.saveFormData('login', { email: loginEmail.value });
            });
        }
        if (loginPassword) {
            loginPassword.addEventListener('input', () => {
                this.saveFormData('login', { password: loginPassword.value });
            });
        }

        // Save registration form data
        const registerEmail = document.getElementById('auth-email-register');
        const registerPassword = document.getElementById('auth-password-register');
        const registerPasswordConfirm = document.getElementById('auth-password-confirm');
        const registerUsername = document.getElementById('auth-username');
        const registerFirstName = document.getElementById('auth-firstname');
        const registerMiddleName = document.getElementById('auth-middlename');
        const registerLastName = document.getElementById('auth-lastname');
        const registerPhone = document.getElementById('auth-phone');
        const registerStreet = document.getElementById('auth-street');
        const registerAddress = document.getElementById('auth-address');

        if (registerEmail) {
            registerEmail.addEventListener('input', () => {
                this.saveFormData('register', { email: registerEmail.value });
            });
        }
        if (registerPassword) {
            registerPassword.addEventListener('input', () => {
                this.saveFormData('register', { password: registerPassword.value });
            });
        }
        if (registerPasswordConfirm) {
            registerPasswordConfirm.addEventListener('input', () => {
                this.saveFormData('register', { passwordConfirm: registerPasswordConfirm.value });
            });
        }
        if (registerUsername) {
            registerUsername.addEventListener('input', () => {
                this.saveFormData('register', { username: registerUsername.value });
            });
        }
        if (registerFirstName) {
            registerFirstName.addEventListener('input', () => {
                this.saveFormData('register', { firstName: registerFirstName.value });
            });
        }
        if (registerMiddleName) {
            registerMiddleName.addEventListener('input', () => {
                this.saveFormData('register', { middleName: registerMiddleName.value });
            });
        }
        if (registerLastName) {
            registerLastName.addEventListener('input', () => {
                this.saveFormData('register', { lastName: registerLastName.value });
            });
        }
        if (registerPhone) {
            registerPhone.addEventListener('input', () => {
                // Save only the digits (10 digits max, no +63 prefix, no spaces in storage)
                const phoneDigits = registerPhone.value.replace(/\D/g, '').substring(0, 10);
                this.saveFormData('register', { phone: phoneDigits });
            });
        }
        if (registerStreet) {
            registerStreet.addEventListener('input', () => {
                this.saveFormData('register', { street: registerStreet.value });
                this.updateRegistrationAddressPreview();
            });
        }
        if (registerAddress) {
            registerAddress.addEventListener('input', () => {
                this.saveFormData('register', { address: registerAddress.value });
            });
        }
    }

    saveFormData(mode, data) {
        try {
            const key = `auth_form_${mode}`;
            const existing = JSON.parse(localStorage.getItem(key) || '{}');
            const updated = { ...existing, ...data };
            localStorage.setItem(key, JSON.stringify(updated));
        } catch (e) {
            console.error('Error saving form data:', e);
        }
    }

    restoreFormData(mode) {
        try {
            const key = `auth_form_${mode}`;
            const saved = JSON.parse(localStorage.getItem(key) || '{}');
            
            if (mode === 'login') {
                if (saved.email && document.getElementById('auth-email')) {
                    document.getElementById('auth-email').value = saved.email;
                }
                if (saved.password && document.getElementById('auth-password')) {
                    document.getElementById('auth-password').value = saved.password;
                }
            } else if (mode === 'register') {
                if (saved.email && document.getElementById('auth-email-register')) {
                    document.getElementById('auth-email-register').value = saved.email;
                }
                if (saved.password && document.getElementById('auth-password-register')) {
                    document.getElementById('auth-password-register').value = saved.password;
                }
                if (saved.passwordConfirm && document.getElementById('auth-password-confirm')) {
                    document.getElementById('auth-password-confirm').value = saved.passwordConfirm;
                }
                if (saved.username && document.getElementById('auth-username')) {
                    document.getElementById('auth-username').value = saved.username;
                }
                if (saved.firstName && document.getElementById('auth-firstname')) {
                    document.getElementById('auth-firstname').value = saved.firstName;
                }
                if (saved.middleName && document.getElementById('auth-middlename')) {
                    document.getElementById('auth-middlename').value = saved.middleName;
                }
                if (saved.lastName && document.getElementById('auth-lastname')) {
                    document.getElementById('auth-lastname').value = saved.lastName;
                }
                if (saved.fullname && document.getElementById('auth-firstname')) {
                    if (!saved.firstName && !saved.lastName) {
                        document.getElementById('auth-firstname').value = saved.fullname;
                    }
                }
                if (saved.street && document.getElementById('auth-street')) {
                    document.getElementById('auth-street').value = saved.street;
                }
                if (saved.phone && document.getElementById('auth-phone')) {
                    // Remove +63 prefix if present and format with spaces
                    let phoneDigits = saved.phone.replace(/^\+63/, '').replace(/\D/g, '');
                    if (phoneDigits.length > 10) {
                        phoneDigits = phoneDigits.substring(0, 10);
                    }
                    // Format with spaces: XXX XXX XXXX
                    let formattedPhone = '';
                    if (phoneDigits.length <= 3) {
                        formattedPhone = phoneDigits;
                    } else if (phoneDigits.length <= 6) {
                        formattedPhone = phoneDigits.substring(0, 3) + ' ' + phoneDigits.substring(3);
                    } else {
                        formattedPhone = phoneDigits.substring(0, 3) + ' ' + phoneDigits.substring(3, 6) + ' ' + phoneDigits.substring(6);
                    }
                    document.getElementById('auth-phone').value = formattedPhone;
                }
                if (saved.address && document.getElementById('auth-address')) {
                    document.getElementById('auth-address').value = saved.address;
                }
                this.setupRegistrationAddressForm({
                    province: saved.addressParts?.province || '',
                    city: saved.addressParts?.city || '',
                    barangay: saved.addressParts?.barangay || '',
                    street: saved.street || ''
                }).catch((error) => {
                    console.error('Registration PSGC restore error:', error);
                    this.updateRegistrationAddressPreview();
                });
            }
        } catch (e) {
            console.error('Error restoring form data:', e);
        }
    }

    clearFormData(mode) {
        try {
            const key = `auth_form_${mode}`;
            localStorage.removeItem(key);
        } catch (e) {
            console.error('Error clearing form data:', e);
        }
    }

    getRegistrationAddressParts() {
        const province = document.getElementById('auth-province')?.value || '';
        const city = document.getElementById('auth-city')?.value || '';
        const barangay = document.getElementById('auth-barangay')?.value || '';
        if (province || city || barangay) {
            return { province, city, barangay };
        }
        try {
            const saved = JSON.parse(localStorage.getItem('auth_form_register') || '{}');
            if (saved.addressParts?.province || saved.addressParts?.city || saved.addressParts?.barangay) {
                return {
                    province: saved.addressParts.province || '',
                    city: saved.addressParts.city || '',
                    barangay: saved.addressParts.barangay || ''
                };
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    setRegistrationAddressParts(parts = {}) {
        const province = parts.province || '';
        const city = parts.city || '';
        const barangay = parts.barangay || '';

        const provinceInput = document.getElementById('auth-province');
        const cityInput = document.getElementById('auth-city');
        const barangayInput = document.getElementById('auth-barangay');

        if (provinceInput) provinceInput.value = province;
        if (cityInput) cityInput.value = city;
        if (barangayInput) barangayInput.value = barangay;

        this.saveFormData('register', { addressParts: { province, city, barangay } });
    }

    async setupRegistrationAddressForm(address = null) {
        if (!window.PSGC) return;

        const zoneSelect = document.getElementById('auth-zone');
        const provinceSelect = document.getElementById('auth-province');
        const citySelect = document.getElementById('auth-city');
        const barangaySelect = document.getElementById('auth-barangay');
        const streetInput = document.getElementById('auth-street');

        if (!zoneSelect || !provinceSelect || !citySelect || !barangaySelect || !streetInput) return;

        // Always initialise the zone dropdown
        window.PSGC.loadZones(zoneSelect);

        // Reset downstream on a fresh load
        window.PSGC.setSelectOptions(provinceSelect, [], 'Select Province');
        provinceSelect.disabled = true;
        window.PSGC.setSelectOptions(citySelect, [], 'Select City / Municipality');
        citySelect.disabled = true;
        window.PSGC.setSelectOptions(barangaySelect, [], 'Select Barangay');
        barangaySelect.disabled = true;
        streetInput.value = address?.street || '';
        this.updateRegistrationAddressPreview();
    }

    async handleRegistrationZoneChange() {
        if (!window.PSGC) return;
        const zone = document.getElementById('auth-zone')?.value || '';
        const provinceEl = document.getElementById('auth-province');
        const cityEl = document.getElementById('auth-city');
        const barangayEl = document.getElementById('auth-barangay');
        await window.PSGC.onZoneChange(zone, { provinceEl, cityEl, barangayEl }).catch(() => {});
        this.updateRegistrationAddressPreview();
    }

    async handleRegistrationProvinceChange() {
        if (!window.PSGC) return;
        const province = document.getElementById('auth-province')?.value || '';
        const citySelect = document.getElementById('auth-city');
        const barangaySelect = document.getElementById('auth-barangay');
        await window.PSGC.loadCities(province, citySelect);
        window.PSGC.setSelectOptions(barangaySelect, [], 'Select Barangay');
        this.updateRegistrationAddressPreview();
    }

    async handleRegistrationCityChange() {
        if (!window.PSGC) return;
        const city = document.getElementById('auth-city')?.value || '';
        await window.PSGC.loadBarangays(city, document.getElementById('auth-barangay'));
        this.updateRegistrationAddressPreview();
    }

    buildRegistrationAddress() {
        const street = document.getElementById('auth-street')?.value.trim() || '';
        const parts = this.getRegistrationAddressParts() || {};
        const composed = window.PSGC
            ? window.PSGC.formatAddress({ street, barangay: parts.barangay, city: parts.city, province: parts.province })
            : [street, parts.barangay, parts.city, parts.province].filter(Boolean).join(', ');
        const addressInput = document.getElementById('auth-address');
        if (addressInput) {
            addressInput.value = composed;
        }
        this.saveFormData('register', {
            address: composed,
            street,
            addressParts: {
                province: parts.province || '',
                city: parts.city || '',
                barangay: parts.barangay || ''
            }
        });
        return composed;
    }

    buildRegistrationFullName() {
        const firstName = document.getElementById('auth-firstname')?.value.trim() || '';
        const middleName = document.getElementById('auth-middlename')?.value.trim() || '';
        const lastName = document.getElementById('auth-lastname')?.value.trim() || '';
        return [firstName, middleName, lastName].filter(Boolean).join(' ').trim();
    }

    getCheckoutAddressParts() {
        const province = document.getElementById('floating-address-province')?.value || '';
        const city = document.getElementById('floating-address-city')?.value || '';
        const barangay = document.getElementById('floating-address-barangay')?.value || '';
        if (province || city || barangay) {
            return { province, city, barangay };
        }
        return null;
    }

    setCheckoutAddressParts(parts = {}) {
        const province = parts.province || '';
        const city = parts.city || '';
        const barangay = parts.barangay || '';

        const provinceInput = document.getElementById('floating-address-province');
        const cityInput = document.getElementById('floating-address-city');
        const barangayInput = document.getElementById('floating-address-barangay');

        if (provinceInput) provinceInput.value = province;
        if (cityInput) cityInput.value = city;
        if (barangayInput) barangayInput.value = barangay;
    }

    buildCheckoutAddress() {
        const street = document.getElementById('floating-address-street')?.value.trim() || '';
        const parts = this.getCheckoutAddressParts() || {};
        const addressParts = [street, parts.barangay, parts.city, parts.province].filter(Boolean);
        const composed = addressParts.join(', ');
        const addressInput = document.getElementById('floating-address-full');
        if (addressInput) {
            addressInput.value = composed;
        }
        return composed;
    }

    updateRegistrationAddressPreview() {
        const street = document.getElementById('auth-street')?.value.trim() || '';
        const parts = this.getRegistrationAddressParts() || {};
        const hasSelection = parts.province && parts.city && parts.barangay;
        const addressInput = document.getElementById('auth-address');

        if (!addressInput) return;

        if (hasSelection || street) {
            addressInput.value = this.buildRegistrationAddress();
            return;
        }

        addressInput.value = '';
    }

    clearRegistrationState() {
        try {
            // Clear all registration-related localStorage items
            localStorage.removeItem('last_registration_step');
            localStorage.removeItem('last_otp_sent');
            localStorage.removeItem('last_otp_verified');
            localStorage.removeItem('last_otp_email');
            localStorage.removeItem('register_email');
            localStorage.removeItem('register_username');
            localStorage.removeItem('register_fullname');
            localStorage.removeItem('register_phone');
            localStorage.removeItem('register_address');
            localStorage.removeItem('register_role');

            // Reset registration state variables
            this.registrationStep = 1;
            this.otpSent = false;
            this.otpVerified = false;
            this.otpEmail = null;
            this.selectedRole = 'customer';
            this.isLoading = false;
        } catch (error) {
            console.error('Error in clearRegistrationState:', error);
            // Don't throw - just log the error so it doesn't break the app
        }
    }

    closeAuthFlow() {
        this.deactivateAuthFocusTrap();

        // Save the current mode before closing
        if (this.authMode) {
            localStorage.setItem('last_auth_mode', this.authMode);
        }
        if (this.selectedRole) {
            localStorage.setItem('last_auth_role', this.selectedRole);
        }
        
        // Save registration step if in register mode
        if (this.authMode === 'register' && this.registrationStep) {
            localStorage.setItem('last_registration_step', this.registrationStep.toString());
            // Also save OTP state
            localStorage.setItem('last_otp_sent', this.otpSent ? 'true' : 'false');
            localStorage.setItem('last_otp_verified', this.otpVerified ? 'true' : 'false');
            if (this.otpEmail) {
                localStorage.setItem('last_otp_email', this.otpEmail);
            }
        }
        
        // Don't clear form data when closing - preserve it for next time
        const authModal = document.getElementById('auth-modal');
        if (authModal) {
            authModal.classList.remove('open');
        }
        this.setPageScrollLocked(false);
        // Reset state but keep form data
        this.selectedRole = null;
        this.authMode = null;
        this.returnUrl = null;
        // Reset OTP state
        this.otpSent = false;
        this.otpVerified = false;
        this.otpEmail = null;
        this.setRegisterRecaptchaVisible(false);
        this.clearMessage();

        const focusTarget = this._authLastFocusedElement;
        this._authLastFocusedElement = null;
        if (focusTarget && typeof focusTarget.focus === 'function' && document.contains(focusTarget)) {
            setTimeout(() => focusTarget.focus(), 0);
        }
    }

    clearAuthForm() {
        // Clear all auth form fields
        const loginFields = document.getElementById('auth-login-fields');
        const registerFields = document.getElementById('auth-register-fields');
        
        if (loginFields) {
            loginFields.querySelectorAll('input').forEach(input => {
                input.value = '';
            });
        }
        if (registerFields) {
            registerFields.querySelectorAll('input, textarea, select').forEach(field => {
                field.value = '';
            });
        }
        this.setupRegistrationAddressForm().catch((error) => {
            console.error('Registration PSGC reset error:', error);
        });
        this.setRegisterRecaptchaVisible(true);
        
        // Clear OTP inputs
        const loginOtp = document.getElementById('login-otp');
        const registerOtp = document.getElementById('register-otp');
        if (loginOtp) loginOtp.value = '';
        if (registerOtp) registerOtp.value = '';
        
        // Hide OTP sections
        const loginOtpSection = document.getElementById('login-otp-section');
        const registerOtpSection = document.getElementById('register-otp-section');
        if (loginOtpSection) loginOtpSection.style.display = 'none';
        if (registerOtpSection) registerOtpSection.style.display = 'none';
        
        // Reset OTP state
        this.otpSent = false;
        this.otpVerified = false;
        this.otpEmail = null;
        this.resetRecaptcha('auth');
        this.clearMessage();
    }

    openAddAddressModal() {
        const modal = document.getElementById('add-address-modal');
        if (modal) {
            modal.classList.add('open');
            this.setupFloatingAddressForm().catch((error) => {
                console.error('Floating PSGC load error:', error);
                this.showMessage('Failed to load provinces. Please try again.', 'error');
            });
            // Prevent closing checkout when clicking outside add address modal
            // Prevent event from bubbling to checkout modal
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.addEventListener('click', (e) => {
                    e.stopPropagation();
                });
            }
            
            // Close add address modal when clicking outside (but not checkout)
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAddAddressModal();
                }
            });
            // Focus on first input
            setTimeout(() => {
                const firstInput = document.getElementById('floating-address-fullname');
                if (firstInput) {
                    firstInput.focus();
                }
            }, 100);
        }
    }

    closeAddAddressModal() {
        const modal = document.getElementById('add-address-modal');
        if (modal) {
            modal.classList.remove('open');
            // Reset form
            const form = document.getElementById('add-address-form');
            if (form) {
                form.reset();
            }
            this.setCheckoutAddressParts({});
            const addressPreview = document.getElementById('floating-address-full');
            if (addressPreview) {
                addressPreview.value = '';
            }
            const streetHidden = document.getElementById('floating-address-street');
            if (streetHidden) {
                streetHidden.value = '';
            }
            this.setupFloatingAddressForm().catch((error) => {
                console.error('Floating PSGC reset error:', error);
            });
            // Ensure checkout modal stays open
            const checkoutModal = document.getElementById('checkout-modal');
            if (checkoutModal && !checkoutModal.classList.contains('open')) {
                checkoutModal.classList.add('open');
            }
        }
    }

    async setupFloatingAddressForm(address = null) {
        if (!window.PSGC) return;

        const zoneSelect = document.getElementById('floating-address-zone');
        const provinceSelect = document.getElementById('floating-address-province');
        const citySelect = document.getElementById('floating-address-city');
        const barangaySelect = document.getElementById('floating-address-barangay');
        const streetInput = document.getElementById('floating-address-street');

        if (!zoneSelect || !provinceSelect || !citySelect || !barangaySelect || !streetInput) return;

        window.PSGC.loadZones(zoneSelect);

        window.PSGC.setSelectOptions(provinceSelect, [], 'Select Province');
        provinceSelect.disabled = true;
        window.PSGC.setSelectOptions(citySelect, [], 'Select City / Municipality');
        citySelect.disabled = true;
        window.PSGC.setSelectOptions(barangaySelect, [], 'Select Barangay');
        barangaySelect.disabled = true;
        streetInput.value = address?.street || '';
        this.buildCheckoutAddress();
    }

    async handleFloatingAddressZoneChange() {
        if (!window.PSGC) return;
        const zone = document.getElementById('floating-address-zone')?.value || '';
        const provinceEl = document.getElementById('floating-address-province');
        const cityEl = document.getElementById('floating-address-city');
        const barangayEl = document.getElementById('floating-address-barangay');
        await window.PSGC.onZoneChange(zone, { provinceEl, cityEl, barangayEl }).catch(() => {});
        this.buildCheckoutAddress();
    }

    async handleFloatingAddressProvinceChange() {
        if (!window.PSGC) return;
        const province = document.getElementById('floating-address-province')?.value || '';
        const citySelect = document.getElementById('floating-address-city');
        const barangaySelect = document.getElementById('floating-address-barangay');
        await window.PSGC.loadCities(province, citySelect);
        window.PSGC.setSelectOptions(barangaySelect, [], 'Select Barangay');
        this.buildCheckoutAddress();
    }

    async handleFloatingAddressCityChange() {
        if (!window.PSGC) return;
        const city = document.getElementById('floating-address-city')?.value || '';
        await window.PSGC.loadBarangays(city, document.getElementById('floating-address-barangay'));
        this.buildCheckoutAddress();
    }

    async saveAddressFromCheckout(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('floating-address-fullname').value.trim();
        const phone = document.getElementById('floating-address-phone').value.trim();
        const phoneDigits = phone.replace(/\D/g, '');
        const street = document.getElementById('floating-address-street').value.trim();
        const address = document.getElementById('floating-address-full').value.trim();
        const addressParts = this.getCheckoutAddressParts() || {};
        const hasSelection = addressParts.province && addressParts.city && addressParts.barangay;
        
        // Validation
        if (!fullName) {
            this.showMessage('Please enter your full name', 'error');
            document.getElementById('floating-address-fullname').focus();
            return;
        }
        
        if (!phoneDigits || phoneDigits.length !== 10) {
            this.showMessage('Please enter a valid 10-digit phone number', 'error');
            document.getElementById('floating-address-phone').focus();
            return;
        }
        
        if (!street) {
            this.showMessage('Please enter your street/building/house number', 'error');
            document.getElementById('floating-address-street')?.focus();
            return;
        }

        if (!hasSelection) {
            this.showMessage('Please select your barangay, city, and province', 'error');
            return;
        }

        if (!address) {
            this.showMessage('Please confirm your address selection', 'error');
            document.getElementById('floating-address-full').focus();
            return;
        }
        
        // Format phone with +63 prefix for storage
        const phoneWithPrefix = `+63${phoneDigits}`;
        
        // Store the full address in address_line1, other fields empty
        const payload = {
            label: '',
            full_name: fullName,
            phone: phoneWithPrefix,
            street,
            barangay: addressParts.barangay || '',
            address_line1: street,
            address_line2: addressParts.barangay || '',
            city: addressParts.city || '',
            province: addressParts.province || '',
            postal_code: '',
            is_default: document.getElementById('floating-address-default').checked
        };

        try {
            const response = await fetch(`${this.apiBase}/addresses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Close the add address modal
                this.closeAddAddressModal();
                
                // Refresh the saved addresses dropdown
                await this.loadSavedAddresses();
                
                // Show success message
                this.showMessage('Address saved successfully!', 'success');
                
                // Optionally select the newly added address
                if (data.address && data.address.id) {
                    const select = document.getElementById('saved-addresses');
                    if (select) {
                        select.value = data.address.id;
                        this.applySavedAddress(data.address.id);
                    }
                }
            } else {
                this.showMessage(data.message || 'Failed to save address', 'error');
            }
        } catch (error) {
            console.error('Save address error:', error);
            this.showMessage('Failed to save address. Please try again.', 'error');
        }
    }

    closeModals() {
        // Keep this for other modals (cart, checkout, etc.)
        // But don't use it for auth flow - use closeAuthFlow() instead
        const checkoutModal = document.getElementById('checkout-modal');
        const shouldUnlock = !!(checkoutModal && checkoutModal.classList.contains('open'));
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.id !== 'auth-modal') {
                modal.classList.remove('open');
            }
        });
        if (shouldUnlock) {
            this.setPageScrollLocked(false);
        }
    }

    // Utility functions
    scrollToSection(sectionId) {
        const element = document.querySelector(sectionId);
        if (element) {
            const headerOffset = 100; // Account for fixed header
            const elementPosition = element.offsetTop;
            const offsetPosition = elementPosition - headerOffset;

            // Use smooth scroll with better easing
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Update active nav link immediately and after scrolling
            this.updateActiveNavLink();
            setTimeout(() => {
                this.updateActiveNavLink();
            }, 300);
        }
    }

    updateActiveNavLink() {
        const sections = ['home', 'featured', 'products', 'about', 'contact'];
        const headerEl = document.querySelector('.header');
        const headerOffset = headerEl ? headerEl.offsetHeight : 100;
        const scrollY = window.scrollY || window.pageYOffset;

        // If very near top prefer 'home'
        let activeSection = 'home';
        if (scrollY > headerOffset + 10) {
            // Find section whose top is nearest to the header offset area
            let minDistance = Infinity;
            const referenceTop = headerOffset + 10; // px from viewport top
            sections.forEach(sectionId => {
                const section = document.getElementById(sectionId);
                if (!section) return;
                const rect = section.getBoundingClientRect();
                const distance = Math.abs(rect.top - referenceTop);
                if (distance < minDistance) {
                    minDistance = distance;
                    activeSection = sectionId;
                }
            });
        }

        // Update nav links (normalize hrefs so /#products and #products both match)
        const normalizeHash = (href) => {
            if (!href) return null;
            const hashIndex = href.indexOf('#');
            if (hashIndex === -1) return null;
            return href.slice(hashIndex);
        };
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            const href = normalizeHash(link.getAttribute('href'));
            if (href === `#${activeSection}`) {
                link.classList.add('active');
            }
        });
    }

    getCurrentSectionHash() {
        const fallback = '#products';
        const activeLink = document.querySelector('.nav-link.active');
        const href = activeLink?.getAttribute('href') || '';
        const hashIndex = href.indexOf('#');
        const hashFromActive = hashIndex >= 0 ? href.slice(hashIndex) : '';
        if (['#home', '#featured', '#products', '#about', '#contact'].includes(hashFromActive)) {
            return hashFromActive;
        }
        const fromLocation = String(window.location.hash || '').trim();
        if (['#home', '#featured', '#products', '#about', '#contact'].includes(fromLocation)) {
            return fromLocation;
        }
        return fallback;
    }

    buildOrdersUrl(options = {}) {
        const { highlightOrderId = null } = options;
        const params = new URLSearchParams();
        const returnTo = '#home';
        const returnPath = '/';
        params.set('returnTo', returnTo);
        params.set('returnPath', returnPath);
        localStorage.setItem('ordersReturnTo', returnTo);
        if (highlightOrderId) {
            params.set('highlightOrderId', String(highlightOrderId));
        }
        return `/orders.html?${params.toString()}`;
    }

    showMessage(message, type = 'info', options = {}) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        if (options?.position === 'center') {
            toast.classList.add('toast-centered');
        }
        toast.textContent = message;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    clearMessage() {
        document.querySelectorAll('.toast').forEach((toast) => toast.remove());
    }

    goToAdminPanel() {
        // Redirect super admin to admin panel
        window.location.href = '/admin.html';
    }

    startResendOtpCooldown(seconds) {
        const resendRegisterOtpBtn = document.getElementById('resend-register-otp-btn');
        const resendOtpCooldown = document.getElementById('resend-otp-cooldown');
        if (!resendRegisterOtpBtn || !resendOtpCooldown) return;
        resendRegisterOtpBtn.disabled = true;
        resendOtpCooldown.style.display = 'inline';
        this.resendOtpCooldownEnd = Date.now() + seconds * 1000;
        this.updateResendOtpCooldown();
        if (this.resendOtpCooldownTimer) clearInterval(this.resendOtpCooldownTimer);
        this.resendOtpCooldownTimer = setInterval(() => this.updateResendOtpCooldown(), 250);
    }

    updateResendOtpCooldown() {
        const resendRegisterOtpBtn = document.getElementById('resend-register-otp-btn');
        const resendOtpCooldown = document.getElementById('resend-otp-cooldown');
        if (!resendRegisterOtpBtn || !resendOtpCooldown) return;
        const remaining = Math.max(0, Math.ceil((this.resendOtpCooldownEnd - Date.now()) / 1000));
        resendOtpCooldown.textContent = remaining > 0 ? `Wait ${remaining}s` : '';
        if (remaining <= 0) {
            resendRegisterOtpBtn.disabled = false;
            resendOtpCooldown.style.display = 'none';
            if (this.resendOtpCooldownTimer) clearInterval(this.resendOtpCooldownTimer);
        }
    }
}

// Initialize the app when DOM is loaded
let app;

function initializeApp() {
    try {
        if (app) {
            console.log('App already initialized');
            return;
        }
        app = new AgricultureMarket();
        // Make app globally accessible for onclick handlers
        window.app = app;
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        console.error('Error stack:', error.stack);
        // Try to show error to user
        const productsGrid = document.getElementById('products-grid');
        if (productsGrid) {
            productsGrid.innerHTML = `<div class="error-state"><p>Failed to initialize application: ${error.message}</p><p>Please refresh the page.</p></div>`;
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded, initialize immediately
    initializeApp();
}

// Fallback: Try to initialize after a short delay if app is still not initialized
setTimeout(() => {
    if (!window.app && !app) {
        console.warn('App not initialized after 1 second, attempting fallback initialization...');
        initializeApp();
    }
}, 1000);

// Expose a global function to manually load products if needed
window.loadProductsManually = function() {
    if (window.app && typeof window.app.loadProducts === 'function') {
        console.log('Manually loading products...');
        window.app.loadProducts();
    } else {
        console.error('App not available. Cannot load products manually.');
    }
};

// Add to Cart button animation
function setupAddToCartAnimation() {
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            btn.classList.add('animated');
            setTimeout(() => {
                btn.classList.remove('animated');
            }, 450); // Match animation duration
        });
    });
}

// Call this after DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAddToCartAnimation);
} else {
    setupAddToCartAnimation();
}