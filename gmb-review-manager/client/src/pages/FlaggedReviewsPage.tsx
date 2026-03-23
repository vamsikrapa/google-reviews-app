import { useQuery } from "@tanstack/react-query";
import { getFlaggedReviews } from "../lib/api";
import { Link } from "react-router-dom";
import type { Review } from "../lib/types";
import StarRating from "../components/StarRating";
import { ArrowLeft, AlertTriangle, Loader2 } from "lucide-react";

export default function FlaggedReviewsPage() {
  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["flagged-reviews"],
    queryFn: getFlaggedReviews,
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link to="/admin" className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={20} /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flagged Reviews</h1>
          <p className="text-sm text-gray-500">All negative reviews (1-2 stars) across all locations</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <AlertTriangle className="mx-auto text-green-500 mb-4" size={48} />
          <p className="text-gray-500">No flagged reviews right now. Great job!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <Link key={review.id} to={`/location/${review.location_id}/reviews`}
              className="block bg-white rounded-xl border border-red-200 p-5 hover:shadow-md transition">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-semibold text-gray-900">{review.reviewer_name}</span>
                <StarRating rating={review.rating} />
                <span className="text-sm text-gray-500">{new Date(review.posted_at).toLocaleDateString()}</span>
                {review.business_name && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">{review.business_name}</span>
                )}
              </div>
              {review.text && <p className="text-gray-700">{review.text}</p>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
