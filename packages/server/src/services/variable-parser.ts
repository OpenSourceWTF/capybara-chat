/**
 * Variable Parser
 *
 * Extracts {{variable}} placeholders from prompt template content.
 */

/**
 * Extract variable names from template content.
 * @example extractVariables("Hello {{name}}, your {{role}} is ready") => ["name", "role"]
 */
export function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) ?? [];
  return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

/**
 * Interpolate {{variable}} placeholders in template.
 */
export function interpolate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    return variables[varName] ?? match;
  });
}
