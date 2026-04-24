import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Plus, Edit2, Trash2, GripVertical, Save, X, Settings2, FileText } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const FIELD_TYPES = [
  { value: 'text', label: 'Short Text' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' }
];

function SortableField({ field, onUpdate, onDelete }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-4 mb-3 flex gap-4 items-start ${isDragging ? 'shadow-lg border-amber-500' : 'border-slate-200'}`}
    >
      <div {...attributes} {...listeners} className="mt-2 cursor-grab text-slate-400 hover:text-slate-600">
        <GripVertical className="w-5 h-5" />
      </div>
      
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Field Label"
          value={field.label}
          onChange={(e) => onUpdate(field.id, { label: e.target.value })}
        />
        
        <div className="space-y-1">
          <label className="block text-sm font-medium text-slate-700">Field Type</label>
          <select
            className="w-full h-11 px-3 rounded-md border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none"
            value={field.field_type}
            onChange={(e) => onUpdate(field.id, { field_type: e.target.value })}
          >
            {FIELD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center space-x-2 pt-2 md:col-span-2">
          <input
            type="checkbox"
            id={`req-${field.id}`}
            checked={field.required}
            onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
            className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
          />
          <label htmlFor={`req-${field.id}`} className="text-sm text-slate-700">Required field</label>
        </div>
      </div>

      <button onClick={() => onDelete(field.id)} className="mt-2 text-red-400 hover:text-red-600 p-2">
        <Trash2 className="w-5 h-5" />
      </button>
    </div>
  );
}

export default function Forms() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('form_templates').select('*').order('created_at', { ascending: false });
    if (data) setTemplates(data);
    setIsLoading(false);
  };

  const loadTemplate = async (template: any) => {
    setEditingTemplate(template);
    const { data } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_template_id', template.id)
      .order('sort_order', { ascending: true });
      
    if (data) {
      setFields(data);
    } else {
      setFields([]);
    }
  };

  const handleCreateNew = async () => {
    const name = prompt('Enter new template name:');
    if (!name) return;
    
    const { data, error } = await supabase.from('form_templates').insert({ name }).select().single();
    if (!error && data) {
      fetchTemplates();
      loadTemplate(data);
    }
  };

  const handleAddField = () => {
    const newField = {
      id: crypto.randomUUID(), // Temp ID for new fields
      form_template_id: editingTemplate.id,
      label: 'New Field',
      field_type: 'text',
      required: false,
      sort_order: fields.length,
      config: {},
      isNew: true
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: any) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const deleteField = async (id: string) => {
    const field = fields.find(f => f.id === id);
    if (!field.isNew) {
      await supabase.from('form_fields').delete().eq('id', id);
    }
    setFields(fields.filter(f => f.id !== id));
  };

  const saveTemplate = async () => {
    setIsSaving(true);
    try {
      // Update template name
      await supabase.from('form_templates').update({ name: editingTemplate.name }).eq('id', editingTemplate.id);

      // Save fields
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const payload = {
          form_template_id: editingTemplate.id,
          label: field.label,
          field_type: field.field_type,
          required: field.required,
          sort_order: i,
          config: field.config
        };

        if (field.isNew) {
          await supabase.from('form_fields').insert(payload);
        } else {
          await supabase.from('form_fields').update(payload).eq('id', field.id);
        }
      }
      
      await loadTemplate(editingTemplate); // Reload with fresh DB IDs
      alert('Template saved successfully!');
    } catch (e) {
      console.error(e);
      alert('Failed to save template');
    }
    setIsSaving(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  if (editingTemplate) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center space-x-2 text-slate-500 mb-2 text-sm">
              <button onClick={() => setEditingTemplate(null)} className="hover:text-amber-500">Forms</button>
              <span>/</span>
              <span>Edit Template</span>
            </div>
            <input 
              type="text" 
              value={editingTemplate.name}
              onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
              className="text-3xl font-bold text-slate-800 bg-transparent outline-none border-b border-transparent hover:border-slate-200 focus:border-amber-500 transition-colors px-0 w-full"
            />
          </div>
          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={isSaving} className="flex items-center">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        <Card className="bg-slate-50 border-dashed border-2 border-slate-200">
          <CardContent className="p-6">
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext 
                items={fields.map(f => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {fields.length === 0 ? (
                  <div className="text-center py-12 text-slate-500">
                    <Settings2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                    <p>No fields in this template yet.</p>
                  </div>
                ) : (
                  fields.map(field => (
                    <SortableField 
                      key={field.id} 
                      field={field} 
                      onUpdate={updateField}
                      onDelete={deleteField}
                    />
                  ))
                )}
              </SortableContext>
            </DndContext>

            <Button variant="outline" onClick={handleAddField} className="w-full mt-4 border-dashed py-8 text-slate-500 hover:text-amber-600 hover:border-amber-500 hover:bg-amber-50">
              <Plus className="w-5 h-5 mr-2" />
              Add New Field
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Form Templates</h1>
          <p className="text-slate-500">Create and manage dynamic data entry forms</p>
        </div>
        <Button onClick={handleCreateNew} className="flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Create Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <p className="text-slate-500 col-span-3">Loading templates...</p>
        ) : templates.length === 0 ? (
          <Card className="col-span-3 border-dashed shadow-none">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-slate-500">No form templates found. Create one to get started.</p>
            </CardContent>
          </Card>
        ) : (
          templates.map(template => (
            <Card key={template.id} className="hover:shadow-md transition-shadow cursor-pointer group" onClick={() => loadTemplate(template)}>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg text-slate-800 group-hover:text-amber-600 transition-colors">{template.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">ID: {template.id.substring(0,8)}...</p>
                  </div>
                  <div className="bg-slate-100 p-2 rounded-lg text-slate-500 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors">
                    <Edit2 className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
