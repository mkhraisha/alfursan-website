/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SENTRY_DSN?: string;
  readonly SENTRY_AUTH_TOKEN?: string;
}

declare namespace App {
  interface Locals {
    /** Authenticated user email, set by middleware for /admin/** and /dealer/** routes. */
    adminEmail?: string;
    /**
     * RBAC role from user_profiles table.
     * Legacy financing roles: 'owner' | 'manager' | 'staff'
     * DMS roles: 'admin' | 'sales'
     */
    adminRole?: "owner" | "manager" | "staff" | "admin" | "sales";
    /** user_profiles.id for the authenticated dealer user (set on /dealer/** routes). */
    dealerUserId?: string;
  }
}
