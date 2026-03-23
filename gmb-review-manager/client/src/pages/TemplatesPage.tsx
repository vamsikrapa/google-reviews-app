import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from "../lib/api";
import type { Template } from "../lib/types";
import { ArrowLeft, Plus, Trash2, Edit2, Loader2, X } from "lucide-react";

const CATEGORIES = ["Positive 5*", "Positive 4*", "Neutral 3*", "Negative 2*", "Negative 1*", "No comment"];

export default function TemplatesPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [bodyText, setBodyText] = useState("");

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ["templates", locationId],
    queryFn: () => getTemplates(locationId!),
    enabled: !!locationId,
  });

  const createMutation = useMutation({
    mutationFn: () => createTemplate({ location_id: locationId!, name, category, body_text: bodyText }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["templates", locationId] }); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateTemplate(editing!.id, { name, category, body_text: bodyText }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["templates", locationId] }); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates", locationId] }),
  });

  const resetForm = () => { setShowForm(false); setEditing(null); setName(""); setCategory(CATEGORIES[0]); setBodyText(""); };

  const startEdit = (t: Template) => {
    setEditing(t); setName(t.name); setCategory(t.category); setBodyText(t.body_text); setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/location/${locationId}/reviews`} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Reply Templates</h1>
          <p className="text-sm text-gray-500">Save and reuse reply templates with placeholders</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
          <Plus size={16} /> New Template
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">{editing ? "Edit Template" : "New Template"}</h2>
            <button onClick={resetForm}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Warm Thank You"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reply Text</label>
              <textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={5}
                placeholder="Use {reviewer_name}, {business_name}, {month}, {year} as placeholders"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y" />
              <p className="text-xs text-gray-400 mt-1">Available: {"{reviewer_name}"}, {"{business_name}"}, {"{month}"}, {"{year}"}</p>
            </div>
            <button onClick={() => editing ? updateMutation.mutate() : createMutation.mutate()}
              disabled={!name.trim() || !bodyText.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 size={16} className="animate-spin" />}
              {editing ? "Update Template" : "Create Template"}
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No templates yet. Create your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{t.category}</span>
                    <span className="text-xs text-gray-400">Used {t.times_used} times</span>
                  </div>
                  <p className="text-sm text-gray-600">{t.body_text}</p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => startEdit(t)} className="p-2 text-gray-400 hover:text-blue-600"><Edit2 size={16} /></button>
                  <button onClick={() => deleteMutation.mutate(t.id)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
