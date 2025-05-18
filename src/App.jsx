import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import InventoryManagement from './components/InventoryManagement';
import POS from './components/POS';
import Sidebar from './components/Sidebar';
import Report from './components/Report';
import Dashboard from './components/dashboard';
import Login from './components/login';
import ProtectedRoute from './components/ProtectedRoute';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { AuthProvider } from './context/AuthContext';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<Sidebar />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/inventory" element={<InventoryManagement />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/report" element={<Report />} />
              </Route>
            </Route>
            
            {/* Catch all - redirect to login */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;