import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_MYSORE_CENTER = [12.3051, 76.6552];

const createCustomIcon = (isSelected, demandMultiplier = 1.0) => {
  const isSurge = demandMultiplier > 1.2;
  const isOffPeak = demandMultiplier < 0.85;

  const pinColor = isSurge ? '#f59e0b' : isOffPeak ? '#059669' : '#10b981';

  const html = `
    <div style="
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${isSelected ? '44px' : '36px'};
      height: ${isSelected ? '44px' : '36px'};
      background-color: ${pinColor};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3);
      transition: all 0.2s ease;
    ">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      ${isSurge ? '<span style="position:absolute;top:-4px;right:-4px;width:12px;height:12px;background:#ef4444;border-radius:50%;border:2px solid white;"></span>' : ''}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-marker',
    iconSize: [isSelected ? 44 : 36, isSelected ? 44 : 36],
    iconAnchor: [isSelected ? 22 : 18, isSelected ? 22 : 18],
    popupAnchor: [0, -20],
  });
};

const createEndpointIcon = (type) => {
  const isStart = type === 'start';
  const bgColor = isStart ? '#10b981' : '#ef4444';

  const iconSvg = isStart
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="7"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>`;

  const html = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      background-color: ${bgColor};
      color: white;
      border: 2.5px solid white;
      border-radius: 50%;
      box-shadow: 0 4px 10px rgba(0,0,0,0.35);
    ">
      ${iconSvg}
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-endpoint-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -16],
  });
};

const ChangeView = ({ center, zoom, routeCoords }) => {
  const map = useMap();
  useEffect(() => {
    if (routeCoords && routeCoords.length > 0) {
      const latLngs = routeCoords.map((c) => [c.lat ?? c[0], c.lng ?? c[1]]);
      const bounds = L.latLngBounds(latLngs);
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        return;
      }
    }
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, routeCoords, map]);
  return null;
};

const Map = ({
  chargers = [],
  center = DEFAULT_MYSORE_CENTER,
  zoom = 12,
  onMarkerClick,
  selectedChargerId,
  routeCoords = [],
  startLocation,
  endLocation,
  corridorRadiusKm,
  showHeatmap = false,
}) => {
  const validCenter =
    Array.isArray(center) && center[0] && center[1]
      ? center
      : center?.lat && center?.lng
      ? [center.lat, center.lng]
      : DEFAULT_MYSORE_CENTER;

  return (
    <div className="w-full h-full rounded-3xl overflow-hidden border border-slate-200 shadow-md relative z-0">
      <MapContainer
        center={validCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ChangeView center={validCenter} zoom={zoom} routeCoords={routeCoords} />

        {/* Route Corridor Polyline */}
        {routeCoords.length > 0 && (
          <Polyline
            positions={routeCoords.map((c) => [c.lat ?? c[0], c.lng ?? c[1]])}
            pathOptions={{ color: '#059669', weight: 5, opacity: 0.85 }}
          />
        )}

        {/* Start Location Marker */}
        {startLocation && startLocation.lat && startLocation.lng && (
          <Marker
            position={[startLocation.lat, startLocation.lng]}
            icon={createEndpointIcon('start')}
          >
            <Popup>
              <div className="p-1 font-semibold text-xs text-slate-800">
                Starting point: {startLocation.label || 'Starting point'}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Destination Location Marker */}
        {endLocation && endLocation.lat && endLocation.lng && (
          <Marker
            position={[endLocation.lat, endLocation.lng]}
            icon={createEndpointIcon('end')}
          >
            <Popup>
              <div className="p-1 font-semibold text-xs text-slate-800">
                Destination: {endLocation.label || 'Destination'}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Station Markers & XGBoost Heat Overlay circles */}
        {chargers.map((charger) => {
          const lat = charger.location?.coordinates?.[1] ?? charger.location?.lat ?? charger.lat;
          const lng = charger.location?.coordinates?.[0] ?? charger.location?.lng ?? charger.lng;

          if (typeof lat !== 'number' || typeof lng !== 'number') return null;

          const isSelected = selectedChargerId === charger._id;
          const demandMultiplier = charger.demandMultiplier || 1.0;

          return (
            <React.Fragment key={charger._id}>
              {/* Optional Heat Overlay Circle */}
              {showHeatmap && (
                <Circle
                  center={[lat, lng]}
                  radius={1200}
                  pathOptions={{
                    color: demandMultiplier > 1.2 ? '#f59e0b' : '#10b981',
                    fillColor: demandMultiplier > 1.2 ? '#f59e0b' : '#10b981',
                    fillOpacity: 0.25,
                    stroke: false,
                  }}
                />
              )}

              <Marker
                position={[lat, lng]}
                icon={createCustomIcon(isSelected, demandMultiplier)}
                eventHandlers={{
                  click: () => onMarkerClick && onMarkerClick(charger._id),
                }}
              >
                <Popup>
                  <div className="p-3 text-xs space-y-1.5 min-w-[190px]">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-slate-900 line-clamp-1">{charger.title || charger.name}</h4>
                      <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded shrink-0">
                        ₹{charger.pricePerHour || 30}/hr
                      </span>
                    </div>

                    <p className="text-slate-500 line-clamp-1">
                      {charger.location?.address || charger.address || 'Mysore'}
                    </p>

                    <div className="pt-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-600">
                        {charger.powerOutput || 7.4} kW • {charger.connectorType || 'Type 2'}
                      </span>
                      <a
                        href={`/chargers/${charger._id}`}
                        className="text-[11px] font-bold text-emerald-600 hover:underline"
                      >
                        View Details →
                      </a>
                    </div>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default Map;
