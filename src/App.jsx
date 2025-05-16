import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import InventoryManagement from './components/InventoryManagement';
import POS from './components/POS';
import Sidebar from './components/Sidebar'; // Import the Sidebar component
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

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
      <Router>
        <Routes>
          <Route element={<Sidebar />}>
            <Route path="/" element={<Navigate to="/inventory" replace />} />
            <Route path="/inventory" element={<InventoryManagement />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/dashboard" element={<div>Dashboard Content</div>} />
          </Route>
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;