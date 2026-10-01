import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import GanttChart from '../components/GanttChart';
import slotService from '../services/slotService';
import { chargerService } from '../services/chargerService';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { format, addDays } from 'date-fns';

/**
 * Host Slot Management Page
 * Full Gantt chart view with ability to block/unblock/edit slots
 */
const ManageSlots = () => {
  const { chargerId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [charger, setCharger] = useState(null);
  const [slots, setSlots] = useState([]);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(addDays(new Date(), 7));
  
  // Modal states
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  
  // Form states
  const [blockForm, setBlockForm] = useState({
    startTime: '',
    endTime: '',
    blockReason: '',
    notes: '',
  });
  
  const [generateForm, setGenerateForm] = useState({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 14), 'yyyy-MM-dd'),
    slotDuration: 2,
    dailyStartHour: 6,
    dailyEndHour: 22,
    excludedDays: [],
  });

  useEffect(() => {
    loadData();
  }, [chargerId, startDate, endDate]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load charger details
      const chargerRes = await chargerService.getChargerById(chargerId);
      setCharger(chargerRes.data.data);
      
      // Load slots
      const slotsRes = await slotService.getHostSlots(
        chargerId,
        startDate.toISOString(),
        endDate.toISOString()
      );
      setSlots(slotsRes.data.data.slots);
    } catch (error) {
      console.error('Failed to load slot data:', error);
      alert('Failed to load slot data');
    } finally {
      setLoading(false);
    }
  };

  const handleSlotClick = (slot) => {
    setSelectedSlot(slot);
    
    if (slot.status === 'blocked' && slot.isEditable) {
      // Open edit modal for blocked slots
      setBlockForm({
        startTime: format(new Date(slot.startTime), "yyyy-MM-dd'T'HH:mm"),
        endTime: format(new Date(slot.endTime), "yyyy-MM-dd'T'HH:mm"),
        blockReason: slot.blockReason || '',
        notes: slot.notes || '',
      });
      setShowEditModal(true);
    } else if (slot.status === 'available') {
      // Show info or allow conversion to blocked
      if (window.confirm('Convert this available slot to blocked time?')) {
        handleBlockSlot({
          startTime: slot.startTime,
          endTime: slot.endTime,
          blockReason: 'Manual block',
          notes: '',
        });
      }
    }
  };

  const handleBlockSlot = async (data) => {
    try {
      await slotService.blockTimeSlot(chargerId, data || blockForm);
      setShowBlockModal(false);
      setBlockForm({ startTime: '', endTime: '', blockReason: '', notes: '' });
      loadData();
      alert('Time slot blocked successfully');
    } catch (error) {
      console.error('Failed to block slot:', error);
      alert(error.response?.data?.error?.message || 'Failed to block slot');
    }
  };

  const handleUnblockSlot = async (slotId) => {
    if (!window.confirm('Unblock this time slot?')) return;
    
    try {
      await slotService.unblockTimeSlot(slotId);
      loadData();
      alert('Time slot unblocked successfully');
    } catch (error) {
      console.error('Failed to unblock slot:', error);
      alert(error.response?.data?.error?.message || 'Failed to unblock slot');
    }
  };

  const handleUpdateSlot = async () => {
    try {
      await slotService.updateBlockedSlot(selectedSlot.id, blockForm);
      setShowEditModal(false);
      setSelectedSlot(null);
      loadData();
      alert('Slot updated successfully');
    } catch (error) {
      console.error('Failed to update slot:', error);
      alert(error.response?.data?.error?.message || 'Failed to update slot');
    }
  };

  const handleGenerateSlots = async () => {
    try {
      const payload = {
        ...generateForm,
        excludedDays: generateForm.excludedDays.map(Number),
      };
      
      const res = await slotService.generateAvailableSlots(chargerId, payload);
      setShowGenerateModal(false);
      loadData();
      alert(res.data.data.message);
    } catch (error) {
      console.error('Failed to generate slots:', error);
      alert(error.response?.data?.error?.message || 'Failed to generate slots');
    }
  };

  const handleDateRangeChange = (days) => {
    setStartDate(new Date());
    setEndDate(addDays(new Date(), days));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading slot data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Manage Slots</h1>
              <p className="text-slate-600 mt-1">{charger?.title || 'Loading...'}</p>
            </div>
            <Button onClick={() => navigate(-1)} variant="outline">
              ← Back
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 mt-6">
            <Button onClick={() => setShowBlockModal(true)} className="bg-amber-600 hover:bg-amber-700">
              🔒 Block Time
            </Button>
            <Button onClick={() => setShowGenerateModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
              ⚡ Generate Slots
            </Button>
            
            {/* Date range selector */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-slate-600">View:</span>
              <Button onClick={() => handleDateRangeChange(3)} variant="outline" size="sm">
                3 Days
              </Button>
              <Button onClick={() => handleDateRangeChange(7)} variant="outline" size="sm">
                7 Days
              </Button>
              <Button onClick={() => handleDateRangeChange(14)} variant="outline" size="sm">
                14 Days
              </Button>
            </div>
          </div>
        </div>

        {/* Gantt Chart */}
        <GanttChart
          slots={slots}
          startDate={startDate}
          endDate={endDate}
          onSlotClick={handleSlotClick}
          editable={true}
          hourStart={6}
          hourEnd={23}
        />

        {/* Slot Details Panel */}
        {selectedSlot && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4">Slot Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-slate-600">Status:</span>
                <p className="font-medium capitalize">{selectedSlot.status}</p>
              </div>
              <div>
                <span className="text-sm text-slate-600">Time:</span>
                <p className="font-medium">
                  {format(new Date(selectedSlot.startTime), 'MMM dd, h:mm a')} -{' '}
                  {format(new Date(selectedSlot.endTime), 'h:mm a')}
                </p>
              </div>
              {selectedSlot.status === 'blocked' && (
                <>
                  <div>
                    <span className="text-sm text-slate-600">Reason:</span>
                    <p className="font-medium">{selectedSlot.blockReason || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-sm text-slate-600">Notes:</span>
                    <p className="font-medium">{selectedSlot.notes || 'N/A'}</p>
                  </div>
                </>
              )}
            </div>
            
            {selectedSlot.status === 'blocked' && selectedSlot.isEditable && (
              <div className="flex gap-3 mt-4">
                <Button onClick={() => handleUnblockSlot(selectedSlot.id)} variant="outline">
                  Unblock
                </Button>
                <Button onClick={() => setShowEditModal(true)}>Edit Details</Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Block Time Modal */}
      <Modal isOpen={showBlockModal} onClose={() => setShowBlockModal(false)} title="Block Time Slot">
        <div className="space-y-4">
          <Input
            label="Start Time"
            type="datetime-local"
            value={blockForm.startTime}
            onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
          />
          <Input
            label="End Time"
            type="datetime-local"
            value={blockForm.endTime}
            onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
          />
          <Input
            label="Reason"
            placeholder="e.g., Maintenance, Personal use"
            value={blockForm.blockReason}
            onChange={(e) => setBlockForm({ ...blockForm, blockReason: e.target.value })}
          />
          <Input
            label="Notes (optional)"
            placeholder="Additional notes"
            value={blockForm.notes}
            onChange={(e) => setBlockForm({ ...blockForm, notes: e.target.value })}
          />
          <div className="flex gap-3 pt-4">
            <Button onClick={() => setShowBlockModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleBlockSlot} className="flex-1">
              Block Time
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Slot Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Blocked Slot">
        <div className="space-y-4">
          <Input
            label="Start Time"
            type="datetime-local"
            value={blockForm.startTime}
            onChange={(e) => setBlockForm({ ...blockForm, startTime: e.target.value })}
          />
          <Input
            label="End Time"
            type="datetime-local"
            value={blockForm.endTime}
            onChange={(e) => setBlockForm({ ...blockForm, endTime: e.target.value })}
          />
          <Input
            label="Reason"
            value={blockForm.blockReason}
            onChange={(e) => setBlockForm({ ...blockForm, blockReason: e.target.value })}
          />
          <Input
            label="Notes"
            value={blockForm.notes}
            onChange={(e) => setBlockForm({ ...blockForm, notes: e.target.value })}
          />
          <div className="flex gap-3 pt-4">
            <Button onClick={() => setShowEditModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleUpdateSlot} className="flex-1">
              Save Changes
            </Button>
          </div>
        </div>
      </Modal>

      {/* Generate Slots Modal */}
      <Modal isOpen={showGenerateModal} onClose={() => setShowGenerateModal(false)} title="Generate Available Slots">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Start Date"
              type="date"
              value={generateForm.startDate}
              onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
            />
            <Input
              label="End Date"
              type="date"
              value={generateForm.endDate}
              onChange={(e) => setGenerateForm({ ...generateForm, endDate: e.target.value })}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Slot Duration (hours)"
              type="number"
              min="1"
              max="12"
              value={generateForm.slotDuration}
              onChange={(e) => setGenerateForm({ ...generateForm, slotDuration: parseInt(e.target.value) })}
            />
            <div></div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Daily Start Hour"
              type="number"
              min="0"
              max="23"
              value={generateForm.dailyStartHour}
              onChange={(e) => setGenerateForm({ ...generateForm, dailyStartHour: parseInt(e.target.value) })}
            />
            <Input
              label="Daily End Hour"
              type="number"
              min="1"
              max="24"
              value={generateForm.dailyEndHour}
              onChange={(e) => setGenerateForm({ ...generateForm, dailyEndHour: parseInt(e.target.value) })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Exclude Days</label>
            <div className="flex flex-wrap gap-2">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                <label key={index} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={generateForm.excludedDays.includes(index)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setGenerateForm({
                          ...generateForm,
                          excludedDays: [...generateForm.excludedDays, index],
                        });
                      } else {
                        setGenerateForm({
                          ...generateForm,
                          excludedDays: generateForm.excludedDays.filter((d) => d !== index),
                        });
                      }
                    }}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm">{day}</span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button onClick={() => setShowGenerateModal(false)} variant="outline" className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleGenerateSlots} className="flex-1">
              Generate Slots
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ManageSlots;
