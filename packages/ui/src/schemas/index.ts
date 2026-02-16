/**
 * Entity Schemas
 *
 * Export all entity schema definitions for use with EntityView and useEntityForm.
 */

// Schema definition utilities
export {
  defineEntitySchema,
  getFieldNames,
  validateFormData,
  type FieldType,
  type FieldDefinition,
  type SelectOption,
  type ValidationResult,
  type EntitySchemaDefinition,
} from './define-schema';

// Entity schemas
export { promptSchema, type PromptFormData, OUTPUT_TYPE_OPTIONS } from './prompt-schema';
export { documentSchema, type DocumentFormData } from './document-schema';
export { agentDefinitionSchema, type AgentDefinitionFormData } from './agent-definition-schema';
