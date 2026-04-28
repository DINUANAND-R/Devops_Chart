import React, { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ChatPage from './pages/ChatPage';
import Toast from './components/Notifications/Toast';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};

const GuestRoute = ({ children }) => {
  const { user } = useAuth();
  return !user ? children : <Navigate to="/" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
    <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
    <Route
      path="/*"
      element={
        <ProtectedRoute>
          <SocketProvider>
            <ChatProvider>
              <ChatPage />
              <Toast />
            </ChatProvider>
          </SocketProvider>
        </ProtectedRoute>
      }
    />
  </Routes>
);

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
