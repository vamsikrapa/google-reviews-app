import { Outlet, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { MapPin, Shield, LogOut, Flag, Menu, X } from "lucide-react";
import { useState } from "react";

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile header */}
      <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">GMB Review Manager</h1>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-gray-600">
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className={`${sidebarOpen ? "block" : "hidden"} lg:block w-64 bg-white border-r border-gray-200 min-h-screen fixed lg:sticky top-0 z-30`}>
          <div className="p-6">
            <h1 className="text-xl font-bold text-gray-900 hidden lg:block">GMB Review Manager</h1>
            <p className="text-sm text-gray-500 mt-1">Review management</p>
          </div>
          <nav className="px-4 space-y-1">
            <Link to="/" onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${location.pathname === "/" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}>
              <MapPin size={18} /> Locations
            </Link>
            {isAdmin && (
              <>
                <Link to="/admin" onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${location.pathname === "/admin" ? "bg-blue-50 text-blue-700" : "text-gray-700 hover:bg-gray-100"}`}>
                  <Shield size={18} /> Admin Dashboard
                </Link>
                <Link to="/admin/flagged" onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${location.pathname === "/admin/flagged" ? "bg-red-50 text-red-700" : "text-gray-700 hover:bg-gray-100"}`}>
                  <Flag size={18} /> Flagged Reviews
                </Link>
              </>
            )}
          </nav>
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              {user?.avatar_url && <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full" />}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
            </div>
            <button onClick={logout} className="flex items-center gap-2 text-sm text-gray-600 hover:text-red-600 w-full">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && <div className="lg:hidden fixed inset-0 bg-black/30 z-20" onClick={() => setSidebarOpen(false)} />}
    </div>
  );
}
