import React, { useState, useEffect } from 'react';
import { futurePlansApi } from '../../lib/api';

const CATEGORIES = [
  { value: 'feature', label: 'New Feature', color: 'bg-blue-100 text-blue-700' },
  { value: 'bug_fix', label: 'Bug Fix', color: 'bg-red-100 text-red-700' },
  { value: 'improvement', label: 'Improvement', color: 'bg-purple-100 text-purple-700' },
  { value: 'idea', label: 'Idea', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'expansion', label: 'Expansion', color: 'bg-green-100 text-green-700' },
];

const PRIORITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500 text-white' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-600' },
];

const STATUSES = [
  { value: 'planning', label: 'Planning', color: 'text-gray-500' },
  { value: 'ready', label: 'Ready to Build', color: 'text-blue-600' },
  { value: 'in_progress', label: 'In Progress', color: 'text-orange-600' },
  { value: 'completed', label: 'Completed', color: 'text-green-600' },
  { value: 'on_hold', label: 'On Hold', color: 'text-gray-400' },
];

const TARGET_AREAS = [
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'database', label: 'Database' },
  { value: 'validation', label: 'Validation' },
  { value: 'admin', label: 'Admin Dashboard' },
  { value: 'sync', label: 'Sync/Scraping' },
  { value: 'docs', label: 'Documentation' },
];

function getCategoryStyle(cat) {
  return CATEGORIES.find(c => c.value === cat)?.color || 'bg-gray-100 text-gray-700';
}
function getPriorityStyle(pri) {
  return PRIORITIES.find(p => p.value === pri)?.color || 'bg-gray-100 text-gray-600';
}
function getStatusStyle(stat) {
  return STATUSES.find(s => s.value === stat)?.color || 'text-gray-500';
}
function getStatusIcon(stat) {
  if (stat === 'completed') return '\u2705';
  if (stat === 'in_progress') return '\u{1F528}';
  if (stat === 'ready') return '\u{1F680}';
  if (stat === 'on_hold') return '\u23F8\uFE0F';
  return '\u{1F4CB}';
}

export default function AdminFuturePlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('active'); // active, completed, all
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', category: 'feature', priority: 'medium',
    status: 'planning', target_area: '', notes: '', added_by: 'manual'
  });

  const loadPlans = async () => {
    setLoading(true);
    try {
      const data = await futurePlansApi.getAll();
      setPlans(data);
    } catch (err) {
      console.error('Error loading future plans:', err);
    }
    setLoading(false);
  };

  useEffect(() => { loadPlans(); }, []);

  const resetForm = () => {
    setFormData({
      title: '', description: '', category: 'feature', priority: 'medium',
      status: 'planning', target_area: '', notes: '', added_by: 'manual'
    });
    setEditingPlan(null);
    setShowForm(false);
  };

  const handleEdit = (plan) => {
    setFormData({
      title: plan.title || '',
      description: plan.description || '',
      category: plan.category || 'feature',
      priority: plan.priority || 'medium',
      status: plan.status || 'planning',
      target_area: plan.target_area || '',
      notes: plan.notes || '',
      added_by: plan.added_by || 'manual'
    });
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
    try {
      if (editingPlan) {
        const updated = await futurePlansApi.update(editingPlan.id, formData);
        setPlans(prev => prev.map(p => p.id === editingPlan.id ? updated : p));
      } else {
        const created = await futurePlansApi.create(formData);
        setPlans(prev => [created, ...prev]);
      }
      resetForm();
    } catch (err) {
      console.error('Error saving plan:', err);
      alert('Failed to save: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this plan?')) return;
    try {
      await futurePlansApi.delete(id);
      setPlans(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting plan:', err);
      alert('Failed to delete.');
    }
  };

  const handleStatusChange = async (plan, newStatus) => {
    try {
      const updated = await futurePlansApi.update(plan.id, { status: newStatus });
      setPlans(prev => prev.map(p => p.id === plan.id ? updated : p));
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const filteredPlans = plans.filter(p => {
    if (filter === 'active') return p.status !== 'completed';
    if (filter === 'completed') return p.status === 'completed';
    return true;
  });

  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedPlans = [...filteredPlans].sort((a, b) => {
    return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
  });

  const counts = {
    active: plans.filter(p => p.status !== 'completed').length,
    completed: plans.filter(p => p.status === 'completed').length,
    total: plans.length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Future Plans & Ideas</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Track planned features, improvements, and ideas for the system
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm flex items-center gap-1.5 self-start"
        >
          + Add Plan
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'active', label: `Active (${counts.active})` },
          { key: 'completed', label: `Completed (${counts.completed})` },
          { key: 'all', label: `All (${counts.total})` },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              filter === f.key
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-xl border-2 border-blue-200 p-4 sm:p-6 shadow-sm">
          <h3 className="text-lg font-bold text-gray-800 mb-4">
            {editingPlan ? 'Edit Plan' : 'Add New Plan'}
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                placeholder="What needs to be done?"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                rows={3}
                placeholder="Details, context, why this matters..."
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Area</label>
                <select
                  value={formData.target_area}
                  onChange={e => setFormData(prev => ({ ...prev, target_area: e.target.value }))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">-- Select --</option>
                  {TARGET_AREAS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-sm"
                rows={2}
                placeholder="Any additional notes, links, or context..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
              >
                {editingPlan ? 'Save Changes' : 'Add Plan'}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plans List */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading plans...</div>
      ) : sortedPlans.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No plans yet. Click "Add Plan" to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {sortedPlans.map(plan => (
            <div
              key={plan.id}
              className={`bg-white rounded-lg border p-4 hover:shadow-sm transition-shadow ${
                plan.status === 'completed' ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Status icon + quick toggle */}
                <div className="pt-0.5">
                  <select
                    value={plan.status}
                    onChange={e => handleStatusChange(plan, e.target.value)}
                    className="text-lg bg-transparent border-none cursor-pointer p-0 appearance-none"
                    title="Change status"
                    style={{ WebkitAppearance: 'none', width: '28px' }}
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{getStatusIcon(s.value)} {s.label}</option>
                    ))}
                  </select>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`font-semibold text-sm ${
                      plan.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'
                    }`}>
                      {plan.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getCategoryStyle(plan.category)}`}>
                      {CATEGORIES.find(c => c.value === plan.category)?.label || plan.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getPriorityStyle(plan.priority)}`}>
                      {plan.priority}
                    </span>
                    {plan.target_area && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                        {TARGET_AREAS.find(a => a.value === plan.target_area)?.label || plan.target_area}
                      </span>
                    )}
                    <span className={`text-xs font-semibold ${getStatusStyle(plan.status)}`}>
                      {STATUSES.find(s => s.value === plan.status)?.label || plan.status}
                    </span>
                  </div>

                  {plan.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{plan.description}</p>
                  )}
                  {plan.notes && (
                    <p className="text-xs text-gray-400 mt-1 italic">Note: {plan.notes}</p>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                    <span>Added {plan.added_by === 'ai_session' ? 'by AI' : plan.added_by === 'jayme' ? 'by Jayme' : 'manually'}</span>
                    <span>{new Date(plan.created_at).toLocaleDateString()}</span>
                    {plan.completed_at && (
                      <span className="text-green-500">Completed {new Date(plan.completed_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleEdit(plan)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Delete"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
