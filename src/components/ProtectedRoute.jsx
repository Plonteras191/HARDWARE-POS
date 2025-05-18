import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

const ProtectedRoute = () => {
  const { isAuthenticated, loading } = useAuth();
  
  // Show loading screen while checking authentication
  if (loading) {
    return <LoadingScreen />;
  }
  
  // Redirect to login if not authenticated
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;