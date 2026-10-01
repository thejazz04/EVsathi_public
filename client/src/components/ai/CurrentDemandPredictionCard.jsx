import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Sparkles, X } from 'lucide-react';
import Card from '../ui/Card.jsx';
import api from '../../services/api.js';

const getLevel = (value) => {
  if (value == null || Number.isNaN(value)) return null;
  if (value < 0.35) return { label: 'LOW', display: 'Low', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (value < 0.65) return { label: 'MODERATE', display: 'Moderate', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { label: 'HIGH', display: 'High', color: 'text-rose-700 bg-rose-50 border-rose-200' };
};

const getExplanation = (levelLabel) => {
  switch (levelLabel) {
    case 'LOW':
      return 'Low charging activity. High availability is expected.';
    case 'MODERATE':
      return 'Normal charging activity. Steady availability is expected.';
    case 'HIGH':
      return 'Peak charging activity. Higher occupancy and wait times expected.';
    default:
      return 'Demand data unavailable';
  }
};

const formatHour = (h) => {
  const normalized = ((h % 24) + 24) % 24;
  const period = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12}:00 ${period}`;
};

const formatShortHour = (h) => {
  const normalized = ((h % 24) + 24) % 24;
  const period = normalized >= 12 ? 'PM' : 'AM';
  const hour12 = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${hour12}${period}`;
};

const CurrentDemandPredictionCard = ({
  predictionData,
  loading = false,
  error = null,
  chargers = [],
  selectedChargerId = '',
  onSelectCharger = () => {},
}) => {
  const [hourlyPredictions, setHourlyPredictions] = useState(null);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [hourlyError, setHourlyError] = useState(false);

  // Search & Selector State
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const searchContainerRef = useRef(null);

  const selectedCharger = useMemo(() => {
    return chargers.find((c) => c._id === selectedChargerId) || chargers[0] || null;
  }, [chargers, selectedChargerId]);

  // Sync search input with selected charger title
  useEffect(() => {
    if (selectedCharger) {
      setSearchQuery(selectedCharger.title || selectedCharger.name || '');
    }
  }, [selectedCharger]);

  // Close search suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch 24-hour predictions whenever selectedChargerId changes
  useEffect(() => {
    if (!selectedChargerId) return;

    let isMounted = true;
    const fetch24Hour = async () => {
      setHourlyLoading(true);
      setHourlyError(false);
      try {
        const res = await api.get(`/ml/demand/${selectedChargerId}/24hour`);
        if (isMounted) {
          const preds = res.data?.data?.predictions || [];
          if (Array.isArray(preds) && preds.length > 0) {
            setHourlyPredictions(preds);
          } else {
            setHourlyPredictions(null);
            setHourlyError(true);
          }
        }
      } catch (err) {
        if (isMounted) {
          setHourlyPredictions(null);
          setHourlyError(true);
        }
      } finally {
        if (isMounted) {
          setHourlyLoading(false);
        }
      }
    };

    fetch24Hour();
    return () => {
      isMounted = false;
    };
  }, [selectedChargerId]);

  // Filter chargers for search suggestions
  const filteredChargers = useMemo(() => {
    if (!searchQuery.trim()) return chargers;
    const q = searchQuery.toLowerCase().trim();
    return chargers.filter((c) => {
      const title = (c.title || c.name || '').toLowerCase();
      const address = (c.location?.address || c.address || '').toLowerCase();
      const city = (c.location?.city || '').toLowerCase();
      return title.includes(q) || address.includes(q) || city.includes(q);
    });
  }, [chargers, searchQuery]);

  const handleSelectStation = (c) => {
    setSearchQuery(c.title || c.name || '');
    setIsDropdownOpen(false);
    onSelectCharger(c._id);
  };

  // Current Demand Calculation
  const currentDemandVal = predictionData?.demandValue != null ? Number(predictionData.demandValue) : null;
  const currentLevel = getLevel(currentDemandVal);
  const currentOccupancy = currentDemandVal != null ? Math.round(currentDemandVal * 100) : null;
  const currentExplanation = currentLevel ? getExplanation(currentLevel.label) : 'Demand data unavailable';

  // 24-hour calculations: Busiest Period & Recommended Window
  const { busiestWindow, recommendedWindow } = useMemo(() => {
    if (!hourlyPredictions || hourlyPredictions.length < 6) {
      return { busiestWindow: null, recommendedWindow: null };
    }

    const getWindowAvg = (startH) => {
      const subset = hourlyPredictions.filter((p) => p.hour >= startH && p.hour <= startH + 2);
      if (!subset.length) return null;
      return subset.reduce((acc, p) => acc + (Number(p.demandValue) || 0), 0) / subset.length;
    };

    let maxAvg = -Infinity;
    let bestBusyStart = null;
    let minAvg = Infinity;
    let bestLowStart = null;

    for (let h = 6; h <= 20; h++) {
      const avg = getWindowAvg(h);
      if (avg != null) {
        if (avg > maxAvg) {
          maxAvg = avg;
          bestBusyStart = h;
        }
        if (avg < minAvg) {
          minAvg = avg;
          bestLowStart = h;
        }
      }
    }

    const bWindow = bestBusyStart != null ? `${formatHour(bestBusyStart)} – ${formatHour(bestBusyStart + 3)}` : null;
    const rWindow = bestLowStart != null ? `${formatHour(bestLowStart)} – ${formatHour(bestLowStart + 3)}` : null;

    return {
      busiestWindow: bWindow,
      recommendedWindow: rWindow,
    };
  }, [hourlyPredictions]);

  // Graph plotting math
  const chartHeight = 78;
  const chartWidth = 320;
  const paddingLeft = 32;
  const paddingRight = 10;
  const paddingTop = 8;
  const paddingBottom = 18;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const points = useMemo(() => {
    if (!hourlyPredictions || hourlyPredictions.length === 0) return [];
    const sorted = [...hourlyPredictions].sort((a, b) => a.hour - b.hour);
    return sorted.map((p, idx) => {
      const h = Number(p.hour) || idx;
      const x = paddingLeft + (h / 23) * plotWidth;
      const val = Math.max(0, Math.min(1, Number(p.demandValue) || 0));
      const y = paddingTop + plotHeight - val * plotHeight;
      return { x, y, hour: h, val, formattedTime: formatHour(h) };
    });
  }, [hourlyPredictions, plotWidth, plotHeight]);

  // Create smooth bezier curve path
  const { pathD, areaD } = useMemo(() => {
    if (points.length < 2) return { pathD: '', areaD: '' };

    let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }

    const baselineY = paddingTop + plotHeight;
    const firstX = points[0].x.toFixed(1);
    const lastX = points[points.length - 1].x.toFixed(1);
    const area = `${d} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

    return { pathD: d, areaD: area };
  }, [points, plotHeight]);

  const handleGraphMouseMove = (e) => {
    if (!points.length) return;
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const svgX = (mouseX / svgRect.width) * chartWidth;

    let closest = points[0];
    let minDiff = Infinity;
    points.forEach((pt) => {
      const diff = Math.abs(pt.x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = pt;
      }
    });

    setHoveredPoint(closest);
  };

  const now = new Date();
  const currentHourDecimal = now.getHours() + now.getMinutes() / 60;
  const nowX = paddingLeft + (Math.min(23, Math.max(0, currentHourDecimal)) / 23) * plotWidth;

  return (
    <Card className="p-4 bg-white border border-slate-200 shadow-sm space-y-3">
      {/* 1. Header: SMART CHARGING & Title */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-600" />
            Smart Charging
          </span>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
            Expected Station Demand
          </h3>
        </div>
      </div>

      {/* 2. Charger Searchable Selector */}
      <div className="relative" ref={searchContainerRef}>
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsDropdownOpen(true);
            }}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Search charger or location..."
            className="w-full pl-8 pr-8 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs font-semibold text-slate-800 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsDropdownOpen(true);
              }}
              className="absolute right-2.5 p-0.5 text-slate-400 hover:text-slate-600 rounded-md"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {isDropdownOpen && (
          <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white rounded-xl border border-slate-200 shadow-lg z-50 py-1 divide-y divide-slate-100 animate-in fade-in duration-100">
            {filteredChargers.length === 0 ? (
              <div className="px-3.5 py-2.5 text-center text-xs text-slate-400">
                No chargers found
              </div>
            ) : (
              filteredChargers.map((c) => {
                const isSelected = c._id === selectedChargerId;
                return (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => handleSelectStation(c)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-50/50 transition-colors flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-emerald-50/70 font-bold text-emerald-900' : 'text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[11px]">{c.title || c.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {c.location?.address || c.address || 'Mysore'}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium shrink-0">
                      {c.powerOutput || 7.4} kW
                    </span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
          Loading station demand...
        </div>
      ) : error || currentLevel == null ? (
        <div className="py-6 text-center text-xs text-slate-500">
          Demand data unavailable
        </div>
      ) : (
        <div className="space-y-2.5">
          {/* 3. CURRENT DEMAND SUMMARY */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Current Demand
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded border ${currentLevel.color}`}>
                  {currentLevel.label}
                </span>
                <span className="text-xs font-semibold text-slate-600">
                  · ~{currentOccupancy}% occupancy
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-1 font-medium leading-tight">
              &ldquo;{currentExplanation}&rdquo;
            </p>
          </div>

          {/* 4. 24-HOUR DEMAND GRAPH */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-bold text-slate-400 uppercase tracking-wider">
                Today&apos;s Demand Forecast
              </span>
              <span className="text-slate-400 font-semibold">
                LOW — MODERATE — HIGH
              </span>
            </div>

            {hourlyLoading ? (
              <div className="h-20 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                Loading graph...
              </div>
            ) : hourlyError || points.length < 6 ? (
              <div className="h-20 flex items-center justify-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                Demand data unavailable
              </div>
            ) : (
              <div className="relative bg-slate-50/60 border border-slate-100 rounded-lg p-1.5 pt-2">
                <svg
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                  className="w-full h-20 overflow-visible select-none cursor-crosshair"
                  onMouseMove={handleGraphMouseMove}
                  onMouseLeave={() => setHoveredPoint(null)}
                >
                  <defs>
                    <linearGradient id="demandCurveGradCompact" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.30" />
                      <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* High (75%) */}
                  <line
                    x1={paddingLeft}
                    y1={paddingTop + plotHeight * 0.25}
                    x2={chartWidth - paddingRight}
                    y2={paddingTop + plotHeight * 0.25}
                    stroke="#e2e8f0"
                    strokeDasharray="2,2"
                    strokeWidth="0.8"
                  />
                  {/* Med (50%) */}
                  <line
                    x1={paddingLeft}
                    y1={paddingTop + plotHeight * 0.5}
                    x2={chartWidth - paddingRight}
                    y2={paddingTop + plotHeight * 0.5}
                    stroke="#e2e8f0"
                    strokeDasharray="2,2"
                    strokeWidth="0.8"
                  />
                  {/* Baseline (0%) */}
                  <line
                    x1={paddingLeft}
                    y1={paddingTop + plotHeight}
                    x2={chartWidth - paddingRight}
                    y2={paddingTop + plotHeight}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                  />

                  {/* Y-Axis Labels */}
                  <text x={paddingLeft - 5} y={paddingTop + 5} textAnchor="end" fontSize="6.5" fill="#94a3b8" fontWeight="600">
                    High
                  </text>
                  <text x={paddingLeft - 5} y={paddingTop + plotHeight * 0.5 + 2} textAnchor="end" fontSize="6.5" fill="#94a3b8" fontWeight="600">
                    Med
                  </text>
                  <text x={paddingLeft - 5} y={paddingTop + plotHeight} textAnchor="end" fontSize="6.5" fill="#94a3b8" fontWeight="600">
                    Low
                  </text>

                  {/* Area */}
                  {areaD && <path d={areaD} fill="url(#demandCurveGradCompact)" />}

                  {/* Curve Line */}
                  {pathD && (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Vertical 'Now' line */}
                  <line
                    x1={nowX}
                    y1={paddingTop}
                    x2={nowX}
                    y2={paddingTop + plotHeight}
                    stroke="#f87171"
                    strokeDasharray="2,2"
                    strokeWidth="1"
                  />

                  {/* Hover Marker */}
                  {hoveredPoint && (
                    <>
                      <line
                        x1={hoveredPoint.x}
                        y1={paddingTop}
                        x2={hoveredPoint.x}
                        y2={paddingTop + plotHeight}
                        stroke="#0f766e"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                      <circle
                        cx={hoveredPoint.x}
                        cy={hoveredPoint.y}
                        r="3"
                        fill="#059669"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </>
                  )}

                  {/* X-Axis Labels */}
                  {[6, 9, 12, 15, 18, 21].map((h) => {
                    const xPos = paddingLeft + (h / 23) * plotWidth;
                    return (
                      <text
                        key={h}
                        x={xPos}
                        y={chartHeight - 2}
                        textAnchor="middle"
                        fontSize="6.5"
                        fill="#64748b"
                        fontWeight="600"
                      >
                        {formatShortHour(h)}
                      </text>
                    );
                  })}
                </svg>

                {/* Hover Tooltip */}
                {hoveredPoint && (
                  <div
                    className="absolute pointer-events-none bg-slate-900/90 text-white text-[9px] px-2 py-0.5 rounded shadow -translate-x-1/2 -top-1"
                    style={{ left: `${(hoveredPoint.x / chartWidth) * 100}%` }}
                  >
                    <span className="font-bold">{hoveredPoint.formattedTime}:</span>{' '}
                    <span>{Math.round(hoveredPoint.val * 100)}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. BUSIEST PERIOD & RECOMMENDED — ONE COMPACT ROW */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <div className="p-2 rounded-lg bg-amber-50/60 border border-amber-200/60">
              <span className="text-[9px] font-bold text-amber-800 uppercase tracking-wider block">
                Busiest Period
              </span>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {busiestWindow || 'Demand data unavailable'}
              </p>
            </div>

            <div className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/60">
              <span className="text-[9px] font-bold text-emerald-800 uppercase tracking-wider block">
                Recommended
              </span>
              <p className="text-xs font-bold text-slate-900 mt-0.5">
                {recommendedWindow || 'Demand data unavailable'}
              </p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default CurrentDemandPredictionCard;
