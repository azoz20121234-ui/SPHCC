import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSimulation } from '../utils/SimulationContext.jsx';

export default function MainLayout() {
  const [open, setOpen] = useState(false);
  const { players, selectedPlayerId, setSelectedPlayerId, activeAlerts, teamReadiness } = useSimulation();
  const navItems = [
    { to: '/overview', label: 'نظرة عامة' },
    { to: '/tactical', label: 'التحليل التكتيكي المباشر' },
    { to: '/ai', label: 'ذكاء القرار' },
    { to: '/financial', label: 'المخاطر المالية' },
    { to: '/season', label: 'توقع الموسم' },
    { to: `/player/${selectedPlayerId}`, label: 'الملف الصحي للاعب' }
  ];

  return (
    <div className="app-layout">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <strong>SPHCC</strong>
          <span>مركز القيادة التنبؤية للصحة الرياضية</span>
        </div>

        <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-meta">
          <label htmlFor="player-select">اللاعب النشط</label>
          <select
            id="player-select"
            value={selectedPlayerId}
            onChange={(event) => setSelectedPlayerId(Number(event.target.value))}
          >
            {players.map((player) => (
              <option key={player.id} value={player.id}>
                {player.name}
              </option>
            ))}
          </select>
          <div className="meta-line">
            <span>جاهزية الفريق</span>
            <strong>{teamReadiness.toFixed(1)}%</strong>
          </div>
          <div className="meta-line">
            <span>تنبيهات حرجة</span>
            <strong>{activeAlerts}</strong>
          </div>
        </div>
      </aside>

      <button type="button" className="sidebar-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? 'إغلاق' : 'القائمة'}
      </button>

      <main className="main-content" dir="rtl">
        <Outlet />
      </main>
    </div>
  );
}
