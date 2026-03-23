import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getReviews, getLocation, syncReviews } from "../lib/api";
import type { Location, ReviewsResponse } from "../lib/types";
import ReviewCard from "../components/ReviewCard";
import { ArrowLeft, RefreshCw, Settings, FileText, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unreplied", label: "Unreplied" },
  { key: "replied", label: "Replied" },
  { key: "flagged", label: "Flagged" },
] as const;

export default function ReviewsPage() {
  const { locationId } = useParams<{ locationId: string }>();
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data: location } = useQuery<Location>({
    queryKey: ["location", locationId],
    queryFn: () => getLocation(locationId!),
    enabled: !!locationId,
  });

  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ["reviews", locationId, filter, page],
    queryFn: () => getReviews(locationId!, filter, page),
    enabled: !!locationId,
  });

  const syncMutation = useMutation({
    mutationFn: () => syncReviews(locationId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reviews", locationId] }),
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{location?.business_name || "Reviews"}</h1>
          {location?.address && <p className="text-sm text-gray-500">{location.address}</p>}
        </div>
        <div className="flex gap-2">
          <Link to={`/location/${locationId}/templates`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
            <FileText size={16} /> Templates
          </Link>
          <Link to={`/location/${locationId}/settings`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm hover:bg-gray-50">
            <Settings size={16} /> Settings
          </Link>
          <button onClick={() => syncMutation.mutate()} disabled={syncMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
            {syncMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-6 w-fit">
        {FILTERS.map((f) => (
          <button key={f.key} onClick={() => { setFilter(f.key); setPage(1); }}
            className={`px-4 py-2 rounded-md text-sm font-medium transition ${filter === f.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      ) : data?.reviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">No reviews found for this filter.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data?.reviews.map((review) => (
            <ReviewCard key={review.id} review={review} locationId={locationId!} businessName={location?.business_name || ""} />
          ))}

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <button onClick={() => setPage(page - 1)} disabled={page === 1}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50">
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="text-sm text-gray-600">Page {data.page} of {data.totalPages}</span>
              <button onClick={() => setPage(page + 1)} disabled={page === data.totalPages}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-50 hover:bg-gray-50">
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
