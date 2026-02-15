/**
 * Schema Definition Pattern for Unified Entity Editors
 *
 * Provides type-safe schema definitions that drive:
 * - Field rendering (input, textarea, select, etc.)
 * - Validation rules
 * - Transform functions (entity ↔ form data)
 * - MCP Forms integration
 */

import type { FormEntityType } from '@capybara-chat/types';

/**
 * Supported field types for automatic rendering
 */
export type FieldType =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'select'
  | 'multiselect'
  | 'tags'
  | 'number'
  | 'checkbox';

/**
 * Select option for select/multiselect fields
 */
export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Field definition within a schema
 */
export interface FieldDefinition<T = unknown> {
  /** Field type for rendering */
  type: FieldType;
  /** Display label */
  label: string;
  /** Whether field is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Options for select/multiselect fields */
  options?: SelectOption[];
  /** Field-level validation function */
  validate?: (value: T) => string | undefined;
  /** Additional props to pass to the field component */
  props?: Record<string, unknown>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  errors: Record<string, string>;
  isValid: boolean;
}

/**
 * Complete entity schema definition
 */
export interface EntitySchemaDefinition<TEntity, TForm extends object> {
  /** Entity type identifier */
  entityType: FormEntityType;
  /** Field definitions keyed by form field name */
  fields: { [K in keyof TForm]: FieldDefinition<TForm[K]> };
  /** Default values for new entities */
  defaultValues: TForm;
  /** Convert entity to form data */
  toFormData: (entity: TEntity | null) => TForm;
  /** Convert form data to entity (for API) */
  fromFormData: (form: TForm) => Partial<TEntity>;
  /** Validate form data */
  validate?: (form: TForm) => ValidationResult;
  /** Name of the field that holds draft/published status. All entities use 'status'. */
  statusField?: 'status';
}

/**
 * Helper function to define a type-safe entity schema
 */
export function defineEntitySchema<TEntity, TForm extends object>(
  schema: EntitySchemaDefinition<TEntity, TForm>
): EntitySchemaDefinition<TEntity, TForm> {
  return schema;
}

/**
 * Get field names from schema
 */
export function getFieldNames<TForm extends object>(
  schema: EntitySchemaDefinition<unknown, TForm>
): (keyof TForm)[] {
  return Object.keys(schema.fields) as (keyof TForm)[];
}

/**
 * Validate form data using schema
 */
export function validateFormData<TForm extends object>(
  schema: EntitySchemaDefinition<unknown, TForm>,
  form: TForm
): ValidationResult {
  // Use custom validation if provided
  if (schema.validate) {
    return schema.validate(form);
  }

  // Default validation based on field definitions
  const errors: Record<string, string> = {};

  for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
    const value = form[fieldName as keyof TForm];
    const definition = fieldDef as FieldDefinition;

    // Required check
    if (definition.required) {
      if (value === undefined || value === null || value === '') {
        errors[fieldName] = `${definition.label} is required`;
        continue;
      }
    }

    // Field-level validation
    if (definition.validate && value !== undefined && value !== null && value !== '') {
      const error = definition.validate(value);
      if (error) {
        errors[fieldName] = error;
      }
    }
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
  };
}
