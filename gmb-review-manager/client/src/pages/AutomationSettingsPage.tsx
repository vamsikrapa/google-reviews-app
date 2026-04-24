import { useState, useEffect, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Zap,
  ShieldCheck,
  Smile,
  Bolt,
  Plus,
  Bell,
  Mail,
  MessageSquare,
  Bot,
  Star,
  AlertOctagon,
  Hexagon,
  Trash2,
  X,
} from "lucide-react";
import api from "../lib/api";
import type {
  AutomationSettings,
  AutoReplyRule,
  PersonaKey,
  PlatformStatus,
  RatingOperator,
  RuleAction,
} from "../lib/types";

const PERSONAS: { key: PersonaKey; title: string; description: string; icon: typeof ShieldCheck }[] = [
  { key: "professional", title: "The Professional", description: "Formal, objective, and solution-oriented. Best for enterprise services.", icon: ShieldCheck },
  { key: "friendly", title: "Friendly Neighbor", description: "Warm, conversational, and enthusiastic. Perfect for retail & hospitality.", icon: Smile },
  { key: "concise", title: "Concise & Direct", description: "Brief, efficient, and gets straight to the point. Ideal for high-volume apps.", icon: Bolt },
];

function operatorLabel(op: RatingOperator) {
  return { eq: "is", gte: "is at least", lte: "is at most", gt: "is greater than", lt: "is less than" }[op];
}

function actionLabel(a: RuleAction) {
  return { auto_reply: "auto-reply", flag: "flag for manual review", notify: "send a notification" }[a];
}

function delayLabel(mins: number) {
  if (mins <= 0) return "immediately";
  if (mins < 60) return `after ${mins} min${mins === 1 ? "" : "s"}`;
  const hrs = mins / 60;
  if (hrs < 24) return `after ${hrs % 1 === 0 ? hrs : hrs.toFixed(1)} hour${hrs === 1 ? "" : "s"}`;
  return `after ${Math.round(hrs / 24)} day${Math.round(hrs / 24) === 1 ? "" : "s"}`;
}

export default function AutomationSettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery<AutomationSettings>({
    queryKey: ["automation-settings"],
    queryFn: async () => (await api.get("/automation/settings")).data,
  });

  const { data: rules = [] } = useQuery<AutoReplyRule[]>({
    queryKey: ["automation-rules"],
    queryFn: async () => (await api.get("/automation/rules")).data,
  });

  const { data: platforms = [] } = useQuery<PlatformStatus[]>({
    queryKey: ["automation-platforms"],
    queryFn: async () => (await api.get("/automation/platforms")).data,
  });

  // Local draft for persona/notification form
  const [draft, setDraft] = useState<AutomationSettings | null>(null);
  useEffect(() => {
    if (settings) setDraft(settings);
  }, [settings]);

  const dirty = draft && settings && JSON.stringify(draft) !== JSON.stringify(settings);

  const saveSettings = useMutation({
    mutationFn: async (payload: AutomationSettings) => (await api.put("/automation/settings", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-settings"] }),
  });

  const toggleRule = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) =>
      (await api.put(`/automation/rules/${id}`, { is_active })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => (await api.delete(`/automation/rules/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-rules"] }),
  });

  const [showRuleModal, setShowRuleModal] = useState(false);

  if (settingsLoading || !draft) {
    return <div className="py-20 text-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-2 text-teal-700 mb-2">
          <Zap size={16} className="fill-current" />
          <span className="text-xs font-semibold uppercase tracking-widest">Automation Engine</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-3">
          Automation Settings
        </h2>
        <p className="text-gray-600 max-w-2xl">
          Manage your AI-driven response strategies, brand voice alignment, and multi-platform
          connectivity from a centralized command center.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* AI Persona */}
        <section className="md:col-span-7 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <Bot size={20} className="text-teal-700" />
              <h3 className="text-lg font-semibold">AI Persona</h3>
            </div>
            <span className="px-2 py-1 bg-teal-50 text-teal-800 rounded text-xs font-semibold">
              Brand Voice
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-6">
            Select the personality profile the AI will adopt when generating review responses.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PERSONAS.map(({ key, title, description, icon: Icon }) => {
              const active = draft.persona === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDraft({ ...draft, persona: key })}
                  className={`relative p-4 rounded-lg border-2 text-left transition-colors ${
                    active
                      ? "border-teal-700 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <Icon size={20} className={active ? "text-teal-700" : "text-gray-400"} />
                    <div
                      className={`h-4 w-4 rounded-full ${
                        active ? "border-4 border-teal-700" : "border-2 border-gray-300"
                      }`}
                    />
                  </div>
                  <h4 className="font-semibold text-sm text-gray-900 mb-1">{title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
                </button>
              );
            })}
            {/* Custom */}
            <button
              type="button"
              onClick={() => setDraft({ ...draft, persona: "custom" })}
              className={`relative p-4 rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center text-center ${
                draft.persona === "custom"
                  ? "border-teal-700 bg-teal-50"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Plus size={20} className="text-gray-400 mb-2" />
              <h4 className="font-semibold text-sm text-gray-500">Custom Voice</h4>
              <p className="text-[10px] text-gray-400">Train AI on your brand guide</p>
            </button>
          </div>

          {draft.persona === "custom" && (
            <div className="mt-6">
              <label className="text-sm font-semibold text-gray-900 block mb-2">
                Custom Voice Prompt
              </label>
              <textarea
                rows={4}
                value={draft.custom_persona_prompt ?? ""}
                onChange={(e) => setDraft({ ...draft, custom_persona_prompt: e.target.value })}
                placeholder="Describe the tone, vocabulary, and style the AI should use…"
                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none text-sm"
              />
            </div>
          )}

          <div className="mt-8">
            <label className="text-sm font-semibold text-gray-900 block mb-2">
              Signature Closure
            </label>
            <input
              type="text"
              value={draft.signature}
              onChange={(e) => setDraft({ ...draft, signature: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-teal-700 focus:ring-1 focus:ring-teal-700 outline-none text-sm"
            />
          </div>
        </section>

        {/* Notifications */}
        <section className="md:col-span-5 bg-white rounded-xl border border-gray-200 shadow-sm p-6 flex flex-col">
          <div className="flex items-center gap-3 mb-6 border-b border-gray-100 pb-4">
            <Bell size={20} className="text-teal-700" />
            <h3 className="text-lg font-semibold">Notifications</h3>
          </div>

          <div className="space-y-6 flex-grow">
            <NotificationRow
              title="Response Confirmation"
              description="Notify when AI replies to a review"
              checked={draft.notify_response_confirmation}
              onChange={(v) => setDraft({ ...draft, notify_response_confirmation: v })}
            />
            <NotificationRow
              title="Negative Sentiment Alert"
              description="Instant alert for reviews below 3 stars"
              checked={draft.notify_negative_sentiment}
              onChange={(v) => setDraft({ ...draft, notify_negative_sentiment: v })}
            />
            <NotificationRow
              title="Daily Digest"
              description="Summary of all automated actions"
              checked={draft.notify_daily_digest}
              onChange={(v) => setDraft({ ...draft, notify_daily_digest: v })}
            />
          </div>

          <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Notification Channel
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, notification_channel: "email" })}
                className={`flex-1 py-2 px-3 rounded border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  draft.notification_channel === "email"
                    ? "border-teal-700 bg-white text-teal-700"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                <Mail size={14} /> Email
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, notification_channel: "slack" })}
                className={`flex-1 py-2 px-3 rounded border text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                  draft.notification_channel === "slack"
                    ? "border-teal-700 bg-white text-teal-700"
                    : "border-gray-200 bg-white text-gray-500"
                }`}
              >
                <MessageSquare size={14} /> Slack
              </button>
            </div>
            {draft.notification_channel === "slack" && (
              <input
                type="url"
                placeholder="Slack webhook URL"
                value={draft.slack_webhook_url ?? ""}
                onChange={(e) => setDraft({ ...draft, slack_webhook_url: e.target.value })}
                className="mt-3 w-full px-3 py-2 rounded border border-gray-200 text-sm focus:border-teal-700 outline-none"
              />
            )}
          </div>
        </section>

        {/* Auto-Reply Rules */}
        <section className="md:col-span-12 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-8 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <Bot size={20} className="text-teal-700" />
              <h3 className="text-lg font-semibold">Auto-Reply Rules</h3>
            </div>
            <button
              type="button"
              onClick={() => setShowRuleModal(true)}
              className="text-teal-700 text-sm font-semibold flex items-center gap-1 hover:underline"
            >
              <Plus size={16} /> Create New Rule
            </button>
          </div>

          <div className="space-y-4">
            {rules.length === 0 && (
              <p className="text-sm text-gray-500 py-8 text-center">
                No rules yet. Click "Create New Rule" to start automating responses.
              </p>
            )}
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onToggle={(v) => toggleRule.mutate({ id: rule.id, is_active: v })}
                onDelete={() => {
                  if (confirm(`Delete rule "${rule.name}"?`)) deleteRule.mutate(rule.id);
                }}
              />
            ))}
          </div>
        </section>

        {/* Connected Platforms */}
        <section className="md:col-span-12 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <Hexagon size={20} className="text-teal-700" />
              <h3 className="text-lg font-semibold">Connected Platforms</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
            {platforms.map((p) => (
              <PlatformCard key={p.id} platform={p} />
            ))}
          </div>
        </section>
      </div>

      {/* Sticky action bar */}
      <div className="mt-12 flex justify-end gap-4 border-t border-gray-200 pt-8">
        <button
          type="button"
          disabled={!dirty || saveSettings.isPending}
          onClick={() => settings && setDraft(settings)}
          className="px-6 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
        >
          Reset Changes
        </button>
        <button
          type="button"
          disabled={!dirty || saveSettings.isPending}
          onClick={() => draft && saveSettings.mutate(draft)}
          className="px-8 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold shadow-lg shadow-teal-700/20 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-40"
        >
          {saveSettings.isPending ? "Saving…" : "Save All Settings"}
        </button>
      </div>

      {showRuleModal && <RuleModal onClose={() => setShowRuleModal(false)} />}
    </div>
  );
}

/* ────────── Sub-components ────────── */

function NotificationRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="text-xs text-gray-600">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${
        checked ? "bg-teal-700" : "bg-gray-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 bg-white border border-gray-300 rounded-full h-5 w-5 transition-transform ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function RuleRow({
  rule,
  onToggle,
  onDelete,
}: {
  rule: AutoReplyRule;
  onToggle: (v: boolean) => void;
  onDelete: () => void;
}) {
  const paused = !rule.is_active;
  const Icon = rule.action === "flag" ? AlertOctagon : rule.rating_value >= 5 ? Star : Smile;

  return (
    <div
      className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg gap-4 ${
        paused ? "bg-white border border-gray-100 opacity-70" : "bg-gray-50"
      }`}
    >
      <div className="flex items-center gap-4 flex-grow">
        <div
          className={`h-10 w-10 rounded-full flex items-center justify-center ${
            rule.action === "flag" ? "bg-red-100 text-red-600" : paused ? "bg-gray-200 text-gray-500" : "bg-teal-100 text-teal-700"
          }`}
        >
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-grow">
          <h4 className="text-sm font-semibold text-gray-900">{rule.name}</h4>
          <p className="text-xs text-gray-600">
            IF rating {operatorLabel(rule.rating_operator)} {rule.rating_value} star{rule.rating_value === 1 ? "" : "s"} THEN {actionLabel(rule.action)} {delayLabel(rule.delay_minutes)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end">
          <span className="text-xs font-semibold text-gray-400">STATUS</span>
          <span className={`text-sm font-semibold ${paused ? "text-gray-400" : "text-teal-700"}`}>
            {paused ? "Paused" : "Active"}
          </span>
        </div>
        <Toggle checked={rule.is_active} onChange={onToggle} />
        <button
          type="button"
          onClick={onDelete}
          className="text-gray-400 hover:text-red-600 p-1"
          aria-label="Delete rule"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

function PlatformCard({ platform }: { platform: PlatformStatus }) {
  const badges = {
    connected: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500", label: "Connected" },
    disconnected: { bg: "bg-gray-100", text: "text-gray-700", dot: "bg-gray-400", label: "Not Connected" },
    action_needed: { bg: "bg-amber-100", text: "text-amber-800", dot: "bg-amber-500", label: "Action Needed" },
    coming_soon: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400", label: "Coming Soon" },
  };
  const b = badges[platform.status];

  return (
    <div className="p-6 hover:bg-gray-50 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold text-sm">{platform.name}</span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.bg} ${b.text}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${b.dot} mr-1.5`} /> {b.label}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-4">{platform.description}</p>
      {platform.status === "connected" && (
        <button className="text-xs font-semibold text-teal-700 hover:underline">Manage Connection</button>
      )}
      {platform.status === "action_needed" && (
        <button className="text-xs font-semibold bg-red-50 text-red-700 px-3 py-1 rounded">
          Reconnect
        </button>
      )}
    </div>
  );
}

function RuleModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [ratingOperator, setRatingOperator] = useState<RatingOperator>("eq");
  const [ratingValue, setRatingValue] = useState(5);
  const [action, setAction] = useState<RuleAction>("auto_reply");
  const [delayMinutes, setDelayMinutes] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post("/automation/rules", {
          name,
          rating_operator: ratingOperator,
          rating_value: ratingValue,
          action,
          delay_minutes: delayMinutes,
          is_active: true,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err?.response?.data?.error || "Failed to create rule");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    create.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create Auto-Reply Rule</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-900 block mb-1">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Perfect Ratings"
              className="w-full px-3 py-2 rounded border border-gray-200 text-sm focus:border-teal-700 outline-none"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-1">IF rating</label>
              <select
                value={ratingOperator}
                onChange={(e) => setRatingOperator(e.target.value as RatingOperator)}
                className="w-full px-3 py-2 rounded border border-gray-200 text-sm outline-none focus:border-teal-700"
              >
                <option value="eq">is exactly</option>
                <option value="gte">is at least</option>
                <option value="lte">is at most</option>
                <option value="gt">is greater than</option>
                <option value="lt">is less than</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-1">Stars</label>
              <select
                value={ratingValue}
                onChange={(e) => setRatingValue(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-gray-200 text-sm outline-none focus:border-teal-700"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-900 block mb-1">THEN</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as RuleAction)}
              className="w-full px-3 py-2 rounded border border-gray-200 text-sm outline-none focus:border-teal-700"
            >
              <option value="auto_reply">Auto-reply with AI draft</option>
              <option value="flag">Flag for manual review</option>
              <option value="notify">Send a notification only</option>
            </select>
          </div>

          {action === "auto_reply" && (
            <div>
              <label className="text-sm font-semibold text-gray-900 block mb-1">
                Delay (minutes)
              </label>
              <input
                type="number"
                min={0}
                max={10080}
                value={delayMinutes}
                onChange={(e) => setDelayMinutes(Number(e.target.value))}
                className="w-full px-3 py-2 rounded border border-gray-200 text-sm focus:border-teal-700 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 0 = immediately. Max 10080 = 1 week.</p>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border border-gray-300 text-sm font-semibold text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-5 py-2 rounded bg-teal-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create Rule"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
