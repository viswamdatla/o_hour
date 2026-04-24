import React from 'react';
import { Input } from '../ui/Input';

interface FormField {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  config: any;
}

interface DynamicFormRenderProps {
  fields: FormField[];
  values: Record<string, any>;
  onChange: (fieldId: string, value: any) => void;
  errors: Record<string, string>;
}

export function DynamicFormRender({ fields, values, onChange, errors }: DynamicFormRenderProps) {
  return (
    <div className="space-y-6">
      {fields.map((field) => {
        const value = values[field.id] || '';
        const error = errors[field.id];

        switch (field.field_type) {
          case 'number':
            return (
              <Input
                key={field.id}
                type="number"
                label={field.label + (field.required ? ' *' : '')}
                value={value}
                onChange={(e) => onChange(field.id, e.target.value)}
                error={error}
                placeholder={field.config?.unit ? `Value in ${field.config.unit}` : ''}
              />
            );
          case 'textarea':
            return (
              <div key={field.id} className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {field.label} {field.required && '*'}
                </label>
                <textarea
                  className={`flex w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-slate-900 dark:text-white ${
                    error ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'
                  }`}
                  rows={3}
                  value={value}
                  onChange={(e) => onChange(field.id, e.target.value)}
                />
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            );
          case 'select':
            return (
              <div key={field.id} className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {field.label} {field.required && '*'}
                </label>
                <select
                  className={`flex h-11 w-full rounded-lg border bg-white px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:bg-slate-900 dark:text-white ${
                    error ? 'border-red-500' : 'border-slate-300 dark:border-slate-700'
                  }`}
                  value={value}
                  onChange={(e) => onChange(field.id, e.target.value)}
                >
                  <option value="">Select an option</option>
                  {(field.config?.options || []).map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            );
          case 'checkbox':
            return (
              <div key={field.id} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={`field-${field.id}`}
                  checked={!!value}
                  onChange={(e) => onChange(field.id, e.target.checked)}
                  className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                />
                <label htmlFor={`field-${field.id}`} className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {field.label} {field.required && '*'}
                </label>
                {error && <p className="text-sm text-red-500">{error}</p>}
              </div>
            );
          case 'date':
            return (
              <Input
                key={field.id}
                type="date"
                label={field.label + (field.required ? ' *' : '')}
                value={value}
                onChange={(e) => onChange(field.id, e.target.value)}
                error={error}
              />
            );
          default:
            return (
              <Input
                key={field.id}
                type="text"
                label={field.label + (field.required ? ' *' : '')}
                value={value}
                onChange={(e) => onChange(field.id, e.target.value)}
                error={error}
              />
            );
        }
      })}
    </div>
  );
}
