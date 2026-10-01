import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../utils/imageHelper.js';
import { Zap, MapPin, CheckCircle2, Star, ArrowRight } from 'lucide-react';

const ChargerCard = ({ charger, isSelected, onSelect }) => {
  const navigate = useNavigate();
  const isAvailable = charger?.isAvailable !== false && charger?.isActive !== false;
  const ratingValue = Number(charger?.rating || 0);
  const totalRatings = Number(charger?.totalRatings || 0);
  const hasRating = ratingValue > 0 && totalRatings > 0;
  
  const connectorType = charger?.connectorType || 'CCS2';
  const powerOutput = charger?.powerOutput || 22;
  const price = Number(charger?.pricePerHour ?? charger?.pricePerKwh ?? 0);
  const cityName =
    charger?.location?.city ||
    charger?.location?.address?.split(',')?.[0]?.trim() ||
    'India';

  const hostType = charger?.hostType || (powerOutput > 30 ? 'Business Fast Charger' : 'Home P2P Host');
  
  // Real demand based on actual currentUtilization if available
  const utilization = Number(charger?.currentUtilization || 0);
  const demandLabel = utilization >= 0.75 ? 'High' : utilization >= 0.35 ? 'Moderate' : 'Steady';
  const demandColor =
    demandLabel === 'High'
      ? 'bg-amber-50 text-amber-800 border-amber-200'
      : 'bg-emerald-50 text-emerald-800 border-emerald-200';

  return (
    <div
      className={`group flex h-full min-h-[22rem] cursor-pointer flex-col overflow-hidden rounded-2xl border bg-white shadow-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${
        isSelected
          ? 'border-2 border-emerald-600 ring-2 ring-emerald-500/20'
          : 'border-slate-200 hover:border-emerald-300'
      }`}
      onMouseEnter={onSelect}
      onClick={() => navigate(`/chargers/${charger._id}`)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          navigate(`/chargers/${charger._id}`);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="relative aspect-[16/10] w-full bg-slate-100 overflow-hidden">
        {charger.images?.length ? (
          <img
            src={getImageUrl(charger.images[0])}
            alt={charger.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YwZjlmZiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM2YmI2YjkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5QMlAgQ2hhcmdlcjwvdGV4dD48L3N2Zz4=';
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-400">
            P2P Charging Station
          </div>
        )}

        <div className="absolute left-3 top-3 inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold bg-slate-900/80 text-white backdrop-blur-xs">
          {hostType}
        </div>

        {hasRating ? (
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold bg-white/95 text-slate-900 shadow-xs backdrop-blur-xs">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
            <span>{ratingValue.toFixed(1)}</span>
          </div>
        ) : (
          <div className="absolute right-3 top-3 inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold bg-white/90 text-emerald-800 shadow-xs">
            Verified Station
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between p-4 space-y-3">
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
              {charger.title}
            </h3>
            {charger.distanceKm != null && (
              <span className="shrink-0 text-xs font-semibold text-slate-500">
                {Number(charger.distanceKm).toFixed(1)} km
              </span>
            )}
          </div>

          <p className="truncate text-xs text-slate-500 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{cityName}</span>
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                isAvailable
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {isAvailable ? 'Available now' : 'Busy'}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 border border-slate-200">
              <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
              {powerOutput} kW
            </span>

            <span className="inline-flex rounded-full bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
              {connectorType}
            </span>

            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold border ${demandColor}`}>
              Demand: {demandLabel}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div>
            <span className="text-xl font-extrabold text-slate-900 leading-none">
              ₹{price}
            </span>
            <span className="text-xs text-slate-500 font-medium ml-1">/ hr</span>
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/80 group-hover:bg-emerald-600 group-hover:text-white transition-colors"
          >
            <span>View Station</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChargerCard;
