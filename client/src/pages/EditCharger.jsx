import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { chargerService } from '../services/chargerService.js';
import { uploadService } from '../services/uploadService.js';
import { CHARGER_TYPES, CONNECTOR_TYPES } from '../utils/constants.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getImageUrl } from '../utils/imageHelper.js';
import LocationPicker from '../components/LocationPicker.jsx';
import {
  Save,
  Zap,
  Building2,
  MapPin,
  DollarSign,
  ShieldCheck,
  Sparkles,
  Camera,
  CheckCircle2,
  Clock,
  Car,
  Wifi,
  Sliders,
} from 'lucide-react';
import Card from '../components/ui/Card.jsx';
import Button from '../components/ui/Button.jsx';
import Input from '../components/ui/Input.jsx';

const EditCharger = () => {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingCharger, setLoadingCharger] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    chargerType: 'Level 2',
    connectorType: 'Type 2',
    powerOutput: '7.4',
    pricePerHour: '25',
    location: {
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'India',
      coordinates: {
        lat: 28.6139,
        lng: 77.209,
      },
    },
    amenities: [],
    availability: {
      isAvailable: true,
      schedule: [],
    },
  });

  const [amenityInput, setAmenityInput] = useState('');
  const [images, setImages] = useState([]);
  const [uploadingImages, setUploadingImages] = useState(false);

  useEffect(() => {
    fetchCharger();
  }, [id]);

  const fetchCharger = async () => {
    try {
      setLoadingCharger(true);
      const response = await chargerService.getById(id);
      const charger = response.data.charger;

      setFormData({
        title: charger.title || '',
        description: charger.description || '',
        chargerType: charger.chargerType || 'Level 2',
        connectorType: charger.connectorType || 'Type 2',
        powerOutput: String(charger.powerOutput || '7.4'),
        pricePerHour: String(charger.pricePerHour || '25'),
        location: {
          address: charger.location?.address || '',
          city: charger.location?.city || '',
          state: charger.location?.state || '',
          zipCode: charger.location?.zipCode || '',
          country: charger.location?.country || 'India',
          coordinates: {
            lat: charger.location?.coordinates?.[1] || 28.6139,
            lng: charger.location?.coordinates?.[0] || 77.209,
          },
        },
        amenities: charger.amenities || [],
        availability: charger.availability || {
          isAvailable: true,
          schedule: [],
        },
      });

      setImages(charger.images || []);
    } catch (error) {
      console.error('Error fetching charger:', error);
      setError('Failed to load charger details');
    } finally {
      setLoadingCharger(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith('location.')) {
      const locationField = name.split('.')[1];
      if (locationField === 'coordinates.lat' || locationField === 'coordinates.lng') {
        const coordField = locationField.split('.')[1];
        setFormData({
          ...formData,
          location: {
            ...formData.location,
            coordinates: {
              ...formData.location.coordinates,
              [coordField]: value,
            },
          },
        });
      } else {
        setFormData({
          ...formData,
          location: {
            ...formData.location,
            [locationField]: value,
          },
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleAddAmenity = () => {
    if (amenityInput.trim() && !formData.amenities.includes(amenityInput.trim())) {
      setFormData({
        ...formData,
        amenities: [...formData.amenities, amenityInput.trim()],
      });
      setAmenityInput('');
    }
  };

  const handleRemoveAmenity = (amenity) => {
    setFormData({
      ...formData,
      amenities: formData.amenities.filter((a) => a !== amenity),
    });
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploadingImages(true);
    setError('');
    try {
      const response = await uploadService.uploadImages(files);
      setImages([...images, ...(response.data?.images || [])]);
    } catch (error) {
      console.warn('Image upload endpoint unavailable, adding local preview URL:', error);
      const previewUrls = files.map((file) => URL.createObjectURL(file));
      setImages([...images, ...previewUrls]);
    } finally {
      setUploadingImages(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.title || !formData.location.address || !formData.location.city) {
      setError('Please complete the title, address, and city fields');
      setLoading(false);
      return;
    }

    try {
      const chargerData = {
        ...formData,
        images: images,
        powerOutput: parseFloat(formData.powerOutput || 7.4),
        pricePerHour: parseFloat(formData.pricePerHour || 25),
        location: {
          ...formData.location,
          coordinates: {
            lat: parseFloat(formData.location.coordinates.lat || 28.6139),
            lng: parseFloat(formData.location.coordinates.lng || 77.209),
          },
        },
      };

      await chargerService.update(id, chargerData);
      navigate(`/chargers/${id}`);
    } catch (err) {
      console.error('Update error:', err);
      setError(err?.response?.data?.message || 'Failed to update charger');
    } finally {
      setLoading(false);
    }
  };

  if (loadingCharger) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading charger details...</div>
      </div>
    );
  }

  const hourlyPriceNum = Number(formData.pricePerHour || 25);
  const estimatedMonthlyRevenue = Math.round(hourlyPriceNum * 5 * 30 * 0.9);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-evsathi-mint/40 pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-evsathi-soft text-evsathi-dark text-xs font-extrabold border border-evsathi-mint mb-2">
            <Building2 className="w-3.5 h-3.5 text-evsathi-teal" />
            <span>Edit Charger Listing</span>
          </div>
          <h1 className="text-3xl font-extrabold text-evsathi-dark tracking-tight">
            Update Your Charger
          </h1>
          <p className="text-sm text-evsathi-slate mt-1">
            Modify your charger details and pricing on EVsathi.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-6">
          
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {error}
            </div>
          )}

          {/* Basic Details & Photos */}
          <Card className="p-6 bg-white border border-evsathi-mint/40 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-evsathi-soft/60 pb-3">
              <span className="w-6 h-6 rounded-lg bg-evsathi-teal text-white font-extrabold text-xs flex items-center justify-center">1</span>
              <h2 className="text-base font-extrabold text-evsathi-dark">Basic Details & Photos</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-evsathi-dark mb-1">
                  Station Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  required
                  className="w-full px-4 py-2.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark placeholder-evsathi-muted focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Residential P2P Home Charger - Sector 62 Driveway"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-evsathi-dark mb-1">Description</label>
                <textarea
                  name="description"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark placeholder-evsathi-muted focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe your driveway charger..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-evsathi-dark mb-1">Photos</label>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer px-4 py-2.5 bg-evsathi-soft hover:bg-evsathi-mint text-evsathi-dark font-extrabold text-xs rounded-xl border border-evsathi-mint transition-colors flex items-center gap-2">
                    <Camera className="w-4 h-4 text-evsathi-teal" />
                    <span>Upload Photos</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-3">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative rounded-xl overflow-hidden border border-evsathi-mint group h-20">
                        <img 
                          src={getImageUrl(img)} 
                          alt="Charger" 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5JbWFnZTwvdGV4dD48L3N2Zz4=';
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="absolute top-1 right-1 bg-rose-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Hardware & Pricing */}
          <Card className="p-6 bg-white border border-evsathi-mint/40 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-evsathi-soft/60 pb-3">
              <span className="w-6 h-6 rounded-lg bg-evsathi-teal text-white font-extrabold text-xs flex items-center justify-center">2</span>
              <h2 className="text-base font-extrabold text-evsathi-dark">Hardware & Pricing</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-evsathi-dark mb-1">Power Output (kW)</label>
                <input
                  type="number"
                  name="powerOutput"
                  step="0.1"
                  className="w-full px-4 py-2.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                  value={formData.powerOutput}
                  onChange={handleChange}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-evsathi-dark mb-1">Connector Type</label>
                <select
                  name="connectorType"
                  className="w-full px-3 py-2.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-bold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                  value={formData.connectorType}
                  onChange={handleChange}
                >
                  <option value="Type 2">Type 2 AC</option>
                  <option value="CCS2">CCS2 DC</option>
                  <option value="CHAdeMO">CHAdeMO</option>
                  <option value="15A Socket">15A Socket</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-evsathi-dark mb-1">Price Per Hour (₹)</label>
                <input
                  type="number"
                  name="pricePerHour"
                  required
                  min="5"
                  className="w-full px-4 py-2.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                  value={formData.pricePerHour}
                  onChange={handleChange}
                />
              </div>
            </div>
          </Card>

          {/* Location */}
          <Card className="p-6 bg-white border border-evsathi-mint/40 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-evsathi-soft/60 pb-3">
              <span className="w-6 h-6 rounded-lg bg-evsathi-teal text-white font-extrabold text-xs flex items-center justify-center">3</span>
              <h2 className="text-base font-extrabold text-evsathi-dark">Location</h2>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-evsathi-dark mb-1">Address</label>
                  <input
                    type="text"
                    name="location.address"
                    required
                    className="w-full px-4 py-2.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                    value={formData.location.address}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-evsathi-dark mb-1">City</label>
                  <input
                    type="text"
                    name="location.city"
                    required
                    className="w-full px-4 py-2.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                    value={formData.location.city}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-evsathi-dark mb-1">State</label>
                  <input
                    type="text"
                    name="location.state"
                    required
                    className="w-full px-4 py-2.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                    value={formData.location.state}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Amenities */}
          <Card className="p-6 bg-white border border-evsathi-mint/40 space-y-5 shadow-xs">
            <div className="flex items-center gap-2 border-b border-evsathi-soft/60 pb-3">
              <span className="w-6 h-6 rounded-lg bg-evsathi-teal text-white font-extrabold text-xs flex items-center justify-center">4</span>
              <h2 className="text-base font-extrabold text-evsathi-dark">Amenities</h2>
            </div>

            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  className="flex-1 px-4 py-2.5 bg-evsathi-light border border-evsathi-mint/60 rounded-xl text-xs font-semibold text-evsathi-dark focus:outline-none focus:ring-2 focus:ring-evsathi-teal"
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  placeholder="Add amenity..."
                />
                <button
                  type="button"
                  onClick={handleAddAmenity}
                  className="px-4 py-2.5 bg-evsathi-soft hover:bg-evsathi-mint text-evsathi-dark font-extrabold text-xs rounded-xl border border-evsathi-mint transition-colors"
                >
                  Add
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {formData.amenities.map((amenity) => (
                  <span
                    key={amenity}
                    className="px-3 py-1 bg-evsathi-light border border-evsathi-soft text-evsathi-dark text-xs font-bold rounded-full flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-evsathi-teal" />
                    {amenity}
                    <button
                      type="button"
                      onClick={() => handleRemoveAmenity(amenity)}
                      className="text-evsathi-muted hover:text-rose-600 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 pt-2">
            <Button type="submit" variant="primary" size="lg" loading={loading} icon={Save} className="w-full sm:w-auto px-8">
              {loading ? 'Saving Changes...' : 'Update Charger'}
            </Button>
            <button
              type="button"
              onClick={() => navigate('/my-chargers')}
              className="px-6 py-3 rounded-xl border border-evsathi-mint text-evsathi-dark font-extrabold text-xs hover:bg-evsathi-light transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="p-6 bg-gradient-to-br from-evsathi-teal to-[#547b71] text-white space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-evsathi-soft">Earnings Estimator</span>
            </div>

            <div>
              <p className="text-xs text-evsathi-soft">Projected Monthly Revenue</p>
              <h3 className="text-4xl font-extrabold text-white mt-1">₹{estimatedMonthlyRevenue}</h3>
              <p className="text-[11px] text-evsathi-soft mt-1">
                Based on ₹{hourlyPriceNum}/hr rate × 5 hours/day
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EditCharger;
