import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { bookingService } from '../services/bookingService.js';
import { chargerService } from '../services/chargerService.js';

const Dashboard = () => {
  const { user } = useAuth();
  const [upcomingBookings, setUpcomingBookings] = useState([]);
  const [myChargers, setMyChargers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsRes, chargersRes] = await Promise.all([
          bookingService.getUpcoming().catch(() => ({ data: { bookings: [] } })),
          (user?.role === 'owner' || user?.role === 'both')
            ? chargerService.getMyChargers().catch(() => ({ data: { chargers: [] } }))
            : Promise.resolve({ data: { chargers: [] } }),
        ]);

        setUpcomingBookings(bookingsRes.data?.bookings || []);
        setMyChargers(chargersRes.data?.chargers || []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
      <p className="text-gray-600 mb-8">Welcome back, {user?.name}!</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upcoming Bookings */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Upcoming Bookings</h2>
          {upcomingBookings.length > 0 ? (
            <div className="space-y-4">
              {upcomingBookings.slice(0, 3).map((booking) => (
                <div key={booking._id} className="border-b pb-4">
                  <Link
                    to={`/chargers/${booking.charger._id}`}
                    className="font-semibold text-primary-600 hover:underline"
                  >
                    {booking.charger.title}
                  </Link>
                  <p className="text-sm text-gray-600">
                    {new Date(booking.startTime).toLocaleDateString()} -{' '}
                    {new Date(booking.endTime).toLocaleDateString()}
                  </p>
                  <p className="text-sm font-semibold">${booking.totalPrice}</p>
                </div>
              ))}
              <Link to="/my-bookings" className="text-primary-600 hover:underline">
                View all bookings →
              </Link>
            </div>
          ) : (
            <p className="text-gray-500">No upcoming bookings</p>
          )}
        </div>

        {/* My Chargers */}
        {(user?.role === 'owner' || user?.role === 'both') && (
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">My Chargers</h2>
            {myChargers.length > 0 ? (
              <div className="space-y-4">
                {myChargers.slice(0, 3).map((charger) => (
                  <div key={charger._id} className="border-b pb-4">
                    <Link
                      to={`/chargers/${charger._id}`}
                      className="font-semibold text-primary-600 hover:underline"
                    >
                      {charger.title}
                    </Link>
                    <p className="text-sm text-gray-600">{charger.location.city}</p>
                    <p className="text-sm font-semibold">${charger.pricePerHour}/hour</p>
                  </div>
                ))}
                <Link to="/my-chargers" className="text-primary-600 hover:underline">
                  View all chargers →
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 mb-4">No chargers listed yet</p>
                <Link to="/create-charger" className="btn btn-primary">
                  List Your Charger
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-8">
        <Link to="/chargers" className="btn btn-primary">
          Browse Chargers
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;

