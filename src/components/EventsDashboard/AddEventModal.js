import React from 'react';

const COMMON_TIMES = [
  '9:00 AM - 12:00 PM',
  '9:00 AM - 3:00 PM',
  '10:00 AM - 12:00 PM',
  '12:00 PM - 1:00 PM',
  '12:00 PM - 2:00 PM',
  '12:30 PM - 2:00 PM',
  '1:00 PM - 2:00 PM',
  '1:00 PM - 3:00 PM',
  '2:00 PM - 3:00 PM',
  '2:30 PM - 3:30 PM',
  '2:30 PM - 4:00 PM',
  '3:00 PM - 5:00 PM',
  '4:00 PM - 5:00 PM',
  '4:00 PM - 6:00 PM',
  '5:00 PM - 7:00 PM',
  '5:30 PM - 7:30 PM',
  '5:30 PM - 8:00 PM',
  '5:30 PM - 8:30 PM',
  '5:30 PM - 9:00 PM',
  '6:00 PM - 7:00 PM',
  '6:00 PM - 8:00 PM',
  '6:00 PM - 8:30 PM',
  '6:00 PM - 9:00 PM',
  '6:00 PM - 9:30 PM',
  '6:00 PM - 10:00 PM',
  '6:15 PM - 7:15 PM',
  '6:30 PM - 7:30 PM',
  '6:30 PM - 8:30 PM',
  '6:30 PM - 9:00 PM',
  '6:30 PM - 9:30 PM',
  '6:30 PM - 10:00 PM',
  '7:00 PM - 9:00 PM',
  '7:00 PM - 9:30 PM',
  '7:00 PM - 10:00 PM',
  '7:30 PM - 9:30 PM',
];

export default function AddEventModal({
  theme,
  gymsList,
  newEvent,
  setNewEvent,
  editingEvent,
  setEditingEvent,
  onClose,
  onAdd,
  onDelete,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4" style={{ color: theme.colors.textPrimary }}>
          {editingEvent ? 'Edit Event' : 'Add New Event'}
        </h2>

        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-700">
            <strong>All fields marked with * are required.</strong> The URL is especially important - this is the whole purpose of tracking events!
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Gym <span className="text-red-500">*</span>
            </label>
            <select
              value={newEvent.gym_id}
              onChange={(e) => setNewEvent({ ...newEvent, gym_id: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-pink-300"
              required
            >
              <option value="">Select Gym</option>
              {gymsList.map((gym) => (
                <option key={gym.id} value={gym.id}>
                  {gym.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Event Category <span className="text-red-500">*</span>
            </label>
            <select
              value={newEvent.type}
              onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-pink-300"
              required
            >
              <option value="">Select Type</option>
              <option value="CLINIC">Clinic</option>
              <option value="KIDS NIGHT OUT">Kids Night Out</option>
              <option value="OPEN GYM">Open Gym</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Event Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-pink-300"
              placeholder="e.g., Ninja Night Out"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={newEvent.date}
              onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-pink-300"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Time <span className="text-red-500">*</span>
            </label>
            <select
              value={newEvent.time}
              onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-pink-300"
              required
            >
              <option value="">Select Time</option>
              {COMMON_TIMES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">If you need a different time, contact the admin</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Price (optional)</label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={newEvent.price}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  setNewEvent({ ...newEvent, price: value });
                }}
                className="w-full pl-8 pr-2 py-2 border rounded-lg focus:ring-2 focus:ring-pink-300"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Enter numbers only (e.g., 35 or 35.00)</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Registration URL <span className="text-red-500">* REQUIRED</span>
            </label>
            <input
              type="url"
              value={newEvent.event_url}
              onChange={(e) => setNewEvent({ ...newEvent, event_url: e.target.value })}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-pink-300 border-red-300"
              placeholder="https://portal.iclasspro.com/..."
              required
            />
            <p className="text-xs text-red-600 mt-1">
              This is the most important field - the whole purpose is to collect the URL!
            </p>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => {
              onClose();
              setEditingEvent(null);
              setNewEvent({
                gym_id: '',
                title: '',
                date: '',
                time: '',
                price: '',
                type: '',
                event_url: '',
              });
            }}
            className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onAdd}
            disabled={
              !newEvent.gym_id ||
              !newEvent.type ||
              !newEvent.title ||
              !newEvent.date ||
              !newEvent.time ||
              !newEvent.event_url
            }
            className="flex-1 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: theme.colors.primary, color: 'white' }}
          >
            {editingEvent ? 'Update Event' : 'Add Event'}
          </button>

          {editingEvent && (
            <button
              onClick={() => onDelete(editingEvent.id, editingEvent.title)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Delete Event
            </button>
          )}
        </div>
      </div>
    </div>
  );
}



