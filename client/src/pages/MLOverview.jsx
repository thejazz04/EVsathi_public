import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, Activity, Zap, TrendingUp, ArrowRight } from 'lucide-react';
import MLPricingShowcase from '../components/ai/MLPricingShowcase';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';

/**
 * ML Overview Page - Dedicated showcase for ML capabilities
 * Shows both XGBoost demand prediction and PPO RL pricing
 */
const MLOverview = () => {
  return (
    <div className="space-y-8 py-6">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-700 rounded-3xl p-8 sm:p-12 text-white shadow-2xl">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm text-sm font-bold mb-4">
              <Brain className="w-5 h-5" />
              <span>AI/ML Engineering Showcase</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight mb-4">
              Machine Learning Pipeline
            </h1>
            
            <p className="text-lg sm:text-xl text-purple-100 leading-relaxed mb-6">
              EVsathi's hybrid ML architecture combines XGBoost demand forecasting with PPO reinforcement learning 
              for spatiotemporal dynamic pricing. See real-time predictions and pricing optimization in action.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link to="/chargers">
                <Button variant="secondary" size="lg" icon={ArrowRight} iconPosition="right">
                  See ML in Production
                </Button>
              </Link>
              <Link to="/intelligence-center">
                <Button variant="dark" size="lg" icon={Activity} iconPosition="right">
                  Analytics Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ML Pipeline Overview Cards */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
            <div className="w-12 h-12 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-4">
              <Brain className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">XGBoost Demand Model</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Gradient-boosted trees trained on 29,376 Mysore charging patterns. Predicts hourly demand with 96.2% accuracy (R² = 0.962, MAE = 0.041).
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div>
                <div className="text-2xl font-black text-purple-600">22</div>
                <div className="text-slate-500">Features</div>
              </div>
              <div>
                <div className="text-2xl font-black text-purple-600">96%</div>
                <div className="text-slate-500">Accuracy</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">PPO Reinforcement Learning</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Proximal Policy Optimization agent fine-tunes pricing multipliers to maximize host revenue while maintaining driver satisfaction.
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div>
                <div className="text-2xl font-black text-blue-600">Shadow</div>
                <div className="text-slate-500">Mode</div>
              </div>
              <div>
                <div className="text-2xl font-black text-blue-600">Live</div>
                <div className="text-slate-500">A/B Test</div>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <div className="w-12 h-12 rounded-xl bg-green-600 text-white flex items-center justify-center mb-4">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Dynamic Pricing Engine</h3>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Integrates demand forecasts with RL-optimized multipliers to compute location-specific, time-sensitive pricing in real-time.
            </p>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div>
                <div className="text-2xl font-black text-green-600">24/7</div>
                <div className="text-slate-500">Real-time</div>
              </div>
              <div>
                <div className="text-2xl font-black text-green-600">5ms</div>
                <div className="text-slate-500">Latency</div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Main ML Showcase Component */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <MLPricingShowcase />
      </section>

      {/* Technical Details Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Card className="p-8 bg-slate-50 border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Technical Architecture</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                XGBoost Pipeline
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Model:</strong> XGBRegressor with 100 estimators, max_depth=6, learning_rate=0.1</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Features:</strong> 22 engineered features including temporal (hour, day, week), lag values (1h, 24h), rolling means, and station metadata</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Training Data:</strong> 29,376 historical records from Mysore charging stations (train: 24,192 | test: 5,184)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Performance:</strong> R² = 0.962, MAE = 0.041, RMSE = 0.063</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-600 font-bold">•</span>
                  <span><strong>Deployment:</strong> FastAPI microservice on port 8000, &lt;5ms inference latency</span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-600" />
                PPO RL Agent
              </h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span><strong>Algorithm:</strong> Proximal Policy Optimization (PPO) with clipped objective</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span><strong>State Space:</strong> Predicted demand, base price, hour, weekend flag, charger type</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span><strong>Action Space:</strong> Continuous pricing multiplier [0.8, 2.0] with safety clamping</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span><strong>Reward:</strong> Balances revenue maximization with utilization and fairness constraints</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">•</span>
                  <span><strong>Status:</strong> Shadow mode A/B testing - compares against rule-based baseline</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-300">
            <h3 className="text-lg font-bold text-slate-800 mb-3">Integration Flow</h3>
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <code className="text-sm text-slate-700 font-mono">
                User Request → Node.js Backend → XGBoost Demand Prediction (FastAPI) → 
                PPO Price Optimization → Dynamic Price Calculation → Database Cache → Response
              </code>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Average end-to-end latency: ~15ms | Fallback to rule-based pricing if ML service unavailable
            </p>
          </div>
        </Card>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 text-center text-white">
          <h2 className="text-2xl font-bold mb-3">Experience ML-Powered Pricing Live</h2>
          <p className="text-purple-100 mb-6 max-w-2xl mx-auto">
            See how EVsathi's machine learning pipeline optimizes every booking in real-time
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link to="/chargers">
              <Button variant="secondary" size="lg" icon={ArrowRight} iconPosition="right">
                Browse Smart-Priced Chargers
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default MLOverview;
