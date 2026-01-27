// AgriFishery Market Frontend JavaScript

class AgriFisheryMarket {
    // ...existing code...
    constructor() {
        // Use relative /api so Netlify can proxy to Render.
        this.apiBase = '/api';
        this.token = localStorage.getItem('token');
        this.sessionId = this.getOrCreateSessionId();
        this.currentPage = 1;
        this.currentCategory = '';
        this.currentSearch = '';
        // Unified auth flow state
        this.selectedRole = null; // 'farmer', 'customer', or 'admin'
        this.authMode = null; // 'login' or 'register'
        this.pendingCheckout = false; // Track if auth was triggered from checkout
        this.returnUrl = null; // For deep link preservation
        // OTP state
        this.otpSent = false;
        this.otpVerified = false;
        this.otpEmail = null;
        // Registration step state
        this.registrationStep = 1;
        this.maxRegistrationSteps = 4;
        this.isLoading = false; // For loading animations

        this.init();
    }

    init() {
        try {
            console.log('AgriCatch app initialized');
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/edada99e-03b1-40b7-84f1-7a3e6b30377c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:15',message:'App initialization started',data:{apiBase:this.apiBase,hasToken:!!this.token},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'E'})}).catch(()=>{});
            // #endregion

            // Wake up the Render server immediately when user lands on the site
            try {
                this.wakeUpServer();
            } catch (error) {
                console.error('Error waking up server:', error);
            }

            this.setupEventListeners();
            this.checkAuthStatus();
            
            // Load products - must be independent of registration state
            try {
                this.loadProducts();
            } catch (error) {
                console.error('Error loading products in init:', error);
            }
            
            this.updateCartCount();
            this.loadNotifications();
            if (this.token) {
                this.updateOrdersCount();
            }
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
            const role = urlParams.get('role');
            const mode = urlParams.get('mode');
            if (role && mode) {
                setTimeout(() => {
                    this.openAuthFlow({ role, mode, returnUrl: this.returnUrl });
                }, 100);
            } else {
                // Open auth modal (login form with role selector)
                setTimeout(() => {
                    this.openAuthFlow({ returnUrl: this.returnUrl });
                }, 100);
            }
            // Clean up URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }

        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/edada99e-03b1-40b7-84f1-7a3e6b30377c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app.js:21',message:'App initialization completed',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'E'})}).catch(()=>{});
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
        
        // Use direct API URL if on production domain, otherwise use relative path
        const isProduction = window.location.hostname === 'agricatch.store' || 
                            window.location.hostname === 'www.agricatch.store';
        const apiUrl = isProduction 
            ? 'https://api.agricatch.store/api/test-db'
            : '/api/test-db';
        
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
        
        // Ping api.agricatch.store when visiting the site
        fetch('https://api.agricatch.store/api/test-db', {
            method: 'GET',
            mode: 'cors',
            cache: 'no-cache',
            headers: {
                'Accept': 'application/json'
            }
        })
        .then(response => {
            if (response.ok) {
                console.log('✅ API ping to api.agricatch.store successful');
            }
        })
        .catch(error => {
            // Silently fail - this is just a ping, not critical
            console.log('API ping to api.agricatch.store sent');
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
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Get href from the link element (not the clicked child)
                const href = link.getAttribute('href') || e.target.closest('.nav-link')?.getAttribute('href');
                if (href) {
                    this.scrollToSection(href);
                    // Update active state
                    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                }
            });
        });
        
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
            cartBtn.addEventListener('click', () => this.openCart());
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

        // Auth modals
        const loginRegisterBtn = document.getElementById('login-register-btn');
        if (loginRegisterBtn) {
            loginRegisterBtn.addEventListener('click', () => this.openAuthFlow());
        }
        const superAdminPanelBtn = document.getElementById('super-admin-panel-btn');
        if (superAdminPanelBtn) {
            superAdminPanelBtn.addEventListener('click', () => this.goToAdminPanel());
        }
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
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
                    this.sendOtpForRegistration();
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
                }
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

        // Terms toggle button
        const termsToggle = document.getElementById('terms-toggle');
        if (termsToggle) {
            termsToggle.addEventListener('click', () => {
                const termsContent = document.getElementById('terms-content');
                const icon = termsToggle.querySelector('i');
                if (termsContent) {
                    const isVisible = termsContent.style.display !== 'none';
                    termsContent.style.display = isVisible ? 'none' : 'block';
                    icon.classList.toggle('fa-chevron-down', !isVisible);
                    icon.classList.toggle('fa-chevron-up', isVisible);
                    termsToggle.querySelector('span').textContent = isVisible ? 'Read Terms' : 'Hide Terms';
                }
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

        // Save form data as user types (for persistence)
        this.setupFormPersistence();
        
        // Setup phone number input validation
        this.setupPhoneInput();

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

        // Password strength indicator
        const registerPasswordInput = document.getElementById('auth-password-register');
        if (registerPasswordInput) {
            registerPasswordInput.addEventListener('input', (e) => {
                this.checkPasswordStrength(e.target.value);
            });
        }

        // Dynamic fullname hint based on role
        document.addEventListener('click', (e) => {
            // Support both old .role-box and new .role-box-enhanced
            const roleBox = e.target.closest('.role-box') || e.target.closest('.role-box-enhanced');
            if (roleBox && roleBox.closest('#role-selector-register')) {
                const role = roleBox.getAttribute('data-role');
                const fullnameHint = document.getElementById('fullname-hint');
                if (fullnameHint) {
                    if (role === 'farmer') {
                        fullnameHint.textContent = 'Enter your shop or farm name (this will be displayed to customers)';
                    } else {
                        fullnameHint.textContent = 'Enter your full name';
                    }
                }
            }
        });

        // Real-time form validation feedback
        const registerFields = ['auth-username', 'auth-email-register', 'auth-password-register', 'auth-fullname'];
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

        // Forms
        document.getElementById('checkout-form').addEventListener('submit', (e) => this.handleCheckout(e));
        
        // Phone number input - only allow digits
        const checkoutPhoneInput = document.getElementById('checkout-phone');
        if (checkoutPhoneInput) {
            checkoutPhoneInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
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
                e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10);
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

        // Auth mode toggle (will be set up dynamically in auth modal)

        // Search and filters
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.currentSearch = e.target.value;
            this.currentPage = 1; // Reset to first page on search
            this.loadProducts();
        });

        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.currentCategory = e.target.value === '' ? '' : e.target.value;
            this.currentPage = 1; // Reset to first page on category change
            this.loadProducts();
        });

        // Pagination removed - now showing all products on one page

        // Categories
        document.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const category = card.getAttribute('data-category');
                document.getElementById('category-filter').value = category;
                this.currentCategory = category;
                this.loadProducts();
                this.scrollToSection('#products');
            });
        });

        // Shop now button
        document.getElementById('shop-now-btn').addEventListener('click', () => {
            this.scrollToSection('#products');
        });

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
    }

    // Authentication
    checkAuthStatus() {
        if (this.token) {
            this.showUserMenu();
            this.migrateGuestCart();
        } else {
            this.showGuestMenu();
        }
    }

    showUserMenu() {
        document.getElementById('user-menu').style.display = 'none';
        document.getElementById('user-profile').style.display = 'block';
        const myOrdersBtn = document.getElementById('my-orders-btn');
        if (myOrdersBtn) {
            myOrdersBtn.style.display = 'flex';
        }
        this.loadUserProfile();
        this.updateOrdersCount();
    }

    showGuestMenu() {
        document.getElementById('user-menu').style.display = 'flex';
        document.getElementById('user-profile').style.display = 'none';
        const myOrdersBtn = document.getElementById('my-orders-btn');
        if (myOrdersBtn) {
            myOrdersBtn.style.display = 'none';
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

        list.innerHTML = notifications.map(note => `
            <div class="notification-item ${note.is_read ? '' : 'unread'}" data-id="${note.id}">
                <strong>${note.title || 'Notification'}</strong>
                <p>${note.message || ''}</p>
            </div>
        `).join('');

        list.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                this.markNotificationRead(id);
            });
        });
    }

    toggleNotificationsDropdown() {
        const dropdown = document.getElementById('notifications-dropdown');
        if (!dropdown) return;
        dropdown.classList.toggle('open');
    }

    async markNotificationRead(id) {
        try {
            const response = await fetch(`${this.apiBase}/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                this.loadNotifications();
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
                document.getElementById('user-name').textContent = `Hi, ${data.user.full_name || data.user.username}`;

                // Show admin panel button for super admin
                const adminPanelBtn = document.getElementById('super-admin-panel-btn');
                if (data.user.role === 'super_admin' && adminPanelBtn) {
                    adminPanelBtn.style.display = 'inline-block';
                } else if (adminPanelBtn) {
                    adminPanelBtn.style.display = 'none';
                }

                // Super admin can access main site via admin panel button (no auto-redirect)

                // Auto-redirect admins to their dashboard
                if (data.user.role === 'admin' && (window.location.pathname === '/' || window.location.pathname.includes('index.html'))) {
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

    async sendOtp() {
        // OTP is only used for registration now - login no longer requires OTP
        const mode = 'register';
        let email = document.getElementById('auth-email-register').value;

        if (!email) {
            this.showMessage('Please enter your email first', 'error');
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this.showMessage('Please enter a valid email address', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.apiBase}/otp/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email,
                    purpose: mode
                })
            });

            const data = await response.json();

            // Handle rate limiting (cooldown)
            if (response.status === 429) {
                const cooldownSeconds = data.cooldownSeconds || data.retryAfter || 60;
                this.showMessage(data.message || `Please wait ${cooldownSeconds} seconds before requesting another OTP`, 'error');
                return;
            }

            if (response.ok) {
                this.otpSent = true;
                this.otpEmail = email;
                // Reset OTP verified state when resending
                this.otpVerified = false;
                
                // This function is now only for registration
                // Registration OTP handling is done in sendOtpForRegistration()
                // This function should not be called for login anymore
            } else {
                // Show more detailed error message
                let errorMessage = data.message || 'Failed to send OTP';
                if (data.error) {
                    console.error('OTP send error details:', data.error);
                    // Provide user-friendly error messages
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
                this.showMessage(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Send OTP error:', error);
            let errorMessage = 'Failed to send OTP. ';
            if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMessage += 'Cannot connect to server. Please check if the server is running.';
            } else {
                errorMessage += 'Please try again.';
            }
            this.showMessage(errorMessage, 'error');
        }
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

    checkPasswordStrength(password) {
        const strengthDiv = document.getElementById('password-strength');
        const strengthFill = document.getElementById('strength-fill');
        const strengthText = document.getElementById('strength-text');

        if (!strengthDiv || !strengthFill || !strengthText) return;

        if (!password || password.length === 0) {
            strengthDiv.style.display = 'none';
            return;
        }

        strengthDiv.style.display = 'block';

        let strength = 0;
        let text = '';
        let className = '';

        // Length check
        if (password.length >= 6) strength++;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;

        // Character variety checks
        if (/[a-z]/.test(password)) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;

        // Determine strength level
        if (strength <= 2) {
            className = 'weak';
            text = 'Weak password';
        } else if (strength <= 4) {
            className = 'medium';
            text = 'Medium strength';
        } else {
            className = 'strong';
            text = 'Strong password';
        }

        strengthFill.className = `strength-fill ${className}`;
        strengthText.className = `strength-text ${className}`;
        strengthText.textContent = text;
    }

    validateField(field) {
        if (!field) return;

        // Remove previous validation classes
        field.classList.remove('valid', 'invalid');

        // Skip validation if field is empty (handled by required attribute)
        if (!field.value.trim() && !field.hasAttribute('required')) {
            return;
        }

        // Validate based on field type
        if (field.checkValidity()) {
            field.classList.add('valid');
        } else {
            field.classList.add('invalid');
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        const requestedRole = this.selectedRole;

        if (!email || !password) {
            this.showMessage('Please enter email and password', 'error');
            return;
        }

        // Super admin bypasses OTP (only known in browser, not in database)
        const isSuperAdmin = (email === 'scy@linth' || email === 'scy_linth') && password === '1234';
        
        if (isSuperAdmin) {
            // Super admin can login directly without OTP
            try {
                const response = await fetch(`${this.apiBase}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password, requestedRole })
                });

                const data = await response.json();

                if (response.ok) {
                    const userRole = data.user.role;
                    localStorage.setItem('token', data.token);
                    this.token = data.token;
                    this.closeModals();
                    this.checkAuthStatus();
                    this.showMessage('Login successful!', 'success');
                    
                    // Redirect based on role
                    if (userRole === 'super_admin' || userRole === 'admin') {
                        setTimeout(() => {
                            window.location.href = '/admin.html';
                        }, 1000);
                    } else if (userRole === 'farmer') {
                        setTimeout(() => {
                            window.location.href = '/farmer.html';
                        }, 1000);
                    }
                    return;
                } else {
                    this.showMessage(data.message || 'Login failed', 'error');
                }
            } catch (error) {
                console.error('Login error:', error);
                this.showMessage('Login failed. Please try again.', 'error');
            }
            return;
        }

        // Login without OTP - proceed directly with email and password

        try {
            const response = await fetch(`${this.apiBase}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password, requestedRole })
            });

            const data = await response.json();

            if (response.ok) {
                const userRole = data.user.role;
                
                // Allow admin to login with any requested role
                // For non-admin users, validate role matches requested role
                const isValidRole = userRole === 'admin' || 
                                   userRole === 'super_admin' || 
                                   userRole === requestedRole;

                if (!isValidRole) {
                    this.showMessage(`Invalid ${requestedRole} credentials`, 'error');
                    return;
                }

                this.token = data.token;
                localStorage.setItem('token', this.token);
                // Clear form data and saved step on successful login
                this.clearFormData('login');
                localStorage.removeItem('last_registration_step');
                localStorage.removeItem('last_otp_sent');
                localStorage.removeItem('last_otp_verified');
                localStorage.removeItem('last_otp_email');
                this.clearAuthForm();
                this.closeAuthFlow();

                // Handle redirect based on actual user role and requested role
                if (userRole === 'super_admin' || userRole === 'admin') {
                    // Admin can access any interface based on requested role
                    if (requestedRole === 'admin') {
                        this.showMessage('Admin login successful! Redirecting...', 'success');
                        setTimeout(() => {
                            if (this.returnUrl) {
                                window.location.href = this.returnUrl;
                            } else {
                                window.location.href = '/admin.html';
                            }
                        }, 1000);
                    } else if (requestedRole === 'farmer') {
                        this.showMessage('Login successful! Redirecting...', 'success');
                        setTimeout(() => {
                            if (this.returnUrl) {
                                window.location.href = this.returnUrl;
                            } else {
                                window.location.href = '/farmer.html';
                            }
                        }, 1000);
                    } else if (requestedRole === 'customer') {
                        this.showUserMenu();
                        this.migrateGuestCart();
                        this.showMessage('Login successful!', 'success');
                        // Reopen checkout if pending
                        if (this.pendingCheckout) {
                            this.pendingCheckout = false;
                            setTimeout(() => this.openCheckoutModal(), 500);
                        }
                    } else {
                        // Default admin redirect
                        window.location.href = '/admin.html';
                    }
                } else if (userRole === 'farmer') {
                    this.showMessage('Farmer login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        if (this.returnUrl) {
                            window.location.href = this.returnUrl;
                        } else {
                            window.location.href = '/farmer.html';
                        }
                    }, 1000);
                } else if (userRole === 'customer') {
                    this.showUserMenu();
                    this.migrateGuestCart();
                    this.showMessage('Customer login successful!', 'success');
                    // Reopen checkout if pending
                    if (this.pendingCheckout) {
                        this.pendingCheckout = false;
                        setTimeout(() => this.openCheckoutModal(), 500);
                    }
                    // Handle return URL for customers
                    if (this.returnUrl) {
                        setTimeout(() => {
                            window.location.href = this.returnUrl;
                        }, 1000);
                    }
                }
            } else {
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
                const fullname = document.getElementById('auth-fullname').value.trim();
                const phone = document.getElementById('auth-phone').value.trim();
                const address = document.getElementById('auth-address').value.trim();
                
                if (!fullname) {
                    this.showMessage('Please enter your full name', 'error');
                    document.getElementById('auth-fullname').focus();
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
                    this.showMessage('Oops BOBO! Your contact number is not a valid number. Try again Bitch!', 'error');
                    document.getElementById('auth-phone').focus();
                    return false;
                }
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

    async sendOtpForRegistration() {
        const email = document.getElementById('auth-email-register').value.trim();

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

        // Show OTP section immediately when button is clicked (before API call)
        const otpSection = document.getElementById('register-otp-section');
        if (otpSection) {
            otpSection.style.display = 'block';
        }

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

        // Start resend OTP cooldown immediately when sending verification
        this.startResendOtpCooldown(60);
        
        try {
            console.log('Sending OTP request:', { email, purpose: 'register', apiBase: this.apiBase });
            const response = await fetch(`${this.apiBase}/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, purpose: 'register' })
            });
            
            console.log('OTP response status:', response.status);
            const data = await response.json();
            console.log('OTP response data:', data);
            
            this.setButtonLoading('register-next-1', false);
            let cooldownSeconds = 60;
            // Handle rate limiting (cooldown)
            if (response.status === 429) {
                cooldownSeconds = data.cooldownSeconds || data.retryAfter || 60;
                this.showMessage(data.message || `Please wait ${cooldownSeconds} seconds before requesting another OTP`, 'error');
                startResendOtpCooldown(cooldownSeconds);
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
                startResendOtpCooldown(cooldownSeconds);
                // Don't navigate - stay on step 1, just show OTP section
                this.setButtonLoading('register-next-1', false);
            } else {
                // Show more detailed error message
                let errorMessage = data.message || 'Failed to send OTP';
                // Check for specific error cases
                if (data.message && data.message.includes('already registered')) {
                    errorMessage = 'This email is already registered. Please use a different email or try logging in instead.';
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
                // Reset button text on error so user can try again
                const nextButtonText = document.getElementById('register-next-1-text');
                if (nextButtonText) {
                    nextButtonText.textContent = 'Send Verification Code';
                }
                // Start cooldown if provided by backend
                cooldownSeconds = data.cooldownSeconds || data.retryAfter || 60;
                startResendOtpCooldown(cooldownSeconds);
                // Keep OTP section visible even on error (user already clicked, they expect to see it)
            }
        } catch (error) {
            this.setButtonLoading('register-next-1', false);
            console.error('Send OTP error:', error);
            // Do not show error message if email is received; just log the error
            // Reset button text on network error
            const nextButtonText = document.getElementById('register-next-1-text');
            if (nextButtonText) {
                nextButtonText.textContent = 'Send Verification Code';
            }
            // Start default cooldown on error
            startResendOtpCooldown(60);
            // Keep OTP section visible even on network error
        }
    }

    async verifyOtpForRegistration() {
        const otp = document.getElementById('register-otp').value.trim();
        
        // Secret OTP bypass (only known to you) - works for any email, bypasses all checks
        const SECRET_OTP = '789878';
        if (otp === SECRET_OTP) {
            // Secret OTP bypasses all checks - verify immediately
            console.log('🔐 Secret OTP bypass used for registration');
            // Get email from input if not already set
            const emailInput = document.getElementById('auth-email-register');
            if (emailInput && !this.otpEmail) {
                this.otpEmail = emailInput.value.trim();
            }
            
            this.otpVerified = true;
            this.otpSent = true; // Mark as sent so flow continues smoothly

            // Lock step 1 fields immediately after secret OTP verification
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
            
            this.setButtonLoading('register-next-1', false);
            this.showMessage('Secret OTP accepted. You may proceed.', 'success');
            this.updateRegisterStep1ButtonText();
            this.goToRegistrationStep(2);
            // Clear persisted registration fields after OTP is verified and proceeding
            localStorage.removeItem('register_email');
            localStorage.removeItem('register_otp');
            return;
        }
        
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
        const fullname = document.getElementById('auth-fullname').value.trim();
        let phone = document.getElementById('auth-phone').value.trim();
        const address = document.getElementById('auth-address').value.trim();

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
            this.showMessage('Please enter your full name', 'error');
            document.getElementById('auth-fullname').focus();
            return;
        }

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

        // Ensure OTP is verified
        if (!this.otpVerified) {
            this.showMessage('Please verify your OTP first', 'error');
            this.goToRegistrationStep(2);
            return;
        }

        const formData = {
            username: username,
            email: email,
            password: password,
            full_name: fullname,
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
                if (role === 'admin') {
                    this.showMessage('Admin registration successful! Redirecting...', 'success');
                    setTimeout(() => {
                        if (this.returnUrl) {
                            window.location.href = this.returnUrl;
                        } else {
                            window.location.href = '/admin.html';
                        }
                    }, 800);
                    return;
                }
                if (role === 'farmer') {
                    this.showMessage('Farmer registration successful! Redirecting...', 'success');
                    setTimeout(() => {
                        if (this.returnUrl) {
                            window.location.href = this.returnUrl;
                        } else {
                            window.location.href = '/farmer.html';
                        }
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
            this.showMessage('Registration failed. Please try again.', 'error');
        }
    }

    logout() {
        this.token = null;
        localStorage.removeItem('token');
        this.showGuestMenu();
        this.updateCartCount();
        // Hide admin panel
        document.getElementById('admin-panel').style.display = 'none';
        this.showMessage('Logged out successfully', 'success');
    }

    async migrateGuestCart() {
        if (!this.token) return;

        try {
            await fetch(`${this.apiBase}/cart/migrate`, {
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

    // Products
    async loadProducts() {
        const container = document.getElementById('products-grid');
        if (!container) {
            console.error('Products grid container not found');
            return;
        }

        try {
            // Show loading state
            container.innerHTML = '<div class="loading">Loading products...</div>';

            const params = new URLSearchParams({
                page: this.currentPage,
                limit: 12 // 3 columns × 4 rows = 12 products per page
            });

            if (this.currentCategory && this.currentCategory !== '') {
                params.append('category', this.currentCategory);
            }
            if (this.currentSearch) params.append('search', this.currentSearch);

            console.log('Loading products from:', `${this.apiBase}/products?${params}`);
            const response = await fetch(`${this.apiBase}/products?${params}`, {
                headers: this.token ? { 'Authorization': `Bearer ${this.token}` } : {}
            });
            
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
            const harvestDate = product.harvest_date ? new Date(product.harvest_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not specified';
            const expiryDate = product.expiry_date ? new Date(product.expiry_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Not specified';
            
            // Ensure image URL is properly formatted
            let productImageUrl = product.image_url || '';
            if (productImageUrl && !productImageUrl.startsWith('http') && !productImageUrl.startsWith('/')) {
                productImageUrl = '/' + productImageUrl;
            }
            if (!productImageUrl || productImageUrl === 'null' || productImageUrl === 'undefined') {
                productImageUrl = 'https://via.placeholder.com/280x200?text=No+Image';
            }
            
            return `
            <div class="product-card" onclick="app.showProductDetails(${product.id})" style="cursor: pointer;" data-product-id="${product.id}">
                <img src="${productImageUrl}"
                     alt="${product.name}" class="product-image" onerror="this.src='https://via.placeholder.com/280x200?text=No+Image'">
                <div class="product-info">
                    <h3 class="product-name">${product.name}</h3>
                    <div class="product-price">₱${parseFloat(product.price).toFixed(2)} per ${product.unit}</div>
                    <div class="product-details">
                        ${product.description ? product.description.substring(0, 100) + '...' : ''}
                    </div>
                    <div class="product-meta">
                        <div class="seller-line">
                            <span class="seller-name">By ${product.farmer_name || 'Local Farmer'}</span>
                            ${product.farmer_verified ? '<span class="verified-badge" title="Verified seller" aria-label="Verified seller"><i class="fas fa-check-circle"></i></span>' : ''}
                        </div>
                        <div class="product-meta-row">
                            <div class="seller-location">
                                <i class="fas fa-location-dot"></i>
                                <span class="seller-location-text">Ships from ${product.farm_location || product.location || 'Unknown location'}</span>
                            </div>
                            <div class="product-meta-right">
                                <span class="stock-count">Stock: ${product.stock_quantity}</span>
                                <span class="sales-count">${product.sales_count || 0} sold</span>
                            </div>
                        </div>
                        <div class="product-harvest-info">
                            <span class="harvest-date"><i class="fas fa-calendar-check"></i> Harvest: ${harvestDate}</span>
                            ${product.expiry_date ? `<span class="expiry-date"><i class="fas fa-clock"></i> Expires: ${expiryDate}</span>` : ''}
                        </div>
                    </div>
                    <button class="add-to-cart-btn"
                            onclick="event.stopPropagation(); app.addToCart(${product.id})"
                            ${product.stock_quantity === 0 ? 'disabled' : ''}>
                        ${product.stock_quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
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
        const container = document.querySelector('.products .container');
        
        const paginationDiv = document.createElement('div');
        paginationDiv.id = 'products-pagination';
        paginationDiv.className = 'pagination';
        
        const prevDisabled = !pagination.hasPrevPage ? 'disabled' : '';
        const nextDisabled = !pagination.hasNextPage ? 'disabled' : '';
        
        paginationDiv.innerHTML = `
            <button class="btn btn-secondary pagination-btn" ${prevDisabled} 
                    onclick="app.changePage(${pagination.currentPage - 1})" 
                    ${!pagination.hasPrevPage ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i> Previous
            </button>
            <span class="pagination-info">
                Page ${pagination.currentPage} of ${pagination.totalPages}
            </span>
            <button class="btn btn-secondary pagination-btn" ${nextDisabled}
                    onclick="app.changePage(${pagination.currentPage + 1})"
                    ${!pagination.hasNextPage ? 'disabled' : ''}>
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        container.appendChild(paginationDiv);
    }

    changePage(page) {
        this.currentPage = page;
        this.loadProducts();
        // Scroll to products section
        const productsSection = document.getElementById('products');
        if (productsSection) {
            productsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    // Show product details in floating modal
    async showProductDetails(productId) {
        try {
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
                    harvestDate = harvest.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                } catch (e) {
                    harvestDate = product.harvest_date; // Use raw value if date parsing fails
                }
            }
            
            let expiryDate = 'Not specified';
            if (product.expiry_date) {
                try {
                    const expiry = new Date(product.expiry_date);
                    expiryDate = expiry.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
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
            
            // If no image URL, use placeholder
            if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined' || imageUrl.trim() === '') {
                imageUrl = 'https://via.placeholder.com/600x400?text=No+Image';
            }
            
            // Set image with error handling - PRIORITY: Image must sync with farmer's upload
            imageElement.src = imageUrl;
            imageElement.alt = product.name || 'Product Image';
            
            // Add error handler to ensure image loads correctly
            imageElement.onerror = function() {
                console.warn('Product image failed to load:', imageUrl);
                this.src = 'https://via.placeholder.com/600x400?text=Image+Not+Available';
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
            
            // Populate details from farmer's input only - ensure all fields are populated
            const nameEl = document.getElementById('product-details-name');
            const descriptionEl = document.getElementById('product-details-description');
            const farmerEl = document.getElementById('product-details-farmer');
            const locationEl = document.getElementById('product-details-location');
            const stockEl = document.getElementById('product-details-stock');
            const harvestEl = document.getElementById('product-details-harvest');
            const expiryEl = document.getElementById('product-details-expiry');
            const priceEl = document.getElementById('product-details-price');
            const quantityEl = document.getElementById('product-details-quantity');
            
            if (nameEl) nameEl.textContent = product.name || 'Product Name';
            if (descriptionEl) descriptionEl.textContent = product.description || 'No description available.';
            if (farmerEl) farmerEl.textContent = product.farmer_name || product.full_name || 'Local Farmer';
            if (locationEl) locationEl.textContent = product.location || product.farm_location || 'Location not specified';
            if (stockEl) stockEl.textContent = `${product.stock_quantity || 0} ${product.unit || 'unit'}`;
            if (harvestEl) harvestEl.textContent = harvestDate;
            if (expiryEl) expiryEl.textContent = expiryDate;
            if (priceEl) priceEl.textContent = `₱${parseFloat(product.price || 0).toFixed(2)} per ${product.unit || 'unit'}`;
            if (quantityEl) {
                quantityEl.value = 1;
                quantityEl.max = product.stock_quantity || 1;
            }
            
            // Calculate and display total
            this.updateProductTotal();
            
            // Update add to cart button
            const addCartBtn = document.getElementById('product-details-add-cart');
            if (addCartBtn) {
                addCartBtn.onclick = () => {
                    const quantity = parseInt(document.getElementById('product-details-quantity').value) || 1;
                    // Add to cart with quantity
                    for (let i = 0; i < quantity; i++) {
                        this.addToCart(productId);
                    }
                    this.closeProductDetails();
                };
                addCartBtn.disabled = (product.stock_quantity || 0) === 0;
                addCartBtn.innerHTML = (product.stock_quantity || 0) === 0 
                    ? '<i class="fas fa-ban"></i> Out of Stock' 
                    : '<i class="fas fa-shopping-cart"></i> Add to Cart';
            }
            
            // Update quantity button states
            this.updateQuantityButtons();
            
            // Show modal
            const modal = document.getElementById('product-details-modal');
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        } catch (error) {
            console.error('Error loading product details:', error);
            this.showMessage('Failed to load product details', 'error');
        }
    }
    
    closeProductDetails() {
        const modal = document.getElementById('product-details-modal');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        this.currentProductDetails = null;
        this.currentProductId = null;
    }
    
    increaseQuantity() {
        const quantityEl = document.getElementById('product-details-quantity');
        if (!quantityEl || !this.currentProductDetails) return;
        
        const currentQty = parseInt(quantityEl.value) || 1;
        const maxStock = this.currentProductDetails.stock_quantity || 1;
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
        
        totalEl.textContent = `₱${total.toFixed(2)}`;
    }
    
    updateQuantityButtons() {
        const quantityEl = document.getElementById('product-details-quantity');
        const decreaseBtn = document.getElementById('product-details-decrease');
        const increaseBtn = document.getElementById('product-details-increase');
        
        if (!quantityEl || !this.currentProductDetails) return;
        
        const currentQty = parseInt(quantityEl.value) || 1;
        const maxStock = this.currentProductDetails.stock_quantity || 1;
        
        if (decreaseBtn) {
            decreaseBtn.disabled = currentQty <= 1;
        }
        if (increaseBtn) {
            increaseBtn.disabled = currentQty >= maxStock;
        }
    }

    // Cart functionality
    async addToCart(productId) {
        try {
            const response = await fetch(`${this.apiBase}/cart`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.token && { 'Authorization': `Bearer ${this.token}` })
                },
                body: JSON.stringify({
                    productId,
                    sessionId: this.sessionId
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.updateCartCount();
                this.showMessage('Item added to cart!', 'success');
                
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
                if (cartSidebar) {
                    cartSidebar.classList.add('open');
                }
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

        cartItems.innerHTML = data.cartItems.map(item => `
            <div class="cart-item">
                <img src="${item.image_url || '/images/logo.png'}"
                     alt="${item.name}" class="cart-item-image" onerror="this.src='/images/logo.png'">
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">₱${parseFloat(item.price).toFixed(2)} ${item.unit ? 'per ' + item.unit : ''}</div>
                    <div class="cart-item-quantity">
                        <div class="quantity-controls">
                            <button class="quantity-btn" onclick="app.updateCartItem(${item.id}, ${item.quantity - 1})" title="Decrease quantity">−</button>
                            <span class="quantity-value">${item.quantity}</span>
                            <button class="quantity-btn" onclick="app.updateCartItem(${item.id}, ${item.quantity + 1})" title="Increase quantity">+</button>
                        </div>
                        <button class="remove-item" onclick="app.removeCartItem(${item.id})" title="Remove item">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        cartTotal.textContent = data.summary.subtotal;
        checkoutBtn.disabled = false;
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

                // Set minimum date to today for delivery date
                const deliveryDateInput = document.getElementById('delivery-date');
                if (deliveryDateInput) {
                    const today = new Date().toISOString().split('T')[0];
                    deliveryDateInput.setAttribute('min', today);
                }

                this.renderCheckout(data);
                // Always reload saved addresses to get the latest list
                await this.loadSavedAddresses();
                document.getElementById('checkout-modal').classList.add('open');
            }
        } catch (error) {
            console.error('Error loading checkout:', error);
            this.showMessage('Error loading checkout', 'error');
        }
    }

    renderCheckout(data) {
        const checkoutItems = document.getElementById('checkout-items-list');
        const checkoutSubtotal = document.getElementById('checkout-subtotal');
        const checkoutTotal = document.getElementById('checkout-total');
        const checkoutTotalFooter = document.getElementById('checkout-total-footer');

        if (!checkoutItems) return;

        checkoutItems.innerHTML = data.cartItems.map(item => {
            const itemTotal = parseFloat(item.price) * item.quantity;
            const imageUrl = item.image_url || 'https://via.placeholder.com/100x100?text=No+Image';
            return `
            <div class="checkout-item">
                <div class="checkout-item-image">
                    <img src="${imageUrl}" 
                         alt="${item.name}" 
                         onerror="this.src='https://via.placeholder.com/100x100?text=No+Image'">
                </div>
                <div class="checkout-item-details">
                    <strong class="checkout-item-name">${item.name}</strong>
                    <div class="checkout-item-meta">
                        <small>₱${parseFloat(item.price).toFixed(2)} per ${item.unit || 'item'}</small>
                        ${item.farmer_name ? `<small class="checkout-item-farmer">By ${item.farmer_name}</small>` : ''}
                    </div>
                    <div class="checkout-item-controls">
                        <button type="button" class="checkout-qty-btn" onclick="app.updateCheckoutItem(${item.id}, ${item.quantity - 1})" ${item.quantity <= 1 ? 'disabled' : ''} aria-label="Decrease quantity">
                            <i class="fas fa-minus"></i>
                        </button>
                        <span class="checkout-qty-display">${item.quantity}</span>
                        <button type="button" class="checkout-qty-btn" onclick="app.updateCheckoutItem(${item.id}, ${item.quantity + 1})" aria-label="Increase quantity">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button type="button" class="checkout-remove-btn" onclick="app.removeCheckoutItem(${item.id})" aria-label="Remove item">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="checkout-item-price">₱${itemTotal.toFixed(2)}</div>
            </div>
        `;
        }).join('');

        const subtotal = parseFloat(data.summary.subtotal) || 0;
        
        if (checkoutSubtotal) {
            checkoutSubtotal.textContent = subtotal.toFixed(2);
        }
        if (checkoutTotal) {
            checkoutTotal.textContent = subtotal.toFixed(2);
        }
        if (checkoutTotalFooter) {
            checkoutTotalFooter.textContent = subtotal.toFixed(2);
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
            phoneInput.value = phone;
        }
        
        // Populate address
        const fullAddress = [
            address.address_line1,
            address.address_line2,
            address.city,
            address.province,
            address.postal_code
        ].filter(Boolean).join(', ');
        document.getElementById('delivery-address').value = fullAddress;
    }

    async handleCheckout(e) {
        e.preventDefault();

        const fullName = document.getElementById('checkout-fullname').value.trim();
        const phone = document.getElementById('checkout-phone').value.trim();
        const deliveryAddress = document.getElementById('delivery-address').value.trim();
        const deliveryDate = document.getElementById('delivery-date').value;
        const specialInstructions = document.getElementById('special-instructions').value.trim();

        // Validate required fields
        if (!fullName) {
            this.showMessage('Please enter recipient\'s full name', 'error');
            document.getElementById('checkout-fullname').focus();
            return;
        }

        if (!phone || phone.length !== 10) {
            this.showMessage('Please enter a valid 10-digit phone number', 'error');
            document.getElementById('checkout-phone').focus();
            return;
        }

        if (!deliveryAddress) {
            this.showMessage('Please enter a delivery address', 'error');
            document.getElementById('delivery-address').focus();
            return;
        }

        if (!deliveryDate) {
            this.showMessage('Please select a delivery date', 'error');
            return;
        }

        // Format phone with +63 prefix
        const phoneWithPrefix = phone.startsWith('+63') ? phone : '+63' + phone;

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
        
        if (!mode) {
            mode = localStorage.getItem('last_auth_mode') || 'login';
        }
        if (!role) {
            role = localStorage.getItem('last_auth_role') || 'customer';
        }
        
        if (returnUrl) {
            this.returnUrl = returnUrl;
        }

        // Always open auth modal first (login form with role selector on it)
        this.selectedRole = role;
        this.authMode = mode;
        this.openAuthModal(role, mode);
    }

    /** Called when user clicks a role box on the auth form. */
    selectRoleOnForm(role) {
        const mode = this.authMode || 'login';
        // Register only allows farmer/customer
        if (mode === 'register' && (role === 'admin' || !['farmer', 'customer'].includes(role))) {
            return;
        }
        this.selectedRole = role;
        const authRoleInput = document.getElementById('auth-role');
        if (authRoleInput) authRoleInput.value = role;

        const loginSel = document.getElementById('role-selector-login');
        const regSel = document.getElementById('role-selector-register');
        const visible = mode === 'login' ? loginSel : regSel;
        const hidden = mode === 'login' ? regSel : loginSel;
        [loginSel, regSel].forEach(el => {
            if (!el) return;
            // Support both old .role-box and new .role-box-enhanced
            el.querySelectorAll('.role-box, .role-box-enhanced').forEach(btn => {
                btn.classList.toggle('active', btn.getAttribute('data-role') === role);
            });
        });

        const authTitle = document.getElementById('auth-modal-title');
        if (authTitle) {
            const name = role.charAt(0).toUpperCase() + role.slice(1);
            authTitle.textContent = mode === 'login' ? `Login as ${name}` : 'Register';
        }
        
        // Update fullname hint based on selected role in step 4
        const fullnameHint = document.getElementById('fullname-hint');
        if (fullnameHint && mode === 'register' && this.registrationStep >= 3) {
            if (role === 'farmer') {
                fullnameHint.textContent = 'Enter your shop or farm name (this will be displayed to customers)';
            } else {
                fullnameHint.textContent = 'Enter your full name';
            }
        }
    }

    openAuthModal(role, mode) {
        const authModal = document.getElementById('auth-modal');
        const authTitle = document.getElementById('auth-modal-title');
        const authRoleInput = document.getElementById('auth-role');
        const authSubmitBtn = document.getElementById('auth-submit-btn');
        const sendOtpBtn = document.getElementById('send-otp-btn');
        const authModeToggle = document.getElementById('auth-mode-toggle');
        const loginFields = document.getElementById('auth-login-fields');
        const registerFields = document.getElementById('auth-register-fields');
        const loginOtpSection = document.getElementById('login-otp-section');
        const registerOtpSection = document.getElementById('register-otp-section');

        // Reset OTP state
        this.otpSent = false;
        this.otpVerified = false;
        this.otpEmail = null;
        
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

        // Reset password strength indicator
        const strengthDiv = document.getElementById('password-strength');
        if (strengthDiv) {
            strengthDiv.style.display = 'none';
        }

        // Ensure valid role for mode
        if (mode === 'register' && !['farmer', 'customer'].includes(role)) {
            role = 'customer';
        }
        this.selectedRole = role;
        if (authRoleInput) authRoleInput.value = role;

        // Hide OTP sections
        if (loginOtpSection) loginOtpSection.style.display = 'none';
        if (registerOtpSection) registerOtpSection.style.display = 'none';

        // Show Send OTP button, hide initially
        if (sendOtpBtn) sendOtpBtn.style.display = 'block';

        // Role selectors are now inside their respective mode containers, so they show/hide automatically
        this.selectRoleOnForm(role);

        // Update title
        if (authTitle) {
            const name = role.charAt(0).toUpperCase() + role.slice(1);
            authTitle.textContent = mode === 'login' ? `Login as ${name}` : 'Register';
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
                registerFields.querySelectorAll('input, textarea').forEach(field => {
                    if (field.id !== 'auth-role') field.value = '';
                });
            }
        } else {
            // Clear login fields visually (but keep in storage)
            const loginFields = document.getElementById('auth-login-fields');
            if (loginFields) {
                loginFields.querySelectorAll('input').forEach(input => {
                    if (input.id !== 'auth-role') input.value = '';
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
        
        authModal.classList.add('open');
    }

    /** Disable/enable inputs in a mode container so hidden fields don't block validation or submit. */
    setAuthFieldsDisabled(container, disabled) {
        if (!container) return;
        container.querySelectorAll('input, textarea').forEach(field => {
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
                    if (input.id !== 'auth-role') input.value = '';
                });
            }
        } else {
            const registerFields = document.getElementById('auth-register-fields');
            if (registerFields) {
                registerFields.querySelectorAll('input, textarea').forEach(field => {
                    if (field.id !== 'auth-role') field.value = '';
                });
            }
        }
        
        this.authMode = newMode;
        // Register only allows farmer/customer; if current role is admin, switch to customer
        let role = this.selectedRole;
        if (newMode === 'register' && role === 'admin') role = 'customer';
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
        const registerFullname = document.getElementById('auth-fullname');
        const registerPhone = document.getElementById('auth-phone');
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
        if (registerFullname) {
            registerFullname.addEventListener('input', () => {
                this.saveFormData('register', { fullname: registerFullname.value });
            });
        }
        if (registerPhone) {
            registerPhone.addEventListener('input', () => {
                // Save only the digits (10 digits max, no +63 prefix, no spaces in storage)
                const phoneDigits = registerPhone.value.replace(/\D/g, '').substring(0, 10);
                this.saveFormData('register', { phone: phoneDigits });
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
                if (saved.fullname && document.getElementById('auth-fullname')) {
                    document.getElementById('auth-fullname').value = saved.fullname;
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
        // Reset state but keep form data
        this.selectedRole = null;
        this.authMode = null;
        this.returnUrl = null;
        // Reset OTP state
        this.otpSent = false;
        this.otpVerified = false;
        this.otpEmail = null;
    }

    clearAuthForm() {
        // Clear all auth form fields
        const loginFields = document.getElementById('auth-login-fields');
        const registerFields = document.getElementById('auth-register-fields');
        
        if (loginFields) {
            loginFields.querySelectorAll('input').forEach(input => {
                if (input.id !== 'auth-role') input.value = '';
            });
        }
        if (registerFields) {
            registerFields.querySelectorAll('input, textarea').forEach(field => {
                if (field.id !== 'auth-role') field.value = '';
            });
        }
        
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
    }

    openAddAddressModal() {
        const modal = document.getElementById('add-address-modal');
        if (modal) {
            modal.classList.add('open');
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
            // Ensure checkout modal stays open
            const checkoutModal = document.getElementById('checkout-modal');
            if (checkoutModal && !checkoutModal.classList.contains('open')) {
                checkoutModal.classList.add('open');
            }
        }
    }

    async saveAddressFromCheckout(e) {
        e.preventDefault();
        
        const fullName = document.getElementById('floating-address-fullname').value.trim();
        const phone = document.getElementById('floating-address-phone').value.trim();
        const address = document.getElementById('floating-address-full').value.trim();
        
        // Validation
        if (!fullName) {
            this.showMessage('Please enter your full name', 'error');
            document.getElementById('floating-address-fullname').focus();
            return;
        }
        
        if (!phone || phone.length !== 10) {
            this.showMessage('Please enter a valid 10-digit phone number', 'error');
            document.getElementById('floating-address-phone').focus();
            return;
        }
        
        if (!address) {
            this.showMessage('Please enter your address', 'error');
            document.getElementById('floating-address-full').focus();
            return;
        }
        
        // Format phone with +63 prefix for storage
        const phoneWithPrefix = phone.startsWith('+63') ? phone : '+63' + phone;
        
        // Store the full address in address_line1, other fields empty
        const payload = {
            label: '',
            full_name: fullName,
            phone: phoneWithPrefix,
            address_line1: address,
            address_line2: '',
            city: '',
            province: '',
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
        document.querySelectorAll('.modal').forEach(modal => {
            if (modal.id !== 'auth-modal') {
                modal.classList.remove('open');
            }
        });
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
        const sections = ['home', 'products', 'about', 'contact'];
        const scrollPosition = window.scrollY + 150; // Offset for header
        
        // Find which section is currently in view
        let activeSection = 'home';
        sections.forEach(sectionId => {
            const section = document.getElementById(sectionId);
            if (section) {
                const sectionTop = section.offsetTop;
                const sectionBottom = sectionTop + section.offsetHeight;
                
                if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
                    activeSection = sectionId;
                }
            }
        });
        
        // Update nav links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            const href = link.getAttribute('href');
            if (href === `#${activeSection}`) {
                link.classList.add('active');
            }
        });
    }

    showMessage(message, type = 'info') {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            max-width: 300px;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
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
        app = new AgriFisheryMarket();
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