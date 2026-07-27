export const USER_ROLES = ["company", "customer", "driver"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const DEFAULT_USER_ROLE: UserRole = "customer";