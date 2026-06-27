AGENTS.md AgriCatch AI Project Handbook Version: 1.0 Final

# AI Onboarding

Before starting work:

1. Read AGENTS.md.
2. Follow .windsurfrules.
3. Inspect the repository.
4. Confirm assumptions using the implementation.
5. Begin work.

==============================================================================
PURPOSE
==============================================================================

This document describes the AgriCatch project for AI coding agents.

.windsurfrules defines HOW the AI should behave. AGENTS.md defines WHAT
the project is.

The repository is the source of truth.

==============================================================================
PROJECT OVERVIEW
==============================================================================

AgriCatch is a production-quality agricultural e-commerce platform.

Primary goals: - Connect customers with farmers. - Support available and
pre-order products. - Maintain secure and scalable architecture. -
Preserve maintainability and production readiness.

==============================================================================
TECH STACK
==============================================================================

Frontend - HTML - CSS - JavaScript

Backend - Node.js - Express.js

Database - PostgreSQL (Supabase)

Hosting - Frontend: Vercel - Backend: Render

Storage - Cloudinary

Testing - Browser MCP - Playwright

==============================================================================
PRIMARY USER ROLES
==============================================================================

Customer - Browse - Wishlist - Cart - Checkout - Orders - Reviews -
Messaging

Farmer - Product management - Inventory - Hybrid pre-order - Analytics -
Subscription

Admin - Product approval - Farmer verification - Subscription approval -
User management - Reports

Super Admin - Full administrative access - Platform configuration -
Maintenance mode

==============================================================================
CORE BUSINESS MODULES
==============================================================================

Authentication Authorization Products Categories Cart Wishlist Orders
Hybrid Pre-order Inventory Addresses Messaging Notifications Reviews
Farmer Dashboard Customer Dashboard Admin Dashboard Reports

==============================================================================
PROJECT ARCHITECTURE
==============================================================================

Frontend: Presentation and user interaction.

Backend: Business logic, APIs, authentication, authorization, database
operations.

Database: Persistent storage and integrity.

Business logic should remain centralized.

==============================================================================
HYBRID PRE-ORDER
==============================================================================

The Hybrid Pre-order System is a protected core architecture.

Do not redesign it without explicit approval.

Protect: - reservation workflow - inventory synchronization - preorder
conversion - checkout validation - farmer workflow - admin workflow

==============================================================================
DEVELOPMENT ENVIRONMENT
==============================================================================

Development intentionally differs from production.

Current development behaviors may include:

-   CAPTCHA bypass
-   Email delivery bypass
-   Development OTP modes
-   Feature flag overrides
-   Development-friendly rate limits

Always inspect configuration before assuming defects.

==============================================================================
APPROVAL WORKFLOWS
==============================================================================

Many workflows require approval.

Examples:

-   Farmer verification
-   Product approval
-   Subscription approval

Always inspect approval status before debugging.

==============================================================================
FEATURE FLAGS
==============================================================================

Many system behaviors are controlled by feature flags and platform
settings.

Inspect feature flags before assuming business logic is broken.

==============================================================================
AUTHENTICATION
==============================================================================

Authentication uses JWT.

Authorization is role-based.

Never bypass existing permission boundaries.

Inspect existing users before creating test accounts.

==============================================================================
DATABASE
==============================================================================

Database provider: PostgreSQL (Supabase)

Prefer additive schema changes.

Protect production data.

Preserve backwards compatibility.

==============================================================================
DEPLOYMENT
==============================================================================

Frontend: Vercel

Backend: Render

Storage: Cloudinary

Always consider production compatibility.

==============================================================================
TESTING STRATEGY
==============================================================================

Preferred order:

1.  Browser MCP
2.  Existing automated tests
3.  Playwright
4.  Manual reasoning

==============================================================================
COMMON DEBUGGING CHECKLIST
==============================================================================

Before debugging verify:

-   Configuration
-   Environment variables
-   Feature flags
-   Platform settings
-   User role
-   Account status
-   Approval workflow
-   Browser console
-   Network requests
-   Backend logs

==============================================================================
PROJECT PRINCIPLES
==============================================================================

Prefer: - reuse - maintainability - consistency - backwards
compatibility - production quality

Avoid: - duplicate implementations - unnecessary files - unnecessary
refactors - breaking existing workflows

==============================================================================
AI ONBOARDING
==============================================================================

A new AI agent should understand:

-   project goals
-   architecture
-   user roles
-   core workflows
-   deployment model
-   testing strategy
-   approval workflows
-   hybrid pre-order
-   development environment differences

before implementing significant changes.

==============================================================================
END
==============================================================================

Behavioral instructions belong in .windsurfrules.

Project knowledge belongs in AGENTS.md.
