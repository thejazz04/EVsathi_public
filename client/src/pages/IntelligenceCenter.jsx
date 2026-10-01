import React, { useState, useEffect } from 'react';
import { Cpu, Activity, Zap, ShieldCheck, CheckCircle2, AlertTriangle, Layers, Database, RefreshCw } from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import CurrentDemandPredictionCard from '../components/ai/CurrentDemandPredictionCard.jsx';
import { mlService } from '../services/mlService.js';
import { chargerService } from '../services/chargerService.js';

const IntelligenceCenter = () => {
  const [chargers, setChargers] = useState([]);
  const [selectedChargerId, setSelectedChargerId] = useState('');
  const [predictionData, setPredictionData] = useState(null);
  const [mlStatus, setMlStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [chargersRes, statusRes] = await Promise.allSettled([
        chargerService.getChargers({ limit: 10 }),
        mlService.getMlStatus(),
      ]);

      if (chargersRes.status === 'fulfilled') {
        const list = chargersRes.value.data?.chargers || chargersRes.value.data || [];
        setChargers(Array.isArray(list) ? list : []);
        if (list.length > 0) {
          setSelectedChargerId(list[0]._id);
          fetchPrediction(list[0]._id);
        }
      }

      if (statusRes.status === 'fulfilled') {
        setMlStatus(statusRes.value.data || null);
      }
    } catch (err) {
      console.error('Failed to load intelligence center data:', err);
    }
  };

  const fetchPrediction = async (chargerId) => {
    if (!chargerId) return;
    setLoading(true);
    setError('');

    try {
      const res = await mlService.getDemandPrediction({
        chargerId,
        timestamp: new Date().toISOString(),
      });
      if (res.success && res.data) {
        setPredictionData(res.data);
      } else {
        setError('Unable to fetch live demand prediction.');
      }
    } catch (err) {
      console.error('Prediction request error:', err);
      setError(
        err.response?.data?.error?.message ||
        err.response?.data?.message ||
        'Demand prediction service currently unreachable.'
      );
      setPredictionData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChargerChange = (e) => {
    const id = e.target.value;
    setSelectedChargerId(id);
    fetchPrediction(id);
  };

  const selectedCharger = chargers.find((c) => c._id === selectedChargerId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-evsathi-mint/40 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-evsathi-teal bg-evsathi-light px-3 py-1 rounded-full border border-evsathi-soft mb-2">
            <Cpu className="w-3.5 h-3.5" />
            Machine Learning & Platform Intelligence
          </div>
          <h1 className="text-3xl font-extrabold text-evsathi-dark tracking-tight">
            EVsathi Intelligence Center
          </h1>
          <p className="text-sm text-evsathi-slate mt-1">
            Real-time status of XGBoost demand predictions, dynamic pricing engine, and telemetry data.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={loading}
            onClick={() => {
              loadData();
              fetchPrediction(selectedChargerId);
            }}
          >
            Refresh Status
          </Button>
        </div>
      </div>

      {/* Actual Service Architecture Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Section 1: XGBoost Demand Service */}
        <Card className="p-6 space-y-3 border-evsathi-mint">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-extrabold text-evsathi-dark">1. Demand Prediction</h4>
            <Cpu className="w-4 h-4 text-evsathi-teal" />
          </div>
          <p className="text-xs text-evsathi-slate">
            XGBoost Demand Model v1 inference engine via FastAPI service.
          </p>
          <div className="p-3 bg-evsathi-surface rounded-xl text-xs font-bold text-evsathi-dark flex items-center justify-between">
            <span>Model Status:</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px]">
              {mlStatus?.xgboostDemandModelStatus || 'IMPLEMENTED'}
            </span>
          </div>
        </Card>

        {/* Section 2: Dynamic Pricing Engine */}
        <Card className="p-6 space-y-3 border-evsathi-mint">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-extrabold text-evsathi-dark">2. Dynamic Pricing</h4>
            <Zap className="w-4 h-4 text-evsathi-teal" />
          </div>
          <p className="text-xs text-evsathi-slate">
            Demand-based surge multiplier scaling base rates between 0.8x and 1.2x.
          </p>
          <div className="p-3 bg-evsathi-surface rounded-xl text-xs font-bold text-evsathi-dark flex items-center justify-between">
            <span>Pricing Mode:</span>
            <span className="px-2 py-0.5 rounded-md bg-sky-100 text-sky-800 text-[11px]">
              {mlStatus?.pricingModelStatus || 'RULE_BASED'}
            </span>
          </div>
        </Card>

        {/* Section 3: Reinforcement Learning (PPO) */}
        <Card className="p-6 space-y-3 border-slate-200">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-extrabold text-slate-700">3. Reinforcement Learning</h4>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xs text-slate-500">
            Proximal Policy Optimization (PPO) is not implemented in current release.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>PPO Status:</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[11px]">
              {mlStatus?.ppoPricingModelStatus || 'NOT_IMPLEMENTED'}
            </span>
          </div>
        </Card>
      </div>

      {/* Charger Selector Bar */}
      <Card className="p-5 bg-white border border-evsathi-mint/40 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1">
          <label className="block text-xs font-bold text-evsathi-dark mb-1">
            Query Charger Demand Inference
          </label>
          <select
            value={selectedChargerId}
            onChange={handleChargerChange}
            disabled={chargers.length === 0}
            className="w-full px-4 py-2.5 bg-evsathi-surface border border-evsathi-mint/60 rounded-xl text-xs font-bold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {chargers.length === 0 ? (
              <option value="">Loading chargers...</option>
            ) : (
              chargers.map((charger) => (
                <option key={charger._id} value={charger._id}>
                  {charger.title || charger.name || 'Charger'} — {charger.location?.city || charger.city || 'NCR'}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Backend ML Client: <code className="font-mono text-evsathi-teal">{mlStatus?.mlServiceUrl || 'http://localhost:8000'}</code>
        </div>
      </Card>

      {/* Real-Time Demand Prediction Card */}
      <CurrentDemandPredictionCard
        predictionData={predictionData}
        loading={loading}
        error={error}
        stationLabel={selectedCharger?.title}
      />

      {/* Transparent Data Governance Card */}
      <Card className="p-6 bg-white border border-evsathi-mint/40 space-y-4">
        <h3 className="text-base font-extrabold text-evsathi-dark">Data Governance & Model Truthfulness</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-evsathi-slate">
          <div className="p-4 bg-evsathi-surface rounded-2xl border border-evsathi-soft space-y-1">
            <h4 className="font-bold text-evsathi-dark">1. Synthetic Training Baseline</h4>
            <p>The XGBoost demand model was calibrated on synthetic benchmark data across Indian metropolitan nodes.</p>
          </div>
          <div className="p-4 bg-evsathi-surface rounded-2xl border border-evsathi-soft space-y-1">
            <h4 className="font-bold text-evsathi-dark">2. Real Application Telemetry</h4>
            <p>Live inferences query genuine station records in MongoDB. If historical records are missing, the system gracefully falls back to deterministic rule-based output.</p>
          </div>
          <div className="p-4 bg-evsathi-surface rounded-2xl border border-evsathi-soft space-y-1">
            <h4 className="font-bold text-evsathi-dark">3. Transparent Status</h4>
            <p>The platform explicitly differentiates between ML model inference and rule-based fallback, never fabricating predictions.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default IntelligenceCenter;
