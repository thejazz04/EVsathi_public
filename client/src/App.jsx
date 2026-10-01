import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import DriverDashboard from './pages/DriverDashboard.jsx';
import OwnerDashboard from './pages/OwnerDashboard.jsx';
import ChargerList from './pages/ChargerList.jsx';
import ChargerDetail from './pages/ChargerDetail.jsx';
import Booking from './pages/Booking.jsx';
import MyBookings from './pages/MyBookings.jsx';
import MyChargers from './pages/MyChargers.jsx';
import CreateCharger from './pages/CreateCharger.jsx';
import EditCharger from './pages/EditCharger.jsx';
import EditSlots from './pages/EditSlots.jsx';
import ManageSlots from './pages/ManageSlots.jsx';
import SlotTimeline from './pages/SlotTimeline.jsx';
import Profile from './pages/Profile.jsx';
import Layout from './components/layout/Layout.jsx';
import Chat from './pages/Chat.jsx';
import Wallet from './pages/Wallet.jsx';
import TransactionHistory from './pages/TransactionHistory.jsx';
import PlanRoute from './pages/PlanRoute.jsx';
import SearchLocation from './pages/SearchLocation.jsx';

import DemandForecast from './pages/DemandForecast.jsx';
import PricingEngine from './pages/PricingEngine.jsx';
import IntelligenceCenter from './pages/IntelligenceCenter.jsx';
import MLOverview from './pages/MLOverview.jsx';

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-evsathi-light">
        <div className="text-sm font-semibold text-evsathi-teal animate-pulse">Loading EVsathi Intelligence Platform...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const DashboardRedirect = () => {
  const { user } = useAuth();
  const userRole = (user?.role || 'driver').toLowerCase();
  const target = ['owner', 'host', 'both', 'admin'].includes(userRole)
    ? '/owner/dashboard'
    : '/driver/dashboard';
  return <Navigate to={target} replace />;
};

const RoleRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-evsathi-light">
        <div className="text-sm font-semibold text-evsathi-teal animate-pulse">Loading EVsathi Intelligence Platform...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = (user.role || 'driver').toLowerCase();
  const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());

  const isAllowed =
    normalizedAllowed.includes(userRole) ||
    userRole === 'both' ||
    userRole === 'admin';

  if (!isAllowed) {
    const fallbackPath = ['owner', 'host', 'both'].includes(userRole)
      ? '/owner/dashboard'
      : '/driver/dashboard';
    return <Navigate to={fallbackPath} replace />;
  }

  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        
        {/* Auth Routes - Single Unified Entry Points */}
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password" element={<ResetPassword />} />
        <Route path="driver/login" element={<Navigate to="/login" replace />} />
        <Route path="driver/register" element={<Navigate to="/register" replace />} />
        <Route path="owner/login" element={<Navigate to="/login" replace />} />
        <Route path="owner/register" element={<Navigate to="/register" replace />} />

        {/* Discovery & Tools */}
        <Route path="chargers" element={<ChargerList />} />
        <Route path="plan-route" element={<PlanRoute />} />
        <Route path="search-location" element={<SearchLocation />} />
        <Route path="chargers/:id" element={<ChargerDetail />} />

        {/* P2P Platform Shortcuts & ML Intelligence Console */}
        {/* ML Overview - COMMENTED OUT for demo */}
        {/* <Route path="ml-overview" element={<MLOverview />} /> */}
        <Route path="demand-forecast" element={<DemandForecast />} />
        <Route path="ml-intelligence" element={<DemandForecast />} />
        <Route path="pricing-engine" element={<Navigate to="/chargers" replace />} />
        <Route path="ai-insights" element={<DemandForecast />} />
        <Route path="intelligence-center" element={<DemandForecast />} />
        <Route path="recommended-charging" element={<DriverDashboard />} />
        <Route path="analytics" element={<OwnerDashboard />} />

        {/* Unified Dashboard Redirection */}
        <Route
          path="dashboard"
          element={
            <PrivateRoute>
              <DashboardRedirect />
            </PrivateRoute>
          }
        />
        <Route
          path="overview"
          element={
            <PrivateRoute>
              <DashboardRedirect />
            </PrivateRoute>
          }
        />
        <Route
          path="admin/dashboard"
          element={
            <PrivateRoute>
              <DashboardRedirect />
            </PrivateRoute>
          }
        />

        {/* Role Dashboards */}
        <Route
          path="driver/dashboard"
          element={
            <RoleRoute allowedRoles={['driver', 'renter', 'both']}>
              <DriverDashboard />
            </RoleRoute>
          }
        />
        <Route
          path="owner/dashboard"
          element={
            <RoleRoute allowedRoles={['owner', 'host', 'both']}>
              <OwnerDashboard />
            </RoleRoute>
          }
        />

        {/* Private Booking & Wallet Routes */}
        <Route
          path="bookings/:id"
          element={
            <PrivateRoute>
              <Booking />
            </PrivateRoute>
          }
        />
        <Route
          path="my-bookings"
          element={
            <RoleRoute allowedRoles={['driver', 'renter', 'both']}>
              <MyBookings />
            </RoleRoute>
          }
        />
        <Route
          path="my-chargers"
          element={
            <RoleRoute allowedRoles={['owner', 'host', 'both']}>
              <MyChargers />
            </RoleRoute>
          }
        />
        <Route
          path="create-charger"
          element={
            <RoleRoute allowedRoles={['owner', 'host', 'both']}>
              <CreateCharger />
            </RoleRoute>
          }
        />
        <Route
          path="chargers/:id/edit"
          element={
            <RoleRoute allowedRoles={['owner', 'host', 'both']}>
              <EditCharger />
            </RoleRoute>
          }
        />
        <Route
          path="chargers/:chargerId/edit-slots"
          element={
            <RoleRoute allowedRoles={['owner', 'host', 'both']}>
              <EditSlots />
            </RoleRoute>
          }
        />
        <Route
          path="chargers/:chargerId/manage-slots"
          element={
            <RoleRoute allowedRoles={['owner', 'host', 'both']}>
              <ManageSlots />
            </RoleRoute>
          }
        />
        <Route
          path="chargers/:chargerId/timeline"
          element={
            <RoleRoute allowedRoles={['owner', 'host', 'both']}>
              <SlotTimeline />
            </RoleRoute>
          }
        />
        <Route
          path="profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />
        <Route
          path="wallet"
          element={
            <PrivateRoute>
              <Wallet />
            </PrivateRoute>
          }
        />
        <Route
          path="wallet/history"
          element={
            <PrivateRoute>
              <TransactionHistory />
            </PrivateRoute>
          }
        />
        <Route
          path="chats/:chatId?"
          element={
            <PrivateRoute>
              <Chat />
            </PrivateRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
