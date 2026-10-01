import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, Zap } from 'lucide-react';
import Card from '../ui/Card.jsx';
import Badge from '../ui/Badge.jsx';
import api from '../../services/api.js';

/**
 * 24-Hour Station Demand & Dynamic Rates Chart
 * Shows REAL predicted demand vs realized occupancy throughout the day
 * Uses actual ML predictions from backend
 */
const Demand24HourChart = ({ 
  chargerId, 
  stationName = 'Charging Station',
  date,
  basePrice = 30, // Accept base price as prop to match ChargerDetail calculations
  loading: parentLoading = false 
}) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Fetch 24-hour predictions from ML API
  useEffect(() => {
    if (!chargerId) return;

    const fetch24HourData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const targetDate = date || new Date().toISOString().split('T')[0];
        
        // Fetch ML predictions for all 24 hours
        const predictionRes = await api.get(`/ml/demand/${chargerId}/24hour`, {
          params: { date: targetDate },
          timeout: 30000 // 30 second timeout for this endpoint
        });
        
        const predictions = predictionRes.data?.data?.predictions || [];
        
        // Fetch bookings for this charger on this date to calculate realized occupancy
        const bookingsRes = await api.get(`/bookings`, {
          params: { chargerId }
        });
        
        const allBookings = bookingsRes.data?.data?.bookings || bookingsRes.data?.bookings || [];
        console.log(`📅 Total bookings for charger ${chargerId}:`, allBookings.length);
        
        // Filter bookings for target date
        const dateBookings = allBookings.filter(booking => {
          const bookingDate = new Date(booking.startTime).toISOString().split('T')[0];
          return bookingDate === targetDate;
        });
        
        console.log(`📅 Bookings for ${targetDate}:`, {
          count: dateBookings.length,
          bookings: dateBookings.map(b => ({
            start: new Date(b.startTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            end: new Date(b.endTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            duration: ((new Date(b.endTime) - new Date(b.startTime)) / (1000 * 60)).toFixed(0) + ' min'
          }))
        });
        
        // Calculate realized occupancy per hour and dynamic pricing in IST
        const hours = [];
        // Use prop basePrice to match ChargerDetail calculations
        console.log(`💰 Using base price: ₹${basePrice}/hr for charger ${chargerId}`);
        
        // Generate 24 hours in IST (starting from 00:00 IST)
        for (let istHour = 0; istHour < 24; istHour++) {
          // Convert IST hour to UTC hour for data lookup
          // IST = UTC + 5:30, so UTC = IST - 5:30
          const utcHour = (istHour - 5.5 + 24) % 24;
          const utcHourInt = Math.floor(utcHour);
          
          const istLabel = `${istHour.toString().padStart(2, '0')}:00`;
          
          // Find prediction for the corresponding UTC hour
          const prediction = predictions.find(p => p.hour === utcHourInt);
          const demandValue = prediction?.demandValue; // This is 0-1 range
          const predictedDemand = demandValue != null 
            ? Math.min(100, Math.max(0, demandValue * 100)) 
            : null;
          
          // Calculate dynamic price based on demandValue (0-1) - SAME FORMULA AS ChargerDetail
          let dynamicPrice = basePrice;
          if (demandValue != null) {
            const demandPercent = Math.round(demandValue * 100); // Convert 0-1 to 0-100
            const surgeFactor = 1 + (demandPercent / 100) * 0.5; // 0-50% surge
            dynamicPrice = Math.ceil(basePrice * surgeFactor);
          }
          
          // Calculate realized occupancy for this IST hour
          // Create IST time boundaries for the target date
          const istDateStr = targetDate; // Already in YYYY-MM-DD format
          let occupiedMinutes = 0;
          
          dateBookings.forEach(booking => {
            const bookingStart = new Date(booking.startTime);
            const bookingEnd = new Date(booking.endTime);
            
            // Create hour boundaries in IST using browser's local timezone
            // The browser is assumed to be in IST (Asia/Kolkata)
            const hourStart = new Date(`${istDateStr}T${String(istHour).padStart(2, '0')}:00:00`);
            const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
            
            // Calculate overlap with this IST hour
            const overlapStart = new Date(Math.max(hourStart.getTime(), bookingStart.getTime()));
            const overlapEnd = new Date(Math.min(hourEnd.getTime(), bookingEnd.getTime()));
            
            if (overlapStart < overlapEnd) {
              const minutes = (overlapEnd - overlapStart) / (1000 * 60);
              occupiedMinutes += minutes;
              
              // Debug log for first hour with bookings
              if (istHour === 10 && occupiedMinutes > 0) {
                console.log(`⏰ Hour ${istHour}:00 overlap:`, {
                  hourStart: hourStart.toISOString(),
                  hourEnd: hourEnd.toISOString(),
                  bookingStart: bookingStart.toISOString(),
                  bookingEnd: bookingEnd.toISOString(),
                  overlapMinutes: minutes.toFixed(1)
                });
              }
            }
          });
          
          const realizedOccupancy = (occupiedMinutes / 60) * 100; // Convert to percentage
          
          hours.push({
            hour: istHour, // IST hour
            utcHour: utcHourInt, // Corresponding UTC hour
            label: istLabel, // IST time label
            predictedDemand, // 0-100 for display
            realizedOccupancy: Math.min(100, Math.max(0, realizedOccupancy)),
            hasBookings: occupiedMinutes > 0,
            dynamicPrice // Price in rupees
          });
        }
        
        console.log(`📊 Chart data generated for ${targetDate}:`, {
          totalHours: hours.length,
          hoursWithBookings: hours.filter(h => h.hasBookings).length,
          totalBookings: dateBookings.length,
          priceRange: { 
            min: Math.min(...hours.map(h => h.dynamicPrice)),
            max: Math.max(...hours.map(h => h.dynamicPrice))
          },
          sampleHours: hours.slice(10, 14).map(h => ({
            hour: h.label,
            demandValue: predictions.find(p => p.hour === h.utcHour)?.demandValue,
            demandPercent: Math.round((predictions.find(p => p.hour === h.utcHour)?.demandValue || 0) * 100),
            price: h.dynamicPrice,
            realized: h.realizedOccupancy.toFixed(1)
          }))
        });
        
        setChartData(hours);
      } catch (err) {
        console.error('Error fetching 24-hour data:', err);
        setError(err.response?.data?.error?.message || 'Failed to load demand forecast');
      } finally {
        setLoading(false);
      }
    };

    fetch24HourData();
    
    // Auto-refresh every 15 minutes
    const refreshInterval = setInterval(() => {
      fetch24HourData();
    }, 15 * 60 * 1000); // 15 minutes
    
    return () => clearInterval(refreshInterval);
  }, [chargerId, date]);

  if (loading || parentLoading) {
    return (
      <Card className="p-6 bg-white border border-slate-200 shadow-md">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 rounded w-2/3"></div>
          <div className="h-64 bg-slate-100 rounded-xl"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-white border border-rose-200">
        <p className="text-sm text-rose-600">{error}</p>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return null;
  }

  // Find max value for scaling
  const maxValue = Math.max(
    ...chartData.map(d => Math.max(
      d.predictedDemand || 0, 
      d.realizedOccupancy || 0
    )),
    10 // Minimum scale
  );
  const scale = 100 / maxValue;

  return (
    <Card className="p-6 bg-white border border-slate-200 shadow-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              24-Hour Station Demand & Dynamic Rates
            </h3>
            <p className="text-xs text-slate-500">
              Machine learning spatiotemporal occupancy predictions
            </p>
          </div>
        </div>
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold px-3 py-1">
          <Zap className="w-3 h-3 mr-1" />
          XGBoost Model
        </Badge>
      </div>

      {/* Chart Area */}
      <div className="relative h-80 mb-4">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-8 w-8 flex flex-col justify-between text-xs text-slate-500 font-medium">
          <span>100</span>
          <span>75</span>
          <span>50</span>
          <span>25</span>
          <span>0</span>
        </div>

        {/* Chart container */}
        <div className="ml-10 h-full relative overflow-hidden rounded-lg">
          {/* Background box */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-50/50 to-white border border-slate-200"></div>
          
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
            <div className="h-px bg-slate-200"></div>
            <div className="h-px bg-slate-200"></div>
            <div className="h-px bg-slate-200"></div>
            <div className="h-px bg-slate-200"></div>
            <div className="h-px bg-slate-300"></div>
          </div>

          {/* Chart area with SVG */}
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ clipPath: 'inset(0 0 0 0 round 0.5rem)' }}>
            {/* Gradients */}
            <defs>
              <linearGradient id="realizedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(16, 185, 129, 0.35)" />
                <stop offset="100%" stopColor="rgba(16, 185, 129, 0.05)" />
              </linearGradient>
            </defs>
            
            {/* Current time indicator line - INSIDE SVG */}
            {(() => {
              const now = new Date();
              const istHour = now.getHours();
              const currentHourIndex = chartData?.findIndex(d => d.hour === istHour);
              
              if (currentHourIndex >= 0) {
                const xPosition = (currentHourIndex / (chartData.length - 1)) * 100;
                return (
                  <>
                    <line x1={xPosition} y1="0" x2={xPosition} y2="100" stroke="rgb(239, 68, 68)" strokeWidth="0.5" strokeDasharray="2,2" />
                    <text x={xPosition} y="-2" fontSize="3" fill="rgb(239, 68, 68)" textAnchor="middle" fontWeight="bold">
                      Now
                    </text>
                  </>
                );
              }
              return null;
            })()}
            
            {/* Realized occupancy filled area */}
            <path
              d={`M 0,100 ${chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * 100;
                const y = 100 - d.realizedOccupancy;
                return `L ${x},${y}`;
              }).join(' ')} L 100,100 Z`}
              fill="url(#realizedGradient)"
            />

            {/* Realized occupancy line */}
            <polyline
              points={chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * 100;
                const y = 100 - d.realizedOccupancy;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="rgb(16, 185, 129)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />

            {/* Predicted demand - Dashed line */}
            {chartData.some(d => d.predictedDemand != null) && (
              <polyline
                points={chartData.map((d, i) => {
                  const x = (i / (chartData.length - 1)) * 100;
                  const y = 100 - (d.predictedDemand || 0);
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke="rgb(59, 130, 246)"
                strokeWidth="1"
                strokeDasharray="3,2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Interactive hover points */}
            {chartData.map((d, i) => {
              const x = (i / (chartData.length - 1)) * 100;
              const yRealized = 100 - d.realizedOccupancy;
              const yPredicted = 100 - (d.predictedDemand || 0);
              
              return (
                <g key={i}>
                  {/* Hover area */}
                  <rect
                    x={x - 2}
                    y="0"
                    width="4"
                    height="100"
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(i)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  
                  {/* Show circles when hovered */}
                  {hoveredPoint === i && (
                    <>
                      <circle
                        cx={x}
                        cy={yRealized}
                        r="1.5"
                        fill="rgb(16, 185, 129)"
                        stroke="white"
                        strokeWidth="0.5"
                      />
                      {d.predictedDemand != null && (
                        <circle
                          cx={x}
                          cy={yPredicted}
                          r="1.5"
                          fill="rgb(59, 130, 246)"
                          stroke="white"
                          strokeWidth="0.5"
                        />
                      )}
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hoveredPoint !== null && chartData[hoveredPoint] && (
            <div
              className="absolute z-10 bg-slate-900 text-white px-3 py-2 rounded-lg shadow-xl text-xs font-semibold pointer-events-none"
              style={{
                left: `${((hoveredPoint / (chartData.length - 1)) * 100)}%`,
                top: '50%',
                transform: 'translate(-50%, -120%)'
              }}
            >
              <div className="space-y-1">
                <div className="font-bold text-emerald-300">
                  {chartData[hoveredPoint].label} IST
                </div>
                {chartData[hoveredPoint].predictedDemand != null && (
                  <div className="text-blue-300">
                    Predicted: {chartData[hoveredPoint].predictedDemand.toFixed(1)}%
                  </div>
                )}
                <div className="text-emerald-300">
                  Realized: {chartData[hoveredPoint].realizedOccupancy.toFixed(1)}%
                </div>
                <div className="text-amber-300 font-bold border-t border-slate-700 pt-1 mt-1">
                  Rate: ₹{chartData[hoveredPoint].dynamicPrice}/hr
                </div>
              </div>
              {/* Arrow pointer */}
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-slate-900 rotate-45"></div>
            </div>
          )}
        </div>

        {/* X-axis labels - IST Times (00:00 to 23:00) */}
        <div className="absolute bottom-0 left-10 right-0 flex justify-between text-xs text-slate-500 font-medium pt-2">
          <span>00:00</span>
          <span>03:00</span>
          <span>06:00</span>
          <span>09:00</span>
          <span>12:00</span>
          <span>15:00</span>
          <span>18:00</span>
          <span>21:00</span>
        </div>
      </div>

      {/* Dynamic Pricing Info */}
      {chartData.some(d => d.dynamicPrice) && (
        <div className="mb-4 p-3 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl border border-emerald-200">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-semibold text-slate-700">
              💰 Price Range (24h):
            </span>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-emerald-700">
                Low: ₹{Math.min(...chartData.map(d => d.dynamicPrice || 999))}/hr
              </span>
              <span className="text-xs font-bold text-amber-700">
                Peak: ₹{Math.max(...chartData.map(d => d.dynamicPrice || 0))}/hr
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gradient-to-br from-emerald-500 to-emerald-400 border-2 border-white shadow"></div>
          <span className="text-xs font-semibold text-slate-700">
            Realized Occupancy (%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-500" style={{ borderTop: '2px dashed rgb(59, 130, 246)' }}></div>
          <span className="text-xs font-semibold text-slate-700">
            XGBoost Predicted Demand (%)
          </span>
        </div>
      </div>
    </Card>
  );
};

export default Demand24HourChart;
