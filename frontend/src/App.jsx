import { Routes, Route } from 'react-router-dom';

import { CustomerProvider } from './context/CustomerContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import MyBookingsPage from './pages/MyBookingsPage.jsx';

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
import StaffServicesPage from './pages/staff/StaffServicesPage.jsx';

export default function App() {
  return (
    <Routes>
      {/* Site das clientes: sabe se a cliente está logada (login com Google) */}
      <Route
        element={
          <CustomerProvider>
            <SiteLayout />
          </CustomerProvider>
        }
      >
        <Route index element={<HomePage />} />
        <Route path="agendar" element={<BookingPage />} />
        <Route path="agendamento-confirmado" element={<BookingSuccessPage />} />
        <Route path="acompanhar" element={<TrackBookingPage />} />
        <Route path="acompanhar/:code" element={<TrackBookingPage />} />
        <Route path="entrar" element={<LoginPage />} />
        <Route path="minhas-reservas" element={<MyBookingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Área da equipe: layout próprio, sem o menu do site */}
      <Route path="equipe/entrar" element={<StaffLoginPage />} />
      <Route path="equipe" element={<StaffLayout />}>
        <Route index element={<StaffAgendaPage />} />
        <Route path="profissionais" element={<StaffProfessionalsPage />} />
        <Route path="servicos" element={<StaffServicesPage />} />
      </Route>
    </Routes>
  );
}
