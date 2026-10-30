import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import {
  fetchDecks,
  fetchHealth,
  fetchStats,
  updateSettings,
} from './api/client.js';
import NavBar from './components/NavBar.jsx';
import Footer from './components/Footer.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import HomePage from './pages/HomePage.jsx';
import PathPage from './pages/PathPage.jsx';
import ReviewPage from './pages/ReviewPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

const ONBOARDING_STORAGE_KEY = 'revenant_onboarded';

export default function App() {
  const [stats, setStats] = useState(null);
  const [decks, setDecks] = useState([]);
  const [healthInfo, setHealthInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try {
      return localStorage.getItem(ONBOARDING_STORAGE_KEY) !== 'true';
    } catch {
      return true;
    }
  });
  const [notifPermission, setNotifPermission] = useState(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'unsupported';
  });

  const lastNotifiedDueRef = useRef(0);

  const notifyDueCards = useCallback((dueTotal) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (dueTotal <= 0 || dueTotal === lastNotifiedDueRef.current) return;

    lastNotifiedDueRef.current = dueTotal;
    try {
      new Notification('Revenant revision due', {
        body: `${dueTotal} grounded cards are waiting for your review.`,
        icon: '/ghost.svg',
      });
    } catch {
      // Ignore notification errors in restricted environments
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setError('');
    try {
      const [statsData, decksData, healthData] = await Promise.all([
        fetchStats(),
        fetchDecks(),
        fetchHealth().catch(() => null),
      ]);
      setStats(statsData);
      setDecks(decksData || []);
      if (healthData) {
        setHealthInfo(healthData);
      }
      const dueTotal = (decksData || []).reduce((sum, d) => sum + (d.due_count || 0), 0);
      notifyDueCards(dueTotal);
    } catch (err) {
      setError(err.message || 'Could not reach the local Revenant server.');
    } finally {
      setLoading(false);
    }
  }, [notifyDueCards]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshAll();
    }, 60000);
    return () => clearInterval(interval);
  }, [refreshAll]);

  const handleSelectGoal = async (dailyGoal) => {
    const updatedStats = await updateSettings(dailyGoal);
    setStats(updatedStats);
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  };

  const handleStatsChange = useCallback(
    (newStats) => {
      setStats(newStats);
      refreshAll();
    },
    [refreshAll]
  );

  const handleEnableNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const permission = await Notification.requestPermission();
      setNotifPermission(permission);
      if (permission === 'granted') {
        const dueTotal = (decks || []).reduce((sum, d) => sum + (d.due_count || 0), 0);
        lastNotifiedDueRef.current = 0;
        notifyDueCards(dueTotal || 3);
      }
    } catch {
      // Ignore permission prompt errors
    }
  };

  const totalDue = (decks || []).reduce((sum, d) => sum + (d.due_count || 0), 0);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col justify-between bg-[#131209] text-[#EDEDED]">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-3 focus:py-2 focus:rounded-lg focus:bg-amber-400 focus:text-[#131209] focus:font-semibold"
        >
          Skip to content
        </a>

        <NavBar
          stats={stats}
          totalDue={totalDue}
          notifPermission={notifPermission}
          onEnableNotifications={handleEnableNotifications}
          onOpenOnboarding={() => setShowOnboarding(true)}
        />

        <main id="main-content" className="flex-1">
          <Routes>
            <Route
              path="/"
              element={
                <HomePage
                  stats={stats}
                  decks={decks}
                  healthInfo={healthInfo}
                  loading={loading}
                  error={error}
                  onDecksChange={setDecks}
                  onOpenOnboarding={() => setShowOnboarding(true)}
                />
              }
            />
            <Route
              path="/path"
              element={
                <PathPage
                  decks={decks}
                  stats={stats}
                  onRefreshAll={refreshAll}
                />
              }
            />
            <Route
              path="/review"
              element={
                <ReviewPage
                  stats={stats}
                  onStatsChange={handleStatsChange}
                />
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <Footer healthInfo={healthInfo} />

        {showOnboarding && (
          <OnboardingModal
            currentGoal={stats?.daily_goal ?? 5}
            onSelectGoal={handleSelectGoal}
            onClose={() => {
              try {
                localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
              } catch {
                // Ignore
              }
              setShowOnboarding(false);
            }}
          />
        )}
      </div>
    </BrowserRouter>
  );
}
