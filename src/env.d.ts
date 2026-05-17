/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SENTRY_DSN?: string;
  readonly SENTRY_AUTH_TOKEN?: string;
}

declare namespace App {
  interface Locals {
    /** Authenticated admin user email, set by middleware. Undefined on public routes. */
    adminEmail?: string;
    /** RBAC role from admin_users table. Undefined on public routes. */
    adminRole?: "owner" | "manager" | "staff";
  }
}
