/**
 * Zod Utilities
 *
 * Helpers for Zod validation and form data transformation.
 */
import { z } from 'zod';

/**
 * Convert a tags array to a comma-separated string for form display
 *
 * @example tagsToString(['feature', 'urgent']) → 'feature, urgent'
 */
export function tagsToString(tags: string[] | undefined): string {
  return (tags || []).join(', ');
}

/**
 * Parse a comma-separated tag string into an array
 * Handles trimming and removes empty entries
 *
 * @example stringToTags('feature, urgent, ') → ['feature', 'urgent']
 */
export function stringToTags(tagString: string): string[] {
  return tagString.split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Map Zod errors to the Record<string, string> format expected by defineEntitySchema
 */
export function mapZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  // ZodError always has .issues array (Zod v3+)
  error.issues.forEach((issue: z.ZodIssue) => {
    // Path is array of keys, we want the top-level field name usually
    if (issue.path && issue.path.length > 0) {
      const field = issue.path[0].toString();
      errors[field] = issue.message;
    }
  });

  return errors;
}
