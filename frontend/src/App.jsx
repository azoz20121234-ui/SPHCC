import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './layout/MainLayout.jsx';
import Overview from './pages/Overview.jsx';
import TacticalLive from './pages/TacticalLive.jsx';
import AIIntelligence from './pages/AIIntelligence.jsx';
import FinancialRisk from './pages/FinancialRisk.jsx';
import SeasonForecast from './pages/SeasonForecast.jsx';
import PlayerDigitalTwin from './pages/PlayerDigitalTwin.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route
        path="/overview"
        element={
          <MainLayout>
            <Overview />
          </MainLayout>
        }
      />
      <Route
        path="/tactical"
        element={
          <MainLayout>
            <TacticalLive />
          </MainLayout>
        }
      />
      <Route
        path="/ai"
        element={
          <MainLayout>
            <AIIntelligence />
          </MainLayout>
        }
      />
      <Route
        path="/financial"
        element={
          <MainLayout>
            <FinancialRisk />
          </MainLayout>
        }
      />
      <Route
        path="/season"
        element={
          <MainLayout>
            <SeasonForecast />
          </MainLayout>
        }
      />
      <Route
        path="/player/:id"
        element={
          <MainLayout>
            <PlayerDigitalTwin />
          </MainLayout>
        }
      />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  );
}
