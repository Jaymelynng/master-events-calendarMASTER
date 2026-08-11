// ============================================================================
// BulkLinksHub — The 📦 Bulk Links tab inside Calendar.
// ============================================================================
// Faithful port of Bulk Link PRO's DynamicPage UX. Layout:
//   - Rose-pink gradient header with pill-shaped page tabs
//   - Left sidebar: 10 brand-color gym tiles + search + Select All/Clear
//   - Main:
//       1) Title + 1/2/3 instructions
//       2) Action bar (Open / Copy) with Select-All-Fields / Clear-All
//       3) Section picker grid (bulk-select fields across all gyms)
//       4) "All Gym Profiles" h2
//       5) Per-gym profile cards (drop-open sections inside)
//       6) Floating scroll-to-top button
//
// Class strings and palette copied verbatim from
// `client/src/pages/DynamicPage.tsx` in the Bulk Link PRO repo.
// ============================================================================

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { ExternalLink, Copy, Loader, Search, ArrowUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  bulkPagesApi,
  bulkPageDataApi,
  getCopyValue,
  getOpenUrl,
} from '../../lib/bulkLinksApi';
import GymProfileCard from './GymProfileCard';
import SectionPickerCard from './SectionPickerCard';

const HEADER_FROM = '#b48f8f';
const HEADER_TO = '#a38580';

const BulkLinksHub = () => {
  const [pages, setPages] = useState([]);
  const [activeSlug, setActiveSlug] = useState(null);
  const [pageData, setPageData] = useState(null);
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selection
  const [selectedGymIds, setSelectedGymIds] = useState(new Set());
  const [selectedFieldIds, setSelectedFieldIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);
  const [toast, setToast] = useState(null);

  // Refs for scroll behavior
  const mainRef = useRef(null);
  const gymRefs = useRef({});
  const [showScrollTop, setShowScrollTop] = useState(false);

  // ── Load pages + gyms on mount ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const [pageRows, gymRes] = await Promise.all([
          bulkPagesApi.getAll(),
          supabase.from('gyms').select('id, name, logo_url, brand_colors').order('id'),
        ]);
        if (!alive) return;
        if (gymRes.error) throw new Error(gymRes.error.message);
        setPages(pageRows);
        setGyms(gymRes.data || []);
        if (pageRows.length > 0) setActiveSlug(pageRows[0].slug);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Whenever active page changes, load its data ──
  useEffect(() => {
    if (!activeSlug) return;
    let alive = true;
    (async () => {
      try {
        setSelectedFieldIds(new Set());
        setPageData(null);
        const data = await bulkPageDataApi.getBySlug(activeSlug);
        if (!alive) return;
        setPageData(data);
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => { alive = false; };
  }, [activeSlug]);

  // ── Scroll-to-top button visibility ──
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 300);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, [pageData]);

  // ── Helpers ──
  const filteredGyms = useMemo(() => {
    if (!search.trim()) return gyms;
    const q = search.trim().toLowerCase();
    return gyms.filter(
      (g) => g.id.toLowerCase().includes(q) || (g.name || '').toLowerCase().includes(q)
    );
  }, [gyms, search]);

  const gymsInScope = useMemo(() => {
    if (selectedGymIds.size === 0) return gyms;
    return gyms.filter((g) => selectedGymIds.has(g.id));
  }, [gyms, selectedGymIds]);

  const allFieldIds = useMemo(() => {
    if (!pageData) return [];
    return pageData.sections.flatMap((s) => s.fields.map((f) => f.id));
  }, [pageData]);

  const toggleField = (fieldId) => {
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      next.has(fieldId) ? next.delete(fieldId) : next.add(fieldId);
      return next;
    });
  };

  const toggleGym = (gymId) => {
    setSelectedGymIds((prev) => {
      const next = new Set(prev);
      next.has(gymId) ? next.delete(gymId) : next.add(gymId);
      return next;
    });
  };

  const selectAllGyms = () => setSelectedGymIds(new Set(filteredGyms.map((g) => g.id)));
  const clearGyms = () => setSelectedGymIds(new Set());

  const selectAllInSection = (sectionId) => {
    if (!pageData) return;
    const section = pageData.sections.find((s) => s.id === sectionId);
    if (!section) return;
    setSelectedFieldIds((prev) => {
      const next = new Set(prev);
      const allOn = section.fields.every((f) => next.has(f.id));
      section.fields.forEach((f) => (allOn ? next.delete(f.id) : next.add(f.id)));
      return next;
    });
  };

  const toggleAllFields = () => {
    if (!pageData) return;
    if (selectedFieldIds.size === allFieldIds.length) {
      setSelectedFieldIds(new Set());
    } else {
      setSelectedFieldIds(new Set(allFieldIds));
    }
  };

  const clearAll = () => {
    setSelectedGymIds(new Set());
    setSelectedFieldIds(new Set());
  };

  // ── Scroll to a gym's card on sidebar click ──
  const scrollToGym = (gymId) => {
    const el = gymRefs.current[gymId];
    if (el && mainRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToTop = () => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Counters ──
  const { globalOpenCount, globalCopyCount } = useMemo(() => {
    if (!pageData) return { globalOpenCount: 0, globalCopyCount: 0 };
    let open = 0;
    let copy = 0;
    gymsInScope.forEach((gym) => {
      pageData.sections.forEach((section) => {
        section.fields.forEach((field) => {
          if (!selectedFieldIds.has(field.id)) return;
          const values =
            (pageData.valuesByFieldAndLocation[field.id] &&
              pageData.valuesByFieldAndLocation[field.id][gym.id]) || [];
          values.forEach((v) => {
            if (getOpenUrl(field, v)) open++;
            if (getCopyValue(field, v)) copy++;
          });
        });
      });
    });
    return { globalOpenCount: open, globalCopyCount: copy };
  }, [pageData, gymsInScope, selectedFieldIds]);

  const handleOpenAll = () => {
    if (!pageData || globalOpenCount === 0) return;
    const urls = [];
    gymsInScope.forEach((gym) => {
      pageData.sections.forEach((section) => {
        section.fields.forEach((field) => {
          if (!selectedFieldIds.has(field.id)) return;
          const values =
            (pageData.valuesByFieldAndLocation[field.id] &&
              pageData.valuesByFieldAndLocation[field.id][gym.id]) || [];
          values.forEach((v) => {
            const url = getOpenUrl(field, v);
            if (url) urls.push(url);
          });
        });
      });
    });
    urls.forEach((u) => window.open(u, '_blank', 'noopener,noreferrer'));
    setToast(`Opened ${urls.length} link(s)`);
    setTimeout(() => setToast(null), 2000);
  };

  const handleCopyAll = async () => {
    if (!pageData || globalCopyCount === 0) return;
    let output = '';
    gymsInScope.forEach((gym) => {
      const lines = [];
      pageData.sections.forEach((section) => {
        const selected = section.fields.filter((f) => selectedFieldIds.has(f.id));
        if (selected.length === 0) return;
        const sectionLines = [];
        selected.forEach((field) => {
          const values =
            (pageData.valuesByFieldAndLocation[field.id] &&
              pageData.valuesByFieldAndLocation[field.id][gym.id]) || [];
          values.forEach((v) => {
            const cv = getCopyValue(field, v);
            if (cv) sectionLines.push(`${field.emoji || ''} ${field.label}: ${cv}`);
          });
        });
        if (sectionLines.length > 0) {
          lines.push(section.title);
          lines.push(...sectionLines);
        }
      });
      if (lines.length > 0) {
        output += `${'═'.repeat(40)}\n${gym.name} (${gym.id})\n${lines.join('\n')}\n`;
      }
    });
    try {
      await navigator.clipboard.writeText(output.trim());
      setToast(`Copied ${globalCopyCount} item(s)`);
      setTimeout(() => setToast(null), 2000);
    } catch (err) {
      setError(`Copy failed: ${err.message}`);
    }
  };

  const copySingleValue = async (gymId, field, value) => {
    const cv = getCopyValue(field, value);
    if (!cv) return;
    try {
      await navigator.clipboard.writeText(cv);
      const key = `${gymId}-${field.id}-${value.id}`;
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Copy failed', err);
    }
  };

  // ── Loading / error states ──
  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#f8f5f2]">
        <div className="text-center">
          <Loader className="w-10 h-10 animate-spin text-[#b48f8f] mx-auto mb-3" />
          <p className="text-[#6b5444]">Loading Bulk Links…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#f8f5f2]">
        <div className="max-w-md p-6 bg-white rounded-lg border border-red-200 shadow-sm">
          <h2 className="text-lg font-bold text-red-600 mb-2">Couldn't load Bulk Links</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <p className="text-xs text-gray-500">Use the "📅 Calendar" tab in the top nav to return.</p>
        </div>
      </div>
    );
  }

  const activePage = pages.find((p) => p.slug === activeSlug);
  const pageColor = activePage?.active_color || '#b48f8f';
  const allFieldsSelected = pageData && selectedFieldIds.size === allFieldIds.length && allFieldIds.length > 0;

  return (
    <div className="min-h-screen bg-[#f8f5f2]">
      {/* ───────── Rose-pink hero header with pill tabs ───────── */}
      <header
        className="text-white shadow-xl"
        style={{ background: `linear-gradient(to right, ${HEADER_FROM}, ${HEADER_TO})` }}
      >
        <div className="flex items-center px-4 py-2 gap-3 flex-wrap">
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-base font-bold whitespace-nowrap">📦 Bulk Link Pro</span>
            <span className="text-xs font-medium bg-white/20 px-2 py-0.5 rounded-full">
              {gyms.length} Gyms
            </span>
          </div>

          <div className="flex-1 flex justify-center">
            <nav
              className="flex bg-black/30 rounded-2xl p-1.5 gap-1.5 shadow-lg border border-white/10 flex-wrap"
              aria-label="Bulk Links pages"
            >
              {pages.map((page) => {
                const isActive = page.slug === activeSlug;
                return (
                  <button
                    key={page.id}
                    onClick={() => setActiveSlug(page.slug)}
                    className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 border-2 whitespace-nowrap ${
                      isActive
                        ? 'text-white shadow-xl scale-105 border-white/40'
                        : 'bg-white/10 text-white/90 border-transparent hover:bg-white/20 hover:border-white/20 hover:shadow-md'
                    }`}
                    style={isActive ? { backgroundColor: page.active_color || '#9b6b6b' } : undefined}
                  >
                    <span className="text-sm">{page.emoji}</span>
                    <span>{page.title}</span>
                    {/* Selection-count badge — shows N selected fields on THIS tab */}
                    {isActive && selectedFieldIds.size > 0 && (
                      <span className="ml-1 bg-white/30 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {selectedFieldIds.size}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="w-16 shrink-0" />
        </div>
      </header>

      {/* ───────── Body: sidebar + main ───────── */}
      <div className="flex" style={{ height: 'calc(100vh - 110px)' }}>
        {/* SIDEBAR */}
        <aside className="w-52 shrink-0 border-r border-[#d4c4b8] bg-gradient-to-b from-[#f5f0eb] to-[#ebe3db] flex flex-col shadow-lg">
          <div className="p-3 border-b border-[#d4c4b8]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-[#6b5444]">🏢 Gyms</h2>
              <span
                className="text-xs text-white px-2 py-0.5 rounded-full"
                style={{ backgroundColor: pageColor }}
              >
                {selectedGymIds.size} selected
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-[#b48f8f]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full h-8 pl-7 pr-2 text-sm bg-white/80 border border-[#d4c4b8] rounded-md focus:outline-none focus:ring-2 focus:ring-[#b48f8f]"
                aria-label="Search gyms"
              />
            </div>

            <div className="flex gap-1 mt-2">
              <button
                onClick={selectAllGyms}
                className="flex-1 h-7 text-xs bg-[#8b7355] hover:bg-[#6b5444] text-white rounded-md font-semibold transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearGyms}
                className="flex-1 h-7 text-xs border border-[#b48f8f] text-[#6b5444] hover:bg-[#f5f0eb] rounded-md font-semibold transition-colors"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredGyms.map((gym) => {
              const isSelected = selectedGymIds.has(gym.id);
              const color = (gym.brand_colors && gym.brand_colors[0]) || '#b48f8f';
              return (
                <div
                  key={gym.id}
                  className={`w-full px-3 py-2 rounded-xl transition-all text-sm flex items-center gap-2 border-2 ${
                    isSelected
                      ? 'text-white shadow-lg ring-2 ring-white/50'
                      : 'text-white hover:shadow-md hover:brightness-110'
                  }`}
                  style={{ backgroundColor: color, borderColor: isSelected ? 'white' : color }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleGym(gym.id)}
                    className="w-3.5 h-3.5 accent-white"
                    aria-label={`Select ${gym.id}`}
                  />
                  <button
                    onClick={() => scrollToGym(gym.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                    aria-label={`Scroll to ${gym.name}`}
                  >
                    {gym.logo_url ? (
                      <img
                        src={gym.logo_url}
                        alt={gym.id}
                        className="w-7 h-7 rounded-full object-contain bg-white flex-shrink-0"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                        {gym.id}
                      </div>
                    )}
                    <span className="font-semibold">{gym.id}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        {/* MAIN */}
        <main
          ref={mainRef}
          className="flex-1 min-w-0 overflow-auto bg-gradient-to-br from-[#f8f5f2] to-[#f0ebe5] relative"
        >
          <div className="p-3">
            {/* Title + 1/2/3 instructions */}
            <div className="text-center mb-2">
              <h1 className="text-lg font-bold text-[#6b5444]">
                {activePage?.emoji || '📋'} {activePage?.title}
              </h1>
              <p className="text-sm text-[#8b7355] mb-2">
                1️⃣ Select gyms → 2️⃣ Select fields → 3️⃣ <strong>Open Links</strong> or{' '}
                <strong>Copy Data</strong>
              </p>

              <div className="flex flex-col items-center gap-2">
                <div className="flex gap-2 bg-white rounded-xl p-2 border-2 border-[#d4c4b8] shadow-sm">
                  <button
                    onClick={handleOpenAll}
                    disabled={globalOpenCount === 0}
                    className={`flex items-center gap-2 h-10 px-4 text-sm font-bold rounded-md shadow-md transition-all duration-200 ${
                      globalOpenCount === 0
                        ? 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300 cursor-not-allowed'
                        : 'text-white hover:shadow-lg hover:scale-105 active:translate-y-px border-2'
                    }`}
                    style={
                      globalOpenCount > 0
                        ? { backgroundColor: pageColor, borderColor: pageColor }
                        : undefined
                    }
                  >
                    <ExternalLink className="w-5 h-5" />
                    {globalOpenCount === 0
                      ? 'Open Links (select items)'
                      : `Open ${globalOpenCount} Links`}
                  </button>
                  <button
                    onClick={handleCopyAll}
                    disabled={globalCopyCount === 0}
                    className={`flex items-center gap-2 h-10 px-4 text-sm font-bold rounded-md shadow-md transition-all duration-200 ${
                      globalCopyCount === 0
                        ? 'bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300 cursor-not-allowed'
                        : 'bg-[#b48f8f] hover:bg-[#9d7a7a] text-white hover:shadow-lg hover:scale-105 active:translate-y-px border-2 border-[#b48f8f]'
                    }`}
                  >
                    <Copy className="w-5 h-5" />
                    {globalCopyCount === 0
                      ? 'Copy Data (select items)'
                      : `Copy ${globalCopyCount} Items`}
                  </button>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={toggleAllFields}
                    className="bg-[#8b7355] hover:bg-[#6b5444] text-white gap-1.5 h-7 text-xs font-semibold border-0 shadow-md hover:shadow-lg active:translate-y-px transition-all duration-200 inline-flex items-center px-3 rounded-md"
                  >
                    {allFieldsSelected ? '✓ Deselect All Fields' : '☐ Select All Fields'}
                  </button>
                  <button
                    onClick={clearAll}
                    disabled={selectedGymIds.size === 0 && selectedFieldIds.size === 0}
                    className={`inline-flex items-center px-3 gap-1.5 h-7 text-xs font-semibold rounded-md transition-all border ${
                      selectedGymIds.size === 0 && selectedFieldIds.size === 0
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-[#6b5444] border-[#b48f8f] hover:bg-red-50 hover:border-red-300 hover:text-red-600'
                    }`}
                  >
                    ✕ Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Section picker grid */}
            {pageData && pageData.sections.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                {pageData.sections.map((section) => (
                  <SectionPickerCard
                    key={section.id}
                    section={section}
                    selectedFieldIds={selectedFieldIds}
                    onToggleField={toggleField}
                    onSelectAllInSection={selectAllInSection}
                  />
                ))}
              </div>
            )}

            {/* All Gym Profiles */}
            {!pageData ? (
              <div className="flex items-center justify-center py-20">
                <Loader className="w-6 h-6 animate-spin text-[#b48f8f]" />
              </div>
            ) : pageData.sections.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p>No sections on this page yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-bold text-[#6b5444]">All Gym Profiles</h2>
                {gyms.map((gym) => (
                  <div
                    key={gym.id}
                    ref={(el) => {
                      gymRefs.current[gym.id] = el;
                    }}
                  >
                    <GymProfileCard
                      gym={gym}
                      sections={pageData.sections}
                      valuesByFieldAndLocation={pageData.valuesByFieldAndLocation}
                      selectedFieldIds={selectedFieldIds}
                      onToggleField={toggleField}
                      onCopySingleValue={copySingleValue}
                      copiedKey={copiedKey}
                      isSelected={selectedGymIds.has(gym.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Floating scroll-to-top */}
          {showScrollTop && (
            <button
              onClick={scrollToTop}
              className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-[#b48f8f] hover:bg-[#9d7a7a] text-white shadow-lg z-50 flex items-center justify-center"
              aria-label="Scroll to top"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </main>
      </div>

      {/* Toast — top-right so it doesn't collide with the scroll-to-top button */}
      {toast && (
        <div
          className="fixed top-6 right-6 bg-gray-900 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-in fade-in slide-in-from-top-4"
          role="status"
        >
          ✓ {toast}
        </div>
      )}
    </div>
  );
};

export default BulkLinksHub;
