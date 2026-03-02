import { Navigate, Route, Routes } from 'react-router-dom';
import MainLayout from './layout/MainLayout.jsx';
import Overview from './pages/Overview.jsx';
import TacticalLive from './pages/TacticalLive.jsx';
import AIIntelligence from './pages/AIIntelligence.jsx';
import FinancialRisk from './pages/FinancialRisk.jsx';
import SeasonForecast from './pages/SeasonForecast.jsx';
import PlayerDigitalTwin from './pages/PlayerDigitalTwin.jsx';
import { SimulationProvider } from './utils/SimulationContext.jsx';

export default function App() {
  return (
    <SimulationProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route element={<MainLayout />}>
          <Route path="/overview" element={<Overview />} />
          <Route path="/tactical" element={<TacticalLive />} />
          <Route path="/ai" element={<AIIntelligence />} />
          <Route path="/financial" element={<FinancialRisk />} />
          <Route path="/season" element={<SeasonForecast />} />
          <Route path="/player/:id" element={<PlayerDigitalTwin />} />
        </Route>
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </SimulationProvider>
  );
}
