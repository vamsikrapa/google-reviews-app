import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getLocations, syncLocations } from "../lib/api";
import { useNavigate } from "react-router-dom";
import type { Location } from "../lib/types";
import StarRating from "../components/StarRating";
import { RefreshCw, MapPin, MessageSquare, AlertTriangle, Loader2 } from "lucide-react";

export default function LocationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: locations = [], isLoading } = useQuery<Location[]>({
    queryKey: ["locations"],
    queryFn: getLocations,
  });

  const syncMutation = useMutation({
    mutationFn: syncLocations,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["locations"] }),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Locations</h1>
          <p className="text-gray-500 mt-1">Manage reviews for your Google Business Profile locations</p>
        </div>
        <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {syncMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Sync from Google
        </button>
      </div>

      {locations.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <MapPin className="mx-auto text-gray-400 mb-4" size={48} />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No locations found</h2>
          <p className="text-gray-500 max-w-md mx-auto mb-4">
            Click "Sync from Google" to fetch your Google Business Profile locations. Make sure your Google account has access to at least one business location.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {locations.map((loc) => (
            <div key={loc.id}
              onClick={() => navigate(`/location/${loc.id}/reviews`)}
              className={`bg-white rounded-xl border ${loc.unreplied_count > 0 ? "border-orange-200" : "border-gray-200"} p-5 cursor-pointer hover:shadow-md transition group`}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition">{loc.business_name}</h3>
                {loc.avg_rating > 0 && <StarRating rating={Math.round(loc.avg_rating)} />}
              </div>
              <p className="text-sm text-gray-500 mb-4">{loc.address}</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1 text-gray-600">
                  <MessageSquare size={14} /> {loc.review_count} reviews
                </span>
                {loc.unreplied_count > 0 && (
                  <span className="flex items-center gap-1 text-orange-600 font-medium">
                    <AlertTriangle size={14} /> {loc.unreplied_count} unreplied
                  </span>
                )}
              </div>
              {loc.owner_name && (
                <p className="text-xs text-gray-400 mt-3">Client: {loc.owner_name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
