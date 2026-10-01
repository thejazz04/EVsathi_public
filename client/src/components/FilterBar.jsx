import React from 'react';
import { X, SlidersHorizontal, RotateCcw, Check } from 'lucide-react';
import Button from './ui/Button.jsx';

const FilterBar = ({
  filters,
  onFilterChange,
  sortBy = 'smartScore',
  onSortChange,
  onClear,
  onClose,
  priceCeiling = 100,
}) => {
  const handleChange = (key, value) => {
    if (typeof onFilterChange === 'function') {
      onFilterChange((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleBackdropClick = (e) => {
    e.stopPropagation();
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const handleClose = (e) => {
    e?.stopPropagation();
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const priceValue = filters.maxPrice || priceCeiling;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-evsathi-dark/60 backdrop-blur-xs transition-opacity"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-evsathi-mint/60 bg-white p-6 shadow-2xl space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-evsathi-soft/60 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-evsathi-light text-evsathi-teal flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h2 className="text-lg font-extrabold text-evsathi-dark">Filter Smart Chargers</h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl text-evsathi-muted hover:text-evsathi-dark hover:bg-evsathi-light transition-colors"
            aria-label="Close filters"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs font-semibold">
          
          {/* Max Price Filter Slider */}
          <div>
            <div className="flex justify-between items-center mb-1 text-evsathi-dark font-extrabold">
              <span>Max Price per kWh</span>
              <span className="text-evsathi-teal font-extrabold">₹{priceValue}/kWh</span>
            </div>
            <input
              type="range"
              min={5}
              max={priceCeiling}
              step={1}
              value={priceValue}
              onChange={(e) => handleChange('maxPrice', Number(e.target.value))}
              className="w-full accent-evsathi-teal cursor-pointer"
            />
          </div>

          {/* Charger Type AC / DC */}
          <div>
            <span className="block mb-1.5 text-evsathi-dark font-extrabold">Charger Type</span>
            <div className="grid grid-cols-3 gap-2 p-1 bg-evsathi-surface rounded-xl border border-evsathi-soft">
              {['', 'AC', 'DC'].map((type) => (
                <button
                  key={type || 'all'}
                  type="button"
                  onClick={() => handleChange('chargerType', type)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    (filters.chargerType || '') === type
                      ? 'bg-evsathi-teal text-white shadow-xs'
                      : 'text-evsathi-slate hover:text-evsathi-dark'
                  }`}
                >
                  {type === '' ? 'All Types' : type}
                </button>
              ))}
            </div>
          </div>

          {/* Connector Type */}
          <div>
            <label className="block mb-1.5 text-evsathi-dark font-extrabold">Connector Plug</label>
            <select
              value={filters.connectorType || ''}
              onChange={(e) => handleChange('connectorType', e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-evsathi-mint/60 rounded-xl text-evsathi-dark text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
            >
              <option value="">All Connectors (CCS2, Type 2, CHAdeMO)</option>
              <option value="CCS">CCS2 Fast Charging</option>
              <option value="Type 2">Type 2 AC</option>
              <option value="CHAdeMO">CHAdeMO</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-evsathi-soft/60 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (typeof onClear === 'function') onClear();
              else if (typeof onFilterChange === 'function') {
                onFilterChange({ connectorType: '', chargerType: '', search: '', minPower: '', maxPrice: '' });
              }
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-evsathi-mint/60 text-evsathi-dark font-extrabold text-xs hover:bg-evsathi-light transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear All
          </button>

          <Button type="button" variant="primary" onClick={handleClose} icon={Check}>
            Apply Filters
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FilterBar;