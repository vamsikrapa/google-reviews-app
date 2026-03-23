import { useQuery } from "@tanstack/react-query";
import { getClients, getLocations } from "../lib/api";
import { useNavigate, Link } from "react-router-dom";
import { Users, MapPin, AlertTriangle, Flag, Loader2 } from "lucide-react";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["clients"],
    queryFn: getClients,
  });

  const { data: locations = [], isLoading: loadingLocations } = useQuery({
    queryKey: ["locations"],
    queryFn: getLocations,
  });

  const totalUnreplied = locations.reduce((sum: number, l: any) => sum + (l.unreplied_count || 0), 0);

  if (loadingClients || loadingLocations) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32} /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <Users className="text-blue-600" size={20} />
            <span className="text-sm text-gray-500">Clients</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="text-green-600" size={20} />
            <span className="text-sm text-gray-500">Locations</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{locations.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="text-orange-600" size={20} />
            <span className="text-sm text-gray-500">Unreplied</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalUnreplied}</p>
        </div>
        <Link to="/admin/flagged" className="bg-white rounded-xl border border-red-200 p-5 hover:shadow-md transition">
          <div className="flex items-center gap-3 mb-2">
            <Flag className="text-red-600" size={20} />
            <span className="text-sm text-gray-500">Flagged Reviews</span>
          </div>
          <p className="text-2xl font-bold text-red-600">View All</p>
        </Link>
      </div>

      {/* Clients */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Clients</h2>
      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500">No clients onboarded yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((client: any) => (
            <div key={client.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                {client.avatar_url && <img src={client.avatar_url} alt="" className="w-10 h-10 rounded-full" />}
                <div>
                  <p className="font-medium text-gray-900">{client.name}</p>
                  <p className="text-sm text-gray-500">{client.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-600">{client.location_count} locations</span>
                {client.total_unreplied > 0 && (
                  <span className="text-orange-600 font-medium">{client.total_unreplied} unreplied</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All locations */}
      <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-4">All Locations</h2>
      <div className="space-y-3">
        {locations.map((loc: any) => (
          <div key={loc.id} onClick={() => navigate(`/location/${loc.id}/reviews`)}
            className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md transition flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{loc.business_name}</p>
              <p className="text-sm text-gray-500">{loc.address}</p>
              {loc.owner_name && <p className="text-xs text-gray-400 mt-1">Client: {loc.owner_name}</p>}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">{loc.review_count} reviews</p>
              {loc.unreplied_count > 0 && (
                <p className="text-sm text-orange-600 font-medium">{loc.unreplied_count} unreplied</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
