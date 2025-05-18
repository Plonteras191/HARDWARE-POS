import React, { createContext, useState, useContext, useEffect } from 'react';

// Create auth context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkLoggedIn = () => {
      const loggedInUser = localStorage.getItem('user');
      const token = localStorage.getItem('token');
      
      if (loggedInUser && token) {
        try {
          // Parse the stored user data
          const userData = JSON.parse(loggedInUser);
          
          // Set user and authentication state
          setUser(userData);
          setIsAuthenticated(true);
          
          // In a real app with JWTs, you might want to validate the token here
          // or check its expiration
        } catch (error) {
          // If there's an error parsing user data, clear storage
          console.error('Error parsing user data:', error);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      }
      
      setLoading(false);
    };
    
    checkLoggedIn();
  }, []);

  // Login function
  const login = (userData, token) => {
    // Store authentication data in localStorage
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', token);
    
    // Update state
    setUser(userData);
    setIsAuthenticated(true);
  };

  // Logout function
  const logout = () => {
    // Clear authentication data from localStorage
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Update state
    setUser(null);
    setIsAuthenticated(false);
  };

  // Context value
  const value = {
    isAuthenticated,
    user,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;