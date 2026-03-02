import { useState } from 'react';
import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/overview', label: 'نظرة عامة' },
  { to: '/tactical', label: 'البث التكتيكي' },
  { to: '/ai', label: 'ذكاء القرار' },
  { to: '/financial', label: 'المخاطر المالية' },
  { to: '/season', label: 'توقع الموسم' },
  { to: '/player/1', label: 'ملف اللاعب' }
];

export default function MainLayout({ children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="app-layout">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <strong>SPHCC</strong>
          <span>مركز القيادة التنبؤية للصحة الرياضية</span>
        </div>

        <nav className="sidebar-nav" aria-label="التنقل الرئيسي">
          {NAV_ITEMS.map((item) => (
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
      </aside>

      <button type="button" className="sidebar-toggle" onClick={() => setOpen((prev) => !prev)}>
        {open ? 'إغلاق' : 'القائمة'}
      </button>

      <main className="main-content" dir="rtl">{children}</main>
    </div>
  );
}
