import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { generateReply, postReply, applyTemplate, getTemplates } from "../lib/api";
import type { Review, Template } from "../lib/types";
import StarRating from "./StarRating";
import { Sparkles, Send, FileText, AlertTriangle, Loader2, Check } from "lucide-react";

interface Props {
  review: Review;
  locationId: string;
  businessName: string;
}

export default function ReviewCard({ review, locationId, businessName }: Props) {
  const [draft, setDraft] = useState(review.reply_text || "");
  const [showEditor, setShowEditor] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: () => generateReply(review.id),
    onSuccess: (data) => { setDraft(data.draft); setShowEditor(true); },
  });

  const postMutation = useMutation({
    mutationFn: (text: string) => postReply(review.id, text, "ai"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", locationId] });
      setShowEditor(false);
      setShowConfirm(false);
    },
  });

  const handleApplyTemplate = async (templateId: string) => {
    const result = await applyTemplate(templateId, { reviewer_name: review.reviewer_name, business_name: businessName });
    setDraft(result.text);
    setShowTemplates(false);
    setShowEditor(true);
  };

  const handleOpenTemplates = async () => {
    const t = await getTemplates(locationId);
    setTemplates(t);
    setShowTemplates(true);
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  const isOverdue = !review.reply_text && (Date.now() - new Date(review.posted_at).getTime()) > 48 * 3600000;

  return (
    <div className={`bg-white rounded-xl border ${review.is_flagged ? "border-red-200" : "border-gray-200"} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className="font-semibold text-gray-900">{review.reviewer_name}</span>
            <StarRating rating={review.rating} />
            <span className="text-sm text-gray-500">{timeAgo(review.posted_at)}</span>
            {review.is_flagged && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                <AlertTriangle size={12} /> Negative
              </span>
            )}
            {isOverdue && !review.is_flagged && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Overdue</span>
            )}
            {review.status === "replied" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <Check size={12} /> Replied
              </span>
            )}
          </div>
          {review.text && <p className="text-gray-700 mb-3">{review.text}</p>}
          {review.reply_text && !showEditor && (
            <div className="bg-blue-50 rounded-lg p-3 mt-3">
              <p className="text-sm font-medium text-blue-800 mb-1">Your reply:</p>
              <p className="text-sm text-blue-700">{review.reply_text}</p>
            </div>
          )}
        </div>
      </div>

      {!showEditor && (
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {generateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {review.reply_text ? "Regenerate Reply" : "Generate Reply"}
          </button>
          <button onClick={handleOpenTemplates}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
            <FileText size={16} /> Apply Template
          </button>
          {review.reply_text && (
            <button onClick={() => { setDraft(review.reply_text || ""); setShowEditor(true); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">
              Edit Reply
            </button>
          )}
        </div>
      )}

      {generateMutation.isError && <p className="text-sm text-red-600 mt-2">Failed to generate reply. Please try again.</p>}

      {showTemplates && (
        <div className="mt-4 bg-gray-50 rounded-lg p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">Select a template</h4>
            <button onClick={() => setShowTemplates(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
          </div>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-500">No templates yet. Create one in the Templates tab.</p>
          ) : (
            <div className="space-y-2">
              {templates.map((t) => (
                <button key={t.id} onClick={() => handleApplyTemplate(t.id)}
                  className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-white transition">
                  <p className="font-medium text-sm text-gray-900">{t.name}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">{t.body_text}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showEditor && (
        <div className="mt-4 space-y-3">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5} maxLength={4096}
            className="w-full rounded-lg border border-gray-300 p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
            placeholder="Edit the reply before posting..." />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">{draft.length} / 4096 characters</span>
            <div className="flex gap-2">
              <button onClick={() => setShowEditor(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => setShowConfirm(true)} disabled={!draft.trim() || postMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {postMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Post Reply
              </button>
            </div>
          </div>
          {postMutation.isError && <p className="text-sm text-red-600">Failed to post reply. Your draft has been preserved.</p>}
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Post this reply?</h3>
            <p className="text-sm text-gray-600 mb-4">This will be posted publicly on Google as a reply to {review.reviewer_name}'s review.</p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4"><p className="text-sm text-gray-700">{draft}</p></div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button onClick={() => postMutation.mutate(draft)} disabled={postMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                {postMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Confirm & Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
