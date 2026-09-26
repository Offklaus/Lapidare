import { Routes, Route } from 'react-router-dom';

import SiteLayout from './layout/SiteLayout.jsx';
import HomePage from './pages/HomePage.jsx';
import BookingPage from './pages/booking/BookingPage.jsx';
import BookingSuccessPage from './pages/BookingSuccessPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<HomePage />} />
        <Route path="agendar" element={<BookingPage />} />
        <Route path="agendamento-confirmado" element={<BookingSuccessPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
