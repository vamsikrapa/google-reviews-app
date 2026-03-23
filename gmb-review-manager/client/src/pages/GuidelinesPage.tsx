import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getGuidelines, updateGuidelines } from "../lib/api";
import type { Guidelines } from "../lib/types";
import { ArrowLeft, Save, Loader2, Check } from "lucide-react";

const TONES = ["Friendly & Warm", "Professional & Formal", "Casual & Fun", "Custom"];
const LANGUAGES = [
  { value: "french", label: "French only" },
  { value: "english", label: "English only" },
  { value: "bilingual", label: "Bilingual (match review language)" },
];

export default function GuidelinesPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);

  const [tone, setTone] = useState("Friendly & Warm");
  const [customTone, setCustomTone] = useState("");
  const [language, setLanguage] = useState("bilingual");
  const [brandName, setBrandName] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");

  const { data: guidelines } = useQuery<Guidelines>({
    queryKey: ["guidelines", locationId],
    queryFn: () => getGuidelines(locationId!),
    enabled: !!locationId,
  });

  useEffect(() => {
    if (guidelines) {
      const isCustomTone = !TONES.slice(0, 3).includes(guidelines.tone);
      if (isCustomTone) { setTone("Custom"); setCustomTone(guidelines.tone); }
      else setTone(guidelines.tone);
      setLanguage(guidelines.language);
      setBrandName(guidelines.brand_name);
      setCustomInstructions(guidelines.custom_instructions);
    }
  }, [guidelines]);

  const mutation = useMutation({
    mutationFn: () => updateGuidelines(locationId!, {
      tone: tone === "Custom" ? customTone : tone,
      language,
      brand_name: brandName,
      custom_instructions: customInstructions,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guidelines", locationId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/location/${locationId}/reviews`} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Reply Settings</h1>
          <p className="text-sm text-gray-500">Configure how AI generates replies for this location</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl space-y-6">
        {/* Brand name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant / Brand Name</label>
          <input value={brandName} onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. Le Petit Bistro"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
          <p className="text-xs text-gray-400 mt-1">Injected into AI replies so responses always reference your restaurant by name.</p>
        </div>

        {/* Tone */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reply Tone</label>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map((t) => (
              <button key={t} onClick={() => setTone(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition ${tone === t ? "bg-blue-50 border-blue-300 text-blue-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"}`}>
                {t}
              </button>
            ))}
          </div>
          {tone === "Custom" && (
            <textarea value={customTone} onChange={(e) => setCustomTone(e.target.value)} rows={2}
              placeholder="Describe your desired tone..."
              className="w-full mt-3 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y" />
          )}
        </div>

        {/* Language */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reply Language</label>
          <div className="space-y-2">
            {LANGUAGES.map((l) => (
              <label key={l.value} className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="language" value={l.value} checked={language === l.value}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-700">{l.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Custom instructions */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Custom Instructions</label>
          <textarea value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} rows={4}
            placeholder="e.g. Always mention the terrace. Never mention competitors. Include a seasonal greeting."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y" />
        </div>

        {/* Save */}
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : <Save size={16} />}
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
