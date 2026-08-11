import React, { useMemo, useState } from "react";

const goals = { clinic: 1, kno: 2, openGym: 1 };

const gymRows = [
  {
    gym: "Capital Gymnastics Cedar Park",
    code: "CCP",
    clinic: 5,
    kno: 2,
    openGym: 2,
    issues: 1,
    links: {
      booking: "https://portal.iclasspro.com/capgymavery/booking",
      kno: "https://portal.iclasspro.com/capgymavery/camps/13?sortBy=time",
      openGym: "https://portal.iclasspro.com/capgymavery/camps/17?sortBy=time",
      clinic: "https://portal.iclasspro.com/capgymavery/camps/7?sortBy=time",
      summerFull: "https://portal.iclasspro.com/capgymavery/camps/1?sortBy=time",
      summerHalf: "https://portal.iclasspro.com/capgymavery/camps/21?sortBy=time",
    },
  },
  {
    gym: "Capital Gymnastics Pflugerville",
    code: "CPF",
    clinic: 1,
    kno: 2,
    openGym: 6,
    issues: 1,
    links: {
      booking: "https://portal.iclasspro.com/capgymhp/booking",
      kno: "https://portal.iclasspro.com/capgymhp/camps/2?sortBy=time",
      openGym: "https://portal.iclasspro.com/capgymhp/camps/81?sortBy=time",
      clinic: "https://portal.iclasspro.com/capgymhp/camps/63?sortBy=time",
      summerFull: "https://portal.iclasspro.com/capgymhp/camps/8?sortBy=time",
      summerHalf: "https://portal.iclasspro.com/capgymhp/camps/84?sortBy=time",
    },
  },
  {
    gym: "Capital Gymnastics Round Rock",
    code: "CRR",
    clinic: 3,
    kno: 2,
    openGym: 4,
    issues: 4,
    links: {
      booking: "https://portal.iclasspro.com/capgymroundrock/booking",
      kno: "https://portal.iclasspro.com/capgymroundrock/camps/26?sortBy=time",
      openGym: "https://portal.iclasspro.com/capgymroundrock/camps/35?sortBy=time",
      clinic: "https://portal.iclasspro.com/capgymroundrock/camps/28?sortBy=time",
      summerFull: "https://portal.iclasspro.com/capgymroundrock/camps/39?sortBy=time",
      summerHalf: "https://portal.iclasspro.com/capgymroundrock/camps/17?sortBy=time",
    },
  },
  {
    gym: "Rowland Ballard Atascocita",
    code: "RBA",
    clinic: 1,
    kno: 3,
    openGym: 1,
    issues: 0,
    links: {
      booking: "https://portal.iclasspro.com/rbatascocita/booking",
      kno: "https://portal.iclasspro.com/rbatascocita/camps/35?sortBy=time",
      openGym: "https://portal.iclasspro.com/rbatascocita/camps/6?sortBy=time",
      clinic: "https://portal.iclasspro.com/rbatascocita/camps/33?sortBy=time",
      summerFull: "https://portal.iclasspro.com/rbatascocita/camps/1?sortBy=time",
      summerHalf: null,
    },
  },
  {
    gym: "Rowland Ballard Kingwood",
    code: "RBK",
    clinic: 2,
    kno: 2,
    openGym: 2,
    issues: 0,
    links: {
      booking: "https://portal.iclasspro.com/rbkingwood/booking",
      kno: "https://portal.iclasspro.com/rbkingwood/camps/26?sortBy=time",
      openGym: "https://portal.iclasspro.com/rbkingwood/camps/6?sortBy=time",
      clinic: "https://portal.iclasspro.com/rbkingwood/camps/31?sortBy=time",
      summerFull: "https://portal.iclasspro.com/rbkingwood/camps/1?sortBy=time",
      summerHalf: null,
    },
  },
  {
    gym: "Houston Gymnastics Academy",
    code: "HGA",
    clinic: 2,
    kno: 2,
    openGym: 1,
    issues: 0,
    links: {
      booking: "https://portal.iclasspro.com/houstongymnastics/booking",
      kno: "https://portal.iclasspro.com/houstongymnastics/camps/7?sortBy=time",
      openGym: "https://portal.iclasspro.com/houstongymnastics/camps/15?sortBy=time",
      clinic: "https://portal.iclasspro.com/houstongymnastics/camps/2?sortBy=time",
      summerFull: "https://portal.iclasspro.com/houstongymnastics/camps/4?sortBy=time",
      summerHalf: null,
    },
  },
  {
    gym: "Estrella Gymnastics",
    code: "EST",
    clinic: 1,
    kno: 2,
    openGym: 2,
    issues: 0,
    links: {
      booking: "https://portal.iclasspro.com/estrellagymnastics/booking",
      kno: "https://portal.iclasspro.com/estrellagymnastics/camps/3?sortBy=time",
      openGym: "https://portal.iclasspro.com/estrellagymnastics/camps/12?sortBy=time",
      clinic: "https://portal.iclasspro.com/estrellagymnastics/camps/24?sortBy=time",
      summerFull: "https://portal.iclasspro.com/estrellagymnastics/camps/18?sortBy=time",
      summerHalf: "https://portal.iclasspro.com/estrellagymnastics/camps/34?sortBy=time",
    },
  },
  {
    gym: "Oasis Gymnastics",
    code: "OAS",
    clinic: 1,
    kno: 2,
    openGym: 6,
    issues: 0,
    links: {
      booking: "https://portal.iclasspro.com/oasisgymnastics/booking",
      kno: "https://portal.iclasspro.com/oasisgymnastics/camps/27?sortBy=time",
      openGym: "https://portal.iclasspro.com/oasisgymnastics/camps/60?sortBy=time",
      clinic: "https://portal.iclasspro.com/oasisgymnastics/camps/33?sortBy=time",
      summerFull: "https://portal.iclasspro.com/oasisgymnastics/camps/45?sortBy=time",
      summerHalf: "https://portal.iclasspro.com/oasisgymnastics/camps/50?sortBy=time",
    },
  },
  {
    gym: "Scottsdale Gymnastics",
    code: "SGT",
    clinic: 1,
    kno: 3,
    openGym: 1,
    issues: 0,
    links: {
      booking: "https://portal.iclasspro.com/scottsdalegymnastics/booking",
      kno: "https://portal.iclasspro.com/scottsdalegymnastics/camps/32?sortBy=time",
      openGym: "https://portal.iclasspro.com/scottsdalegymnastics/camps/5?sortBy=time",
      clinic: "https://portal.iclasspro.com/scottsdalegymnastics/camps/28?sortBy=time",
      summerFull: "https://portal.iclasspro.com/scottsdalegymnastics/camps/38?sortBy=time",
      summerHalf: "https://portal.iclasspro.com/scottsdalegymnastics/camps/39?sortBy=time",
    },
  },
  {
    gym: "Tigar Gymnastics",
    code: "TIG",
    clinic: 1,
    kno: 2,
    openGym: 3,
    issues: 0,
    links: {
      booking: "https://portal.iclasspro.com/tigar/booking",
      kno: "https://portal.iclasspro.com/tigar/camps/8?sortBy=time",
      openGym: "https://portal.iclasspro.com/tigar/camps/22?sortBy=time",
      clinic: "https://portal.iclasspro.com/tigar/camps/2?sortBy=time",
      summerFull: "https://portal.iclasspro.com/tigar/camps/7?sortBy=time",
      summerHalf: null,
    },
  },
];

const bulkGroups = [
  {
    id: "general",
    title: "General Portals",
    icon: "⭐",
    actions: [
      { key: "clinic", icon: "⭐", label: "Clinics", color: "#b99396" },
      { key: "kno", icon: "🌙", label: "KNO", color: "#d5a36d" },
      { key: "openGym", icon: "🎯", label: "Open Gym", color: "#6e936f" },
      { key: "booking", icon: "🌐", label: "Booking", color: "#7da0a3" },
    ],
  },
  {
    id: "school-year",
    title: "School Year Camps",
    icon: "🏫",
    actions: [
      { key: "schoolFull", icon: "🏕️", label: "Full", color: "#c79666" },
      { key: "schoolHalf", icon: "🕐", label: "Half", color: "#9e9e9e" },
    ],
  },
  {
    id: "summer",
    title: "Summer Camps",
    icon: "☀️",
    actions: [
      { key: "summerFull", icon: "☀️", label: "Full", color: "#d7a257" },
      { key: "summerHalf", icon: "🌤️", label: "Half", color: "#c58164" },
    ],
  },
];

const categoryStyles = {
  general: {
    body: "linear-gradient(180deg, #fbf4f4 0%, #f3e7e7 100%)",
    border: "#c9aaaa",
    header: "linear-gradient(180deg, #b99396 0%, #9f777a 100%)",
  },
  "school-year": {
    body: "linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%)",
    border: "#9aaec4",
    header: "linear-gradient(180deg, #6f8198 0%, #46576b 100%)",
  },
  summer: {
    body: "linear-gradient(180deg, #fff2cf 0%, #f6d98f 100%)",
    border: "#d89b2b",
    header: "linear-gradient(180deg, #f0aa2f 0%, #c77918 100%)",
  },
};

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function isComplete(row) {
  return row.clinic >= goals.clinic && row.kno >= goals.kno && row.openGym >= goals.openGym;
}

function openUrls(urls) {
  urls.forEach((url, index) => {
    setTimeout(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    }, index * 90);
  });
}

function CountButton({ value, type, row, onOpen }) {
  const styles = {
    clinic: "bg-[#eadcf8] text-[#263044] border-[#e1cff1]",
    kno: "bg-[#ffbfc0] text-[#263044] border-[#f1aaaa]",
    openGym: "bg-[#bee3c2] text-[#263044] border-[#add5b2]",
  };

  return (
    <button
      onClick={() => onOpen(row, type)}
      className={`min-w-[48px] rounded-md border px-3 py-2 text-base font-black shadow-[0_2px_5px_rgba(85,75,75,.12),inset_0_1px_0_rgba(255,255,255,.55)] transition hover:translate-y-[-1px] ${styles[type]}`}
      title={`Open ${row.code} ${type} page`}
    >
      {value} <span className="text-[11px] opacity-60">↗</span>
    </button>
  );
}

function BulkGroupCard({ group, layout = "row", onOpen }) {
  const isSquare = layout === "square";

  return (
    <div
      className="flex h-full flex-col rounded-lg border p-2 shadow-[0_5px_12px_rgba(75,65,65,.16),inset_0_1px_0_rgba(255,255,255,.85)]"
      style={{
        background: categoryStyles[group.id].body,
        borderColor: categoryStyles[group.id].border,
      }}
    >
      <div
        className="mb-2 flex h-[28px] items-center justify-center gap-2 rounded-md px-2 text-[11px] font-black uppercase tracking-wide text-white shadow-[0_3px_7px_rgba(70,50,50,.22),inset_0_1px_0_rgba(255,255,255,.25)]"
        style={{ background: categoryStyles[group.id].header }}
      >
        <span className="whitespace-nowrap leading-none">
          {group.icon} {group.title}
        </span>
      </div>

      <div className={`grid flex-1 gap-2 ${isSquare ? "grid-cols-2" : group.actions.length === 4 ? "grid-cols-4" : "grid-cols-2"}`}>
        {group.actions.map((action) => {
          const linkCount = gymRows.filter((row) => row.links[action.key]).length;
          const disabled = linkCount === 0;
          const visuallyDisabled = disabled && group.id !== "school-year";

          return (
            <button
              key={action.key}
              onClick={() => !disabled && onOpen(group, action)}
              disabled={disabled}
              className={`flex ${isSquare ? "min-h-[82px]" : "min-h-[58px]"} flex-col items-center justify-center rounded-md border px-2 py-2 text-center text-white transition active:translate-y-[1px] ${
                visuallyDisabled ? "cursor-not-allowed opacity-45" : "hover:translate-y-[-2px]"
              }`}
              style={{
                background: visuallyDisabled
                  ? "linear-gradient(180deg, #b8b8b8, #999999)"
                  : `linear-gradient(180deg, ${hexToRgba(action.color, 0.88)}, ${action.color})`,
                borderColor: visuallyDisabled ? "#999999" : hexToRgba(action.color, 0.95),
                boxShadow: visuallyDisabled
                  ? "0 2px 5px rgba(80,80,80,.2), inset 0 1px 0 rgba(255,255,255,.22)"
                  : `0 4px 9px ${hexToRgba(action.color, 0.32)}, inset 0 1px 0 rgba(255,255,255,.28)`,
              }}
              title={disabled ? "No links provided yet" : `Open ${linkCount} ${action.label} links`}
            >
              <div className="text-lg leading-none drop-shadow-sm">{action.icon}</div>
              <div className="mt-1 text-[11px] font-black leading-tight drop-shadow-sm">{action.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function BulkPortalOpenerPrototype() {
  const [selectedAction, setSelectedAction] = useState("No action yet");
  const [activeRowCode, setActiveRowCode] = useState("CCP");  const liveOpen = false;
  const [previewUrls, setPreviewUrls] = useState([]);

  const runAction = (message, urls) => {
    const validUrls = urls.filter(Boolean);
    setSelectedAction(message);
    setPreviewUrls(validUrls);
    if (liveOpen && validUrls.length) openUrls(validUrls);
  };

  const openBulkAction = (group, action) => {
    const urls = gymRows.map((row) => row.links[action.key]).filter(Boolean);
    runAction(`Open ALL gyms → ${group.title} / ${action.label} (${urls.length} links)`, urls);
  };

  const openGymAll = (row) => {
    setActiveRowCode(row.code);
    const urls = Object.values(row.links).filter(Boolean);
    runAction(`Open ${row.code} → all available pages (${urls.length} links)`, urls);
  };

  const openGymEventPage = (row, type) => {
    const labelMap = { clinic: "Clinics", kno: "KNO", openGym: "Open Gym" };
    const url = row.links[type];
    setActiveRowCode(row.code);
    runAction(`Open ${row.code} → ${labelMap[type]} page`, [url]);
  };

  return (
    <div className="min-h-screen bg-[#eeeeee] p-4 text-slate-900">
      <div className="mx-auto max-w-[1480px]">
        <section className="relative mb-4 overflow-hidden rounded-2xl border border-[#a98588] bg-[#b99396] px-8 py-7 text-white shadow-[0_16px_34px_rgba(82,54,56,.28),inset_0_1px_0_rgba(255,255,255,.32)]">
          <div className="pointer-events-none absolute left-[-100px] top-[-130px] h-[260px] w-[260px] rounded-full bg-white/18 blur-3xl" />
          <div className="pointer-events-none absolute right-[-80px] bottom-[-130px] h-[260px] w-[260px] rounded-full bg-[#fff1df]/18 blur-3xl" />

          <div className="relative text-center">
            <h1 className="text-5xl font-black tracking-tight drop-shadow-[0_4px_4px_rgba(68,38,40,.35)]">
              ✨ Master Events Calendar ✨
            </h1>
            <div className="mt-3 text-lg font-bold text-white/90">
              All gyms special events in one place
            </div>
            <div className="mt-3 text-sm font-black text-white/70">
              Wednesday, May 6, 2026 at 08:55 AM
            </div>
          </div>

          <div className="relative mx-auto mt-7 grid max-w-[980px] gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-white px-6 py-4 text-center text-[#263044] shadow-[0_10px_20px_rgba(66,45,46,.22),inset_0_1px_0_rgba(255,255,255,.9)]">
              <div className="text-2xl font-black">86</div>
              <div className="text-sm font-black text-[#71585a]">Total Events</div>
              <div className="text-xs font-bold text-slate-500">This Month</div>
            </div>
            <div className="rounded-xl bg-white px-6 py-4 text-center text-[#263044] shadow-[0_10px_20px_rgba(66,45,46,.22),inset_0_1px_0_rgba(255,255,255,.9)]">
              <div className="text-2xl font-black">10</div>
              <div className="text-sm font-black text-[#71585a]">Active Gyms</div>
              <div className="text-xs font-bold text-slate-500">This Month</div>
            </div>
            <div className="rounded-xl bg-white px-6 py-4 text-center text-[#263044] shadow-[0_10px_20px_rgba(66,45,46,.22),inset_0_1px_0_rgba(255,255,255,.9)]">
              <div className="text-2xl font-black">10/10</div>
              <div className="text-sm font-black text-[#71585a]">Requirements Met</div>
              <div className="text-xs font-bold text-slate-500">This Month</div>
            </div>
          </div>

          <div className="relative mx-auto mt-4 grid max-w-[820px] gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[#c7dff3] bg-[#dcecf9] px-6 py-4 text-center text-[#1746b8] shadow-[0_9px_18px_rgba(66,45,46,.18),inset_0_1px_0_rgba(255,255,255,.75)]">
              <div className="text-2xl font-black">18</div>
              <div className="text-sm font-black">Clinics</div>
              <div className="text-xs font-bold">This month</div>
            </div>
            <div className="rounded-xl border border-[#decdf2] bg-[#eadcf8] px-6 py-4 text-center text-[#8a20ca] shadow-[0_9px_18px_rgba(66,45,46,.18),inset_0_1px_0_rgba(255,255,255,.75)]">
              <div className="text-2xl font-black">22</div>
              <div className="text-sm font-black">Kids Night Out</div>
              <div className="text-xs font-bold">This month</div>
            </div>
            <div className="rounded-xl border border-[#cce4cf] bg-[#dff0e2] px-6 py-4 text-center text-[#047b3d] shadow-[0_9px_18px_rgba(66,45,46,.18),inset_0_1px_0_rgba(255,255,255,.75)]">
              <div className="text-2xl font-black">28</div>
              <div className="text-sm font-black">Open Gym</div>
              <div className="text-xs font-bold">This month</div>
            </div>
          </div>
        </section>

        <div className="mb-4 flex justify-center gap-4">
          <button className="rounded-lg border border-[#ae8588] bg-[#cfb2b4] px-8 py-3 text-sm font-black tracking-wide text-slate-800 shadow-[0_4px_10px_rgba(73,46,48,.35),inset_0_1px_0_rgba(255,255,255,.55)]">
            🔄 SYNC
          </button>
          <button className="rounded-lg border border-[#1d1d1d] bg-gradient-to-b from-[#565656] to-[#1f1f1f] px-8 py-3 text-sm font-black tracking-wide text-white shadow-[0_4px_10px_rgba(0,0,0,.45),inset_0_1px_0_rgba(255,255,255,.22)]">
            ⬇️ EXPORT
          </button>
          <button
            className="rounded-lg border border-[#d7b5fa] bg-white px-4 py-3 text-sm font-black text-[#a05be8] shadow-[0_3px_8px_rgba(122,79,158,.22),inset_0_1px_0_rgba(255,255,255,.7)]"
            title="Magic tools"
          >
            🪄
          </button>
        </div>

        <section className="rounded-[6px] border border-[#aeb8cc] bg-[#e3e3e3] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_2px_6px_rgba(80,80,90,.11)]">
          <div className="grid gap-3 lg:grid-cols-[1.9fr_.8fr]">
            <div className="rounded-xl border border-[#c5b4b4] bg-[#f5f0f0] p-3 shadow-[0_8px_18px_rgba(90,70,70,.22),inset_0_1px_0_rgba(255,255,255,.8)]">
              <div className="mb-3 flex flex-col items-center gap-2 text-center">
                <div className="rounded-full bg-[#b99396] px-8 py-2 text-base font-black uppercase tracking-wide text-white shadow-[0_7px_16px_rgba(99,62,65,.34),inset_0_1px_0_rgba(255,255,255,.28)]">
                  🚀 Bulk Portal Opener
                </div>
                <div className="rounded-md border border-[#d49b7a] bg-[#fff5ed] px-4 py-2 text-xs font-black text-[#7c5a50] shadow-[0_2px_4px_rgba(120,82,68,.12)]">
                  ⚠️ Allow pop-ups for live open
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-[1.36fr_.82fr_.82fr]">
                {bulkGroups.map((group) => (
                  <BulkGroupCard key={group.id} group={group} layout="row" onOpen={openBulkAction} />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#c5b4b4] bg-[#f7f3f3] p-3 shadow-[0_8px_18px_rgba(90,70,70,.18),inset_0_1px_0_rgba(255,255,255,.8)]">
              <div className="mb-2 text-sm font-black uppercase tracking-wide text-[#6e5658]">Monthly Requirements</div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-[#e1cff1] bg-[#eadcf8] px-2 py-3 text-center shadow-[0_2px_6px_rgba(70,60,75,.14),inset_0_1px_0_rgba(255,255,255,.55)]">
                  <div className="text-[11px] font-black uppercase text-[#6e5658]">Clinics</div>
                  <div className="text-2xl font-black text-[#263044]">1</div>
                </div>
                <div className="rounded-lg border border-[#f1aaaa] bg-[#ffbfc0] px-2 py-3 text-center shadow-[0_2px_6px_rgba(70,60,75,.14),inset_0_1px_0_rgba(255,255,255,.55)]">
                  <div className="text-[11px] font-black uppercase text-[#6e5658]">KNOs</div>
                  <div className="text-2xl font-black text-[#263044]">2</div>
                </div>
                <div className="rounded-lg border border-[#add5b2] bg-[#bee3c2] px-2 py-3 text-center shadow-[0_2px_6px_rgba(70,60,75,.14),inset_0_1px_0_rgba(255,255,255,.55)]">
                  <div className="text-[11px] font-black uppercase text-[#6e5658]">Open Gym</div>
                  <div className="text-2xl font-black text-[#263044]">1</div>
                </div>
              </div>

              <div className="mt-2 rounded-lg border border-[#ded1d1] bg-white/75 px-3 py-2 text-center text-xs font-black text-[#71585a] shadow-[inset_0_1px_0_rgba(255,255,255,.85)]">
                Required per gym each month
              </div>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-[6px] border border-[#aeb8cc] bg-[#e3e3e3] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.7),0_2px_6px_rgba(80,80,90,.11)]">
          <div className="mb-3 flex justify-center">
            <div className="flex items-center gap-3">
              <button className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-[0_2px_6px_rgba(65,65,75,.12)]">‹ Previous</button>
              <div className="text-xl font-black">May 2026</div>
              <button className="rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-[0_2px_6px_rgba(65,65,75,.12)]">Next ›</button>
            </div>
          </div>

          <div className="overflow-hidden rounded-md border border-[#9a7b7b] shadow-[0_5px_12px_rgba(70,60,60,.15)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[#927373] text-white">
                  <th className="w-[42%] px-4 py-3 text-left font-black">Gym</th>
                  <th className="px-4 py-3 text-center font-black">Clinics</th>
                  <th className="px-4 py-3 text-center font-black">KNO</th>
                  <th className="px-4 py-3 text-center font-black">Open Gyms</th>
                  <th className="px-4 py-3 text-center font-black">Monthly Goal</th>
                  <th className="px-4 py-3 text-center font-black">Fix Needed</th>
                </tr>
              </thead>
              <tbody>
                {gymRows.map((row) => {
                  const complete = isComplete(row);
                  const isActive = row.code === activeRowCode;

                  return (
                    <tr
                      key={row.code}
                      className={`border-b border-[#d9d0d0] transition ${isActive ? "bg-[#f8f0f0]" : "bg-[#e3e3e3] hover:bg-[#ededed]"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <button
                            onClick={() => setActiveRowCode(row.code)}
                            className="text-left text-base font-black text-[#263044]"
                          >
                            {row.gym} <span className="text-xs font-bold text-slate-400">↓</span>
                          </button>
                          <button
                            onClick={() => openGymAll(row)}
                            className="rounded-full px-3 py-1 text-sm font-black text-[#d49b28] transition hover:scale-110 hover:bg-white/70"
                            title={`Open all available pages for ${row.code}`}
                          >
                            ✨
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CountButton value={row.clinic} type="clinic" row={row} onOpen={openGymEventPage} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CountButton value={row.kno} type="kno" row={row} onOpen={openGymEventPage} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <CountButton value={row.openGym} type="openGym" row={row} onOpen={openGymEventPage} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-md px-4 py-2 text-xs font-black text-white shadow-[0_2px_6px_rgba(70,70,70,.16)] ${complete ? "bg-[#6e936f]" : "bg-[#c77878]"}`}>
                          {complete ? "✓ Complete" : "Needs Events"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => runAction(`Open ${row.code} → issue review`, Object.values(row.links).filter(Boolean))}
                          className={`rounded-md px-3 py-2 text-xs font-black text-white shadow-[0_2px_6px_rgba(70,70,70,.16)] ${row.issues ? "bg-[#c77878]" : "bg-[#6e936f]"}`}
                        >
                          {row.issues ? `${row.issues} ↗` : "✓"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 rounded-xl border border-[#c6b5b5] bg-white/70 p-3 shadow-[0_4px_10px_rgba(80,68,68,.13),inset_0_1px_0_rgba(255,255,255,.8)]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-sm font-black uppercase tracking-wide text-[#71585a]">Selected Links Preview</div>
              <div className="rounded-full bg-[#f1e4e4] px-3 py-1 text-xs font-black text-[#71585a]">{previewUrls.length} links</div>
            </div>
            {previewUrls.length === 0 ? (
              <div className="rounded-md bg-[#f7f0f0] px-3 py-2 text-xs font-bold text-slate-500">Click a bulk button, sparkle, or number to preview/open links.</div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {previewUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate rounded-md border border-[#ded1d1] bg-[#fbf8f8] px-3 py-2 text-xs font-bold text-[#263044] shadow-[0_2px_5px_rgba(72,60,60,.09)] hover:bg-white"
                  >
                    {url}
                  </a>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
