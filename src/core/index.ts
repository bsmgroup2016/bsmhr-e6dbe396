/**
 * Shared business-logic surface for ALL clients (web today, Flutter next).
 *
 * Import from `@/core` instead of reaching into individual lib files, so the
 * portable rules stay visible and stable. See ./README.md for the rules.
 */

// Row <-> domain mappers (pure)
export * from "@/lib/db";

// Singapore statutory + operational rules (pure calculators)
export * from "@/lib/sg-payroll";
export * from "@/lib/sg-hours";
export * from "@/lib/sg-leave";
export * from "@/lib/pwm";
export * from "@/lib/mom";
export * from "@/lib/compliance";