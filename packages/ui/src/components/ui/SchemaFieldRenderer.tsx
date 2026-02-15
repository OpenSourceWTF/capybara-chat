/**
 * SchemaFieldRenderer - Renders form fields from schema definitions
 * 
 * Provides schema-driven form rendering for entity editors.
 * Supports text, textarea, select, multiselect, tags, markdown, number, and checkbox.
 */

import { cn } from '../../lib/utils';
import { Input } from './Input';
import { Select } from './Select';
import { Switch } from './Switch';
import { Textarea } from './Textarea';
import { MarkdownTextarea } from './MarkdownTextarea';
import { FormField } from './FormField';
import type { FieldDefinition, FieldType } from '../../schemas/define-schema';

interface SchemaFieldProps {
  fieldKey: string;
  definition: FieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  aiFilled?: boolean;
  className?: string;
}

/**
 * Render a single form field based on schema definition
 */
export function SchemaField({
  fieldKey: _fieldKey,
  definition,
  value,
  onChange,
  disabled = false,
  aiFilled = false,
  className,
}: SchemaFieldProps) {
  // Skip hidden fields
  if (definition.props?.className === 'hidden') {
    return null;
  }

  const baseInputClass = cn(
    'w-full',
    aiFilled && 'field-ai-filled',
    definition.props?.className as string,
    className
  );

  const renderInput = () => {
    switch (definition.type) {
      case 'text':
        return (
          <Input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={definition.placeholder}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={String(value || '')}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={definition.placeholder}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={definition.placeholder}
            disabled={disabled}
            rows={(definition.props?.rows as number) || 4}
            className={cn(
              'resize-y min-h-[100px]',
              baseInputClass
            )}
          />
        );

      case 'markdown':
        return (
          <MarkdownTextarea
            value={String(value || '')}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            placeholder={definition.placeholder}
            aiFilled={aiFilled}
            className={cn('min-h-[200px]', baseInputClass)}
          />
        );

      case 'select':
        return (
          <Select
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={baseInputClass}
          >
            {definition.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        );

      case 'multiselect':
        // Render as terminal-style checkboxes
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="flex flex-wrap gap-2">
            {definition.options?.map((opt) => {
              const isSelected = selectedValues.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  className={cn(
                    'relative flex items-center gap-2 px-3 py-1.5 text-xs font-mono border cursor-pointer transition-all select-none',
                    'rounded-none uppercase tracking-wide',
                    isSelected
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      if (isSelected) {
                        onChange(selectedValues.filter((v) => v !== opt.value));
                      } else {
                        onChange([...selectedValues, opt.value]);
                      }
                    }}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <span className={cn('text-2xs', isSelected ? 'text-primary' : 'text-muted-foreground/30')}>
                    [{isSelected ? 'x' : ' '}]
                  </span>
                  {opt.label}
                </label>
              );
            })}
          </div>
        );

      case 'tags':
        return (
          <Input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={definition.placeholder || 'Comma-separated tags'}
            disabled={disabled}
            className={baseInputClass}
          />
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={Boolean(value)}
              onCheckedChange={(checked) => onChange(checked)}
              disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">
              {definition.placeholder}
            </span>
          </div>
        );

      default:
        return (
          <Input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={definition.placeholder}
            disabled={disabled}
            className={baseInputClass}
          />
        );
    }
  };

  return (
    <FormField
      label={definition.label}
      required={definition.required}
      className={className}
    >
      {renderInput()}
    </FormField>
  );
}

/**
 * Determine field rendering priority/section
 */
export function getFieldSection(fieldKey: string, fieldType: FieldType): 'header' | 'main' | 'details' | 'hidden' {
  // Hidden fields
  if (fieldKey === 'status') return 'hidden';

  // Main content fields (rendered separately by EntityView)
  if (['content', 'systemPrompt'].includes(fieldKey)) return 'main';

  // Title/name fields (rendered separately)
  if (['title', 'name'].includes(fieldKey)) return 'header';

  // Tags (rendered separately)
  if (fieldKey === 'tags') return 'header';

  // Header row selects
  if (fieldType === 'select' && ['model', 'role', 'priority', 'workflowStatus', 'outputType'].includes(fieldKey)) {
    return 'header';
  }

  // Everything else goes to details section
  return 'details';
}
