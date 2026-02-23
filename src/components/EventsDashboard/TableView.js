// ============================================================================
// TABLE VIEW - Alternative view showing events in a table format
// ============================================================================
import React from 'react';
import { theme, getEventTypeColor } from './constants';
import { formatTime, parseYmdLocal } from './utils';

export default function TableView({
  filteredEvents
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b bg-gray-50">
        <h3 className="text-lg font-semibold" style={{ color: theme.colors.textPrimary }}>
          Events Table View ({filteredEvents.length} events)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Gym</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredEvents.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  <div className="flex flex-col items-center">
                    <div className="text-4xl mb-4">📅</div>
                    <div className="text-lg font-medium">No events found</div>
                    <div className="text-sm">Try adjusting your filters or check the database connection</div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {parseYmdLocal(event.date).toLocaleDateString()}
                    {event.end_date && event.end_date !== event.start_date && event.end_date !== event.date && (
                      <span className="text-gray-400 ml-1">– {parseYmdLocal(event.end_date).toLocaleDateString()}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="font-medium">{event.title || 'Untitled Event'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: getEventTypeColor(event.type || event.event_type),
                        color: '#374151'
                      }}
                    >
                      {event.type || event.event_type || 'No Type'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {event.gym_name || event.gym_code || 'Unknown Gym'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatTime(event.time || event.event_time)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {event.price ? `$${event.price}` : <span className="text-gray-500 italic">No price set</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {event.event_url && (
                        <button
                          onClick={() => window.open(event.event_url, '_blank')}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          View
                        </button>
                      )}
                      {event.registration_url && (
                        <button
                          onClick={() => window.open(event.registration_url, '_blank')}
                          className="text-green-600 hover:text-green-900"
                        >
                          Register
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
