import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview' },
  { to: '/tactical', label: 'Tactical Live' },
  { to: '/ai', label: 'AI Intelligence' },
  { to: '/financial', label: 'Financial Risk' },
  { to: '/season', label: 'Season Forecast' },
  { to: '/player/1', label: 'Players' }
];

export default function MainLayout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-layout" dir="rtl">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <strong>SPHCC</strong>
          <span>Sports Predictive Health Command Center</span>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <button type="button" className="sidebar-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? 'إغلاق' : 'القائمة'}
      </button>

      <main className="content-shell">{children}</main>
    </div>
  );
}
