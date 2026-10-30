import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Bell, Flame, Lightning, Sparkle } from '@phosphor-icons/react';

const NAV_ITEMS = [
  { to: '/', label: 'Home', delayClass: 'delay-100' },
  { to: '/path', label: 'Path', delayClass: 'delay-150' },
  { to: '/review', label: 'Review', delayClass: 'delay-200' },
];

export default function NavBar({
  stats,
  totalDue = 0,
  notifPermission = 'unsupported',
  onEnableNotifications,
  onOpenOnboarding,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  const isRouteActive = (to) => {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <header className="sticky top-0 z-40 px-4">
      <nav
        aria-label="Primary navigation"
        className="mt-6 mx-auto w-max rounded-full bg-black/80 backdrop-blur-3xl border border-[#313131] p-1 flex items-center gap-2 shadow-[0_8px_32px_rgba(0,0,0,0.45)]"
      >
        <NavLink
          to="/"
          onClick={() => setMenuOpen(false)}
          className="flex items-center gap-2 pl-3 pr-2 py-1 rounded-full text-sm font-semibold text-[#EDEDED] hover:bg-[#1F1F1F] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <img src="/ghost.svg" alt="" className="w-5 h-5" />
          <span>Revenant</span>
        </NavLink>

        <div className="hidden sm:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isRouteActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`px-3 py-1 rounded-full text-sm font-semibold transition-all duration-300 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 inline-flex items-center gap-2 ${
                  active
                    ? 'bg-[#272727] text-amber-400 border border-[#313131]'
                    : 'text-[#9B9B9B] hover:text-[#EDEDED] hover:bg-[#1F1F1F]'
                }`}
              >
                <span>{item.label}</span>
                {item.to === '/review' && totalDue > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#131209] font-mono text-xs text-amber-400">
                    {totalDue}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {stats && (
          <div className="hidden sm:flex items-center gap-2 pl-1">
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#1F1F1F] border border-[#313131] text-xs font-semibold text-amber-400"
              title="Current streak"
            >
              <Flame weight="fill" className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono">{stats.streak}</span>
            </span>
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#1F1F1F] border border-[#313131] text-xs font-semibold text-[#EDEDED]"
              title="XP earned today"
            >
              <Lightning weight="fill" className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-mono">{stats.xp_today}</span>
            </span>
          </div>
        )}

        {notifPermission === 'default' && totalDue > 0 && (
          <button
            type="button"
            onClick={onEnableNotifications}
            aria-label="Enable due card notifications"
            title="Enable due card notifications"
            className="hidden sm:inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold text-[#9B9B9B] hover:text-amber-400 hover:bg-[#1F1F1F] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <Bell weight="bold" className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={onOpenOnboarding}
          aria-label="Set daily goal and view intro"
          title="Daily goal"
          className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-semibold text-[#9B9B9B] hover:text-[#EDEDED] hover:bg-[#1F1F1F] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Sparkle weight="bold" className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono text-xs">{stats?.daily_goal ?? 15}</span>
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={menuOpen}
          className="sm:hidden relative w-8 h-8 rounded-full bg-[#1F1F1F] border border-[#313131] flex items-center justify-center active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <span
            className={`block absolute w-4 h-0.5 bg-[#EDEDED] transition-transform duration-300 ${
              menuOpen ? 'rotate-45 translate-y-0' : '-translate-y-1'
            }`}
          />
          <span
            className={`block absolute w-4 h-0.5 bg-[#EDEDED] transition-transform duration-300 ${
              menuOpen ? '-rotate-45 translate-y-0' : 'translate-y-1'
            }`}
          />
        </button>
      </nav>

      <div
        className={`sm:hidden fixed inset-0 z-30 bg-black/80 backdrop-blur-3xl transition-opacity duration-300 flex flex-col items-center justify-center gap-6 px-6 ${
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!menuOpen}
      >
        {NAV_ITEMS.map((item) => {
          const active = isRouteActive(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={`text-3xl font-semibold transition-all duration-500 ${item.delayClass} ${
                menuOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
              } ${active ? 'text-amber-400' : 'text-[#EDEDED] hover:text-amber-400'}`}
            >
              {item.label}
            </NavLink>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            onOpenOnboarding?.();
          }}
          className={`mt-4 px-4 py-2 rounded-full bg-[#1F1F1F] border border-[#313131] text-sm font-semibold text-[#9B9B9B] hover:text-[#EDEDED] transition-all duration-500 delay-200 ${
            menuOpen ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
          }`}
        >
          Daily goal: <span className="font-mono text-amber-400">{stats?.daily_goal ?? 15}</span>
        </button>
      </div>
    </header>
  );
}
