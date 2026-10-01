import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = { lat: 23.0225, lng: 72.5714 }; // Ahmedabad default

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const MapClickHandler = ({ onLocationSelected }) => {
  useMapEvents({
    click(e) {
      onLocationSelected({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

const MapViewUpdater = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([position.lat, position.lng]);
  }, [map, position]);
  return null;
};

const LocationPicker = ({
  onLocationSelected,
  initialLat = DEFAULT_CENTER.lat,
  initialLng = DEFAULT_CENTER.lng,
  onAddressChange,
  disableManualEntry = false,
  showCoordinatesInfo=true,
}) => {
  const [position, setPosition] = useState({ lat: initialLat, lng: initialLng });
  const [searchAddress, setSearchAddress] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [searchError, setSearchError] = useState('');
  const [manualLat, setManualLat] = useState(initialLat);
  const [manualLng, setManualLng] = useState(initialLng);

  const mapRef = useRef(null);

  useEffect(() => {
    setPosition({ lat: initialLat, lng: initialLng });
    setManualLat(initialLat);
    setManualLng(initialLng);
  }, [initialLat, initialLng]);

  useEffect(() => {
    onLocationSelected?.(position);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLocationUpdate = (coords) => {
    setPosition(coords);
    setManualLat(coords.lat);
    setManualLng(coords.lng);
    onLocationSelected?.(coords);
    setSearchError('');

    if (onAddressChange) {
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data?.display_name) {
            onAddressChange({ displayName: data.display_name, address: data.address || {} });
          }
        })
        .catch(() => {
          /* ignore reverse geocode errors */
        });
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleLocationUpdate({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setSearchError('Unable to get your location.')
    );
  };

  const handleAddressSearch = async () => {
    if (!searchAddress.trim()) return;

    try {
      setSearchError('');
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchAddress
        )}&limit=5`
      );
      const data = await response.json();

      if (!data.length) {
        setSearchError('No addresses found.');
        setAddressSuggestions([]);
        return;
      }
      setAddressSuggestions(data);
    } catch (err) {
      console.error(err);
      setSearchError('Error searching for address.');
    }
  };

  const handleSelectSuggestion = (s) => {
    const next = { lat: parseFloat(s.lat), lng: parseFloat(s.lon) };
    handleLocationUpdate(next);
    onAddressChange?.({ displayName: s.display_name || '', address: s.address || {} });
    setSearchAddress(s.display_name || '');
    setAddressSuggestions([]);
  };

  const handleManualCoordinates = () => {
    const lat = parseFloat(String(manualLat));
    const lng = parseFloat(String(manualLng));
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setSearchError('Enter valid coordinates: lat -90..90, lng -180..180.');
      return;
    }
    handleLocationUpdate({ lat, lng });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h3 className="font-semibold text-blue-900 mb-3">Select Location</h3>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            className="btn bg-blue-600 px-3 py-2 text-sm text-white"
          >
            📍 Use My Location
          </button>
        </div>

        <div className="mb-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="Search address..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleAddressSearch}
              className="btn bg-blue-600 px-3 py-2 text-sm text-white"
            >
              Search
            </button>
          </div>
        </div>

        {addressSuggestions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-lg max-h-48 overflow-y-auto mb-3">
            {addressSuggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSelectSuggestion(s)}
                className="w-full text-left px-3 py-2 hover:bg-blue-100 border-b last:border-b-0"
              >
                <p className="text-sm font-medium text-gray-900">{s.display_name.split(',')[0]}</p>
                <p className="text-xs text-gray-500">{s.display_name.split(',').slice(1).join(',').trim()}</p>
              </button>
            ))}
          </div>
        )}

        {searchError && (
          <div className="bg-red-100 text-red-700 p-2 rounded mb-3 text-sm">{searchError}</div>
        )}

        {!disableManualEntry && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">Or enter coordinates</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="number"
                name="lat"
                step="0.0001"
                value={manualLat}
                min="-90"
                max="90"
                onChange={(e) => setManualLat(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="number"
                name="lng"
                step="0.0001"
                value={manualLng}
                min="-180"
                max="180"
                onChange={(e) => setManualLng(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleManualCoordinates}
                className="btn bg-blue-600 px-3 py-2 text-sm text-white"
              >
                Set
              </button>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p className="font-medium">Current position:</p>
          <p>Latitude: {position.lat.toFixed(4)}</p>
          <p>Longitude: {position.lng.toFixed(4)}</p>
        </div>
      </div>

      <div className="h-72 overflow-hidden rounded-lg border border-gray-200 sm:h-96">
        <MapContainer
          key={`map-${position.lat}-${position.lng}`}
          center={[position.lat, position.lng]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          whenCreated={(map) => {
            mapRef.current = map;
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[position.lat, position.lng]} />
          <MapViewUpdater position={position} />
          <MapClickHandler
            onLocationSelected={({ lat, lng }) => {
              handleLocationUpdate({ lat, lng });
            }}
          />
        </MapContainer>
      </div>

      <p className="text-xs text-gray-500">
        💡 Tip: Click on the map, search an address, or use your current location.
      </p>
    </div>
  );
};

export default LocationPicker;
