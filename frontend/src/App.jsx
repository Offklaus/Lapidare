import { Routes, Route } from 'react-router-dom';

import SiteLayout from './layout/SiteLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import BookingPage from './pages/booking/BookingPage.jsx';
import BookingSuccessPage from './pages/BookingSuccessPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import TrackBookingPage from './pages/TrackBookingPage.jsx';
import StaffLayout from './pages/staff/StaffLayout.jsx';
import StaffLoginPage from './pages/staff/StaffLoginPage.jsx';
import StaffAgendaPage from './pages/staff/StaffAgendaPage.jsx';
import StaffProfessionalsPage from './pages/staff/StaffProfessionalsPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="agendar" element={<BookingPage />} />
        <Route path="agendamento-confirmado" element={<BookingSuccessPage />} />
        <Route path="acompanhar" element={<TrackBookingPage />} />
        <Route path="acompanhar/:code" element={<TrackBookingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Área da equipe: layout próprio, sem o menu do site */}
      <Route path="equipe/entrar" element={<StaffLoginPage />} />
      <Route path="equipe" element={<StaffLayout />}>
        <Route index element={<StaffAgendaPage />} />
        <Route path="profissionais" element={<StaffProfessionalsPage />} />
      </Route>
    </Routes>
  );
}
