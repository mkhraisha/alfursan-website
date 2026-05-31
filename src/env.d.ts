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
     * Roles: 'owner' | 'manager' | 'sales'
     */
    adminRole?: "owner" | "manager" | "sales";
    /** user_profiles.id for the authenticated dealer user (set on /dealer/** routes). */
    dealerUserId?: string;
  }
}
