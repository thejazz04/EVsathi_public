import React, { useState, useEffect } from 'react';
import { Zap, Info, RefreshCw, AlertCircle, CheckCircle2, TrendingUp, Sliders } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import { pricingService } from '../services/pricingService.js';
import { chargerService } from '../services/chargerService.js';

const PricingEngine = () => {
  const [chargers, setChargers] = useState([]);
  const [selectedChargerId, setSelectedChargerId] = useState('');
  const [pricingData, setPricingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFormula, setShowFormula] = useState(false);

  useEffect(() => {
    loadChargers();
  }, []);

  const loadChargers = async () => {
    try {
      const res = await chargerService.getChargers({ limit: 10 });
      const list = res.data?.chargers || res.data || [];
      setChargers(Array.isArray(list) ? list : []);
      if (list.length > 0) {
        setSelectedChargerId(list[0]._id);
        fetchPricing(list[0]._id);
      }
    } catch (err) {
      console.error('Failed to load chargers for pricing engine:', err);
    }
  };

  const fetchPricing = async (chargerId) => {
    if (!chargerId) return;
    setLoading(true);
    setError('');

    try {
      const response = await pricingService.getPricingInfo(chargerId);
      if (response.success && response.data) {
        setPricingData(response.data);
      } else {
        setError('Unable to calculate dynamic price from backend.');
        setPricingData(null);
      }
    } catch (err) {
      console.error('Dynamic pricing request failed:', err);
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Dynamic pricing currently unavailable for this charger.'
      );
      setPricingData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChargerChange = (e) => {
    const id = e.target.value;
    setSelectedChargerId(id);
    fetchPricing(id);
  };

  const selectedCharger = chargers.find((c) => c._id === selectedChargerId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-evsathi-mint/40 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-evsathi-teal bg-evsathi-light px-3 py-1 rounded-full border border-evsathi-soft mb-2">
            <Zap className="w-3.5 h-3.5" />
            Rule-Based Dynamic Pricing Engine
          </div>
          <h1 className="text-3xl font-extrabold text-evsathi-dark tracking-tight">
            Dynamic Pricing Engine
          </h1>
          <p className="text-sm text-evsathi-slate mt-1">
            Real-time charging rate calculations based on regional demand and occupancy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            icon={Info}
            onClick={() => setShowFormula(!showFormula)}
          >
            {showFormula ? 'Hide Formula' : 'Pricing Formula'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={() => fetchPricing(selectedChargerId)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Charger Selector */}
      <Card className="p-5 bg-white border border-evsathi-mint/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-bold text-evsathi-dark mb-1">
            Select Charger to Inspect Dynamic Rate
          </label>
          <select
            value={selectedChargerId}
            onChange={handleChargerChange}
            className="px-4 py-2.5 bg-evsathi-surface border border-evsathi-mint/60 rounded-xl text-xs font-bold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
          >
            {chargers.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title || c.name || 'Charger'} — {c.location?.city || c.city || 'NCR'} (Base: ₹{c.pricePerSlot || c.pricing?.basePrice || 25}/hr)
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Backend Route: <code className="font-mono text-evsathi-teal">/api/pricing/:chargerId/pricing</code>
        </div>
      </Card>

      {/* Pricing Result Card */}
      {error ? (
        <Card className="p-6 bg-white border border-rose-200 shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Pricing Unavailable</span>
          </div>
          <p className="text-xs text-slate-600">{error}</p>
        </Card>
      ) : loading ? (
        <Card className="p-8 text-center space-y-3">
          <RefreshCw className="w-6 h-6 text-evsathi-teal animate-spin mx-auto" />
          <p className="text-xs text-slate-500">Querying backend pricing engine...</p>
        </Card>
      ) : pricingData ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <Card className="p-6 bg-white border border-evsathi-mint shadow-xs">
            <p className="text-xs font-bold text-evsathi-muted uppercase">Base Hourly Rate</p>
            <h3 className="text-3xl font-extrabold text-evsathi-dark mt-1">
              ₹{pricingData.basePrice || 25}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Configured host base rate</p>
          </Card>

          <Card className="p-6 bg-white border border-emerald-300 shadow-md">
            <p className="text-xs font-bold text-emerald-700 uppercase">Current Dynamic Price</p>
            <h3 className="text-3xl font-extrabold text-emerald-700 mt-1">
              ₹{pricingData.recommendedPrice || pricingData.currentPrice || pricingData.basePrice}/hr
            </h3>
            <p className="text-[11px] text-emerald-600 font-semibold mt-1">
              Recommended driver booking price
            </p>
          </Card>

          <Card className="p-6 bg-white border border-evsathi-mint shadow-xs">
            <p className="text-xs font-bold text-evsathi-muted uppercase">Demand Multiplier</p>
            <h3 className="text-3xl font-extrabold text-evsathi-dark mt-1">
              {pricingData.demandMultiplier != null
                ? `${Number(pricingData.demandMultiplier).toFixed(2)}x`
                : `${Number(pricingData.demandFactor || 1.0).toFixed(2)}x`}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">Demand-scaled price factor</p>
          </Card>

          <Card className="p-6 bg-white border border-evsathi-mint shadow-xs">
            <p className="text-xs font-bold text-evsathi-muted uppercase">Algorithm</p>
            <h3 className="text-sm font-extrabold text-evsathi-dark mt-1 font-mono">
              {pricingData.pricingAlgorithm || 'RULE_BASED_PRICING'}
            </h3>
            <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-800 text-[10px] font-bold border border-sky-200">
              Rule-Based Dynamic Pricing
            </span>
          </Card>
        </div>
      ) : null}

      {/* Transparent Formula Card */}
      {showFormula && (
        <Card className="p-6 bg-evsathi-dark text-white border-evsathi-slate space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-evsathi-mint">
            <Info className="w-5 h-5" />
            <h3 className="text-base font-extrabold text-white">Rule-Based Dynamic Pricing Formulation</h3>
          </div>
          <p className="text-xs text-evsathi-soft leading-relaxed">
            EVsathi applies a transparent rule-based demand scaling formula to balance charger availability and driver cost:
          </p>
          <div className="p-4 bg-evsathi-slate rounded-xl font-mono text-xs text-emerald-300 overflow-x-auto">
            SurgeMultiplier = 1.0 + (DemandValue - 0.5) * 0.4
            <br />
            DynamicPrice = Math.round(BasePrice * SurgeMultiplier)
          </div>
          <ul className="space-y-1.5 text-xs text-evsathi-soft pt-1">
            <li>• <strong>BasePrice</strong>: Baseline hourly slot fee established by the charger host.</li>
            <li>• <strong>DemandValue</strong>: Normalized station demand factor (0.0 to 1.0).</li>
            <li>• <strong>SurgeMultiplier</strong>: Smooth scaling between 0.8x (off-peak) and 1.2x (high rush).</li>
          </ul>
        </Card>
      )}

      {/* Real Pipeline Explanation */}
      <Card className="p-6 bg-white border border-evsathi-mint/40 space-y-4">
        <h3 className="text-base font-extrabold text-evsathi-dark">How Dynamic Pricing Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-evsathi-slate">
          <div className="p-4 bg-evsathi-surface rounded-2xl border border-evsathi-soft space-y-1">
            <h4 className="font-bold text-evsathi-dark">1. Telemetry Query</h4>
            <p>The system evaluates current station occupancy and regional utilization.</p>
          </div>
          <div className="p-4 bg-evsathi-surface rounded-2xl border border-evsathi-soft space-y-1">
            <h4 className="font-bold text-evsathi-dark">2. Demand Factor</h4>
            <p>When station rush is high, demand factor increases to encourage off-peak charging.</p>
          </div>
          <div className="p-4 bg-evsathi-surface rounded-2xl border border-evsathi-soft space-y-1">
            <h4 className="font-bold text-evsathi-dark">3. Fair Rate Output</h4>
            <p>Calculated dynamic rates are capped within reasonable bounds to protect drivers while rewarding hosts.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PricingEngine;
