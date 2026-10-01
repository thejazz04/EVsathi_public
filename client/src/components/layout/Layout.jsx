import React, { useState } from 'react';
import { Outlet, Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  Zap,
  MapPin,
  Calendar,
  Wallet as WalletIcon,
  MessageSquare,
  User,
  LogOut,
  PlusCircle,
  BarChart3,
  Navigation,
  ChevronDown,
  LayoutDashboard,
  ShieldCheck,
  Activity,
  Cpu,
  Sparkles,
  Search,
  Sliders,
  CheckCircle2,
  Building2,
} from 'lucide-react';

import NotificationDropdown from '../notifications/NotificationDropdown.jsx';

const Layout = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null); // 'charging', 'ai', 'network'

  const avatarInitial = (user?.name || user?.email || 'E').trim().charAt(0).toUpperCase();
  const unreadCount = Number(user?.unreadChats || user?.unreadMessages || 0);
  const unreadBadge = unreadCount > 99 ? '99+' : unreadCount;
  
  const userRole = (user?.role || '').toLowerCase();
  const isHost = isAuthenticated && ['owner', 'host', 'both', 'admin'].includes(userRole);
  const isDriver = isAuthenticated && ['driver', 'renter', 'both'].includes(userRole);
  const isBoth = isAuthenticated && (userRole === 'both' || userRole === 'admin');

  const navLinkClass = ({ isActive }) =>
    `inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${isActive
      ? 'bg-evsathi-soft text-evsathi-dark font-extrabold shadow-xs'
      : 'text-evsathi-slate hover:text-evsathi-dark hover:bg-evsathi-soft/40'
    }`;

  const handleLogout = async () => {
    setUserMenuOpen(false);
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-evsathi-light text-evsathi-dark antialiased">
      {/* Top EVsathi Header Navigation */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-evsathi-mint/40 shadow-xs transition-all">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">

            {/* EVsathi Logo */}
            <div className="flex items-center gap-6">
              <Link to="/" className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-2xl bg-evsathi-teal flex items-center justify-center text-white shadow-md shadow-evsathi-teal/30 group-hover:scale-105 transition-transform">
                  <Zap className="w-6 h-6 fill-current" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-extrabold text-evsathi-dark tracking-tight flex items-center gap-1">
                    EVsathi
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-evsathi-teal -mt-1 hidden sm:block">
                    P2P EV Charging Marketplace
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation Structure */}
            <div className="hidden lg:flex items-center gap-1 bg-evsathi-surface p-1.5 rounded-2xl border border-evsathi-soft/80">
              {/* Authenticated Driver View */}
              {isAuthenticated && isDriver && !isBoth && (
                <>
                  <NavLink to="/driver/dashboard" className={navLinkClass}>
                    <LayoutDashboard className="w-4 h-4 text-evsathi-teal" />
                    Overview
                  </NavLink>

                  <NavLink to="/chargers" className={navLinkClass}>
                    <MapPin className="w-4 h-4 text-evsathi-teal" />
                    Find Chargers
                  </NavLink>

                  <NavLink to="/plan-route" className={navLinkClass}>
                    <Navigation className="w-4 h-4 text-evsathi-teal" />
                    Plan Route
                  </NavLink>

                  <NavLink to="/my-bookings" className={navLinkClass}>
                    <Calendar className="w-4 h-4 text-evsathi-teal" />
                    My Bookings
                  </NavLink>
                </>
              )}

              {/* Authenticated Host View */}
              {isAuthenticated && isHost && !isBoth && (
                <>
                  <NavLink to="/owner/dashboard" className={navLinkClass}>
                    <LayoutDashboard className="w-4 h-4 text-evsathi-teal" />
                    Overview
                  </NavLink>

                  <NavLink to="/my-chargers" className={navLinkClass}>
                    <Sliders className="w-4 h-4 text-evsathi-teal" />
                    My Chargers
                  </NavLink>

                  <NavLink to="/create-charger" className={navLinkClass}>
                    <PlusCircle className="w-4 h-4 text-evsathi-teal" />
                    List Charger
                  </NavLink>
                </>
              )}

              {/* Authenticated Both Roles View */}
              {isAuthenticated && isBoth && (
                <>
                  <NavLink to="/driver/dashboard" className={navLinkClass}>
                    <LayoutDashboard className="w-4 h-4 text-evsathi-teal" />
                    Driver Overview
                  </NavLink>

                  <NavLink to="/owner/dashboard" className={navLinkClass}>
                    <Building2 className="w-4 h-4 text-evsathi-teal" />
                    Host Overview
                  </NavLink>

                  <NavLink to="/chargers" className={navLinkClass}>
                    <MapPin className="w-4 h-4 text-evsathi-teal" />
                    Find Chargers
                  </NavLink>

                  <NavLink to="/plan-route" className={navLinkClass}>
                    <Navigation className="w-4 h-4 text-evsathi-teal" />
                    Plan Route
                  </NavLink>

                  <NavLink to="/my-chargers" className={navLinkClass}>
                    <Sliders className="w-4 h-4 text-evsathi-teal" />
                    My Chargers
                  </NavLink>
                </>
              )}

              {/* Public Unauthenticated Marketplace View */}
              {!isAuthenticated && (
                <>
                  <NavLink to="/chargers" className={navLinkClass}>
                    <MapPin className="w-4 h-4 text-evsathi-teal" />
                    Find Chargers
                  </NavLink>

                  <NavLink to="/plan-route" className={navLinkClass}>
                    <Navigation className="w-4 h-4 text-evsathi-teal" />
                    Plan Route
                  </NavLink>

                  <NavLink to="/register" className={navLinkClass}>
                    <PlusCircle className="w-4 h-4 text-evsathi-teal" />
                    List Your Charger
                  </NavLink>
                </>
              )}
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <>
                  <NavLink
                    to="/wallet"
                    className="hidden sm:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-evsathi-surface hover:bg-evsathi-soft/50 text-evsathi-dark font-extrabold text-xs transition-colors border border-evsathi-mint/60"
                  >
                    <WalletIcon className="w-4 h-4 text-evsathi-teal" />
                    <span>₹{user?.walletBalance ?? 0}</span>
                  </NavLink>

                  {/* Host Messenger (non-driver hosts) */}
                  {isHost && !isDriver && (
                    <NavLink
                      to="/chats"
                      className="relative p-2.5 rounded-xl text-evsathi-slate hover:text-evsathi-dark hover:bg-evsathi-soft/40 transition-colors"
                      aria-label="Messenger"
                    >
                      <MessageSquare className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
                          {unreadBadge}
                        </span>
                      )}
                    </NavLink>
                  )}

                  {/* Driver Notification Bell (Position: Wallet -> Notifications -> Profile) */}
                  {isDriver && <NotificationDropdown />}

                  {/* Profile Menu Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-2 p-1 pl-2 rounded-2xl bg-evsathi-surface hover:bg-evsathi-soft/40 transition-colors border border-evsathi-mint/60 focus:outline-none"
                    >
                      <div className="w-8 h-8 rounded-xl bg-evsathi-teal text-white font-bold text-sm flex items-center justify-center shadow-xs">
                        {avatarInitial}
                      </div>
                      <span className="text-sm font-semibold text-evsathi-dark max-w-[100px] truncate hidden md:inline-block">
                        {user?.name?.split(' ')[0] || 'User'}
                      </span>
                      <ChevronDown className="w-4 h-4 text-evsathi-muted mr-1" />
                    </button>

                    {userMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                        <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-evsathi-mint/40 py-2 z-20">
                          <div className="px-4 py-3 border-b border-evsathi-soft/60">
                            <p className="text-xs font-bold text-evsathi-muted uppercase">Signed in as</p>
                            <p className="text-sm font-bold text-evsathi-dark truncate">{user?.name || user?.email}</p>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-evsathi-teal bg-evsathi-light px-2 py-0.5 rounded-md mt-1 border border-evsathi-soft">
                              <ShieldCheck className="w-3 h-3" />
                              Role: {user?.role || 'Driver'}
                            </span>
                          </div>

                          <div className="py-1">
                            {isDriver && (
                              <>
                                <Link to="/driver/dashboard" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-evsathi-dark hover:bg-evsathi-light">
                                  <LayoutDashboard className="w-4 h-4 text-evsathi-teal" /> Overview
                                </Link>
                                <Link to="/my-bookings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-evsathi-dark hover:bg-evsathi-light">
                                  <Calendar className="w-4 h-4 text-evsathi-teal" /> My Bookings
                                </Link>
                              </>
                            )}

                            {isHost && (
                              <>
                                <Link to="/owner/dashboard" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-evsathi-dark hover:bg-evsathi-light">
                                  <Building2 className="w-4 h-4 text-evsathi-teal" /> Host Overview
                                </Link>
                                <Link to="/my-chargers" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-evsathi-dark hover:bg-evsathi-light">
                                  <Sliders className="w-4 h-4 text-evsathi-teal" /> My Chargers
                                </Link>
                              </>
                            )}

                            <Link to="/wallet" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-evsathi-dark hover:bg-evsathi-light sm:hidden">
                              <WalletIcon className="w-4 h-4 text-evsathi-teal" /> Wallet (₹{user?.walletBalance ?? 0})
                            </Link>

                            <Link to="/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-evsathi-dark hover:bg-evsathi-light">
                              <User className="w-4 h-4 text-evsathi-teal" /> Account Settings
                            </Link>
                          </div>

                          <div className="pt-1 border-t border-evsathi-soft/60">
                            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-4 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 text-left">
                              <LogOut className="w-4 h-4" /> Sign Out
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Link to="/login" className="btn btn-secondary px-3.5 py-2 text-xs sm:text-sm">
                    Log In
                  </Link>
                  <Link to="/register" className="btn btn-primary px-3.5 py-2 text-xs sm:text-sm">
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 pb-20 lg:pb-8">
        <Outlet />
      </main>

      {/* Mobile Touch Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-evsathi-mint/40 lg:hidden shadow-lg">
        <div className="grid grid-cols-4 sm:grid-cols-5 h-16">
          <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
            <Zap className="w-5 h-5 mb-0.5" /> Home
          </NavLink>
          {isAuthenticated ? (
            isHost ? (
              <>
                <NavLink to="/my-chargers" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                  <Sliders className="w-5 h-5 mb-0.5" /> Chargers
                </NavLink>
                <NavLink to="/create-charger" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                  <PlusCircle className="w-5 h-5 mb-0.5" /> List
                </NavLink>
                <NavLink to="/chats" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                  <MessageSquare className="w-5 h-5 mb-0.5" /> Chat
                </NavLink>
                <NavLink to="/owner/dashboard" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                  <Building2 className="w-5 h-5 mb-0.5" /> Overview
                </NavLink>
              </>
            ) : (
              <>
                <NavLink to="/chargers" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                  <MapPin className="w-5 h-5 mb-0.5" /> Chargers
                </NavLink>
                <NavLink to="/my-bookings" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                  <Calendar className="w-5 h-5 mb-0.5" /> Bookings
                </NavLink>
                <NavLink to="/chats" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                  <MessageSquare className="w-5 h-5 mb-0.5" /> Chat
                </NavLink>
                <NavLink to="/driver/dashboard" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                  <LayoutDashboard className="w-5 h-5 mb-0.5" /> Overview
                </NavLink>
              </>
            )
          ) : (
            <>
              <NavLink to="/chargers" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                <MapPin className="w-5 h-5 mb-0.5" /> Chargers
              </NavLink>
              <NavLink to="/plan-route" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                <Navigation className="w-5 h-5 mb-0.5" /> Route
              </NavLink>
              <NavLink to="/login" className={({ isActive }) => `flex flex-col items-center justify-center text-[10px] font-semibold ${isActive ? 'text-evsathi-teal' : 'text-evsathi-muted'}`}>
                <User className="w-5 h-5 mb-0.5" /> Sign In
              </NavLink>
            </>
          )}
        </div>
      </div>

      {/* EVsathi Global Footer */}
      <footer className="bg-evsathi-dark text-evsathi-soft py-12 border-t border-evsathi-slate mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-1 space-y-3">
              <div className="flex items-center gap-2 text-white">
                <div className="w-8 h-8 rounded-xl bg-evsathi-teal flex items-center justify-center text-white font-bold">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <span className="text-xl font-bold tracking-tight">EVsathi</span>
              </div>
              <p className="text-sm text-evsathi-soft leading-relaxed">
                Smart AI companion for EV charging. Powered by XGBoost demand prediction and demand-based dynamic pricing.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Smart Charging</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/chargers" className="hover:text-evsathi-mint transition-colors">Find a Charger</Link></li>
                <li><Link to="/my-bookings" className="hover:text-evsathi-mint transition-colors">Charging History</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">AI Intelligence</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/demand-forecast" className="hover:text-evsathi-mint transition-colors">Current Demand Prediction</Link></li>
                <li><Link to="/pricing-engine" className="hover:text-evsathi-mint transition-colors">Dynamic Pricing Engine</Link></li>
                <li><Link to="/intelligence-center" className="hover:text-evsathi-mint transition-colors">EVsathi Intelligence Center</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Network & Support</h4>
              <ul className="space-y-2.5 text-sm">
                <li><Link to="/owner/dashboard" className="hover:text-evsathi-mint transition-colors">Host Dashboard</Link></li>
                <li><Link to="/create-charger" className="hover:text-evsathi-mint transition-colors">List Host Charger</Link></li>
                <li><a href="mailto:support@evsathi.ai" className="hover:text-evsathi-mint transition-colors">support@evsathi.ai</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-evsathi-slate flex flex-col sm:flex-row items-center justify-between text-xs text-evsathi-muted gap-4">
            <p>&copy; {new Date().getFullYear()} EVsathi Platform. All rights reserved.</p>
            <div className="flex gap-6">
              <span>XGBoost Demand Prediction</span>
              <span>Demand-Based Dynamic Pricing</span>
              <span>P2P Grid Optimization</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
