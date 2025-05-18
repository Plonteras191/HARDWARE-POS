import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

const LoadingScreen = () => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        bgcolor: 'background.default'
      }}
    >
      <CircularProgress size={60} thickness={4} />
      <Typography variant="h6" sx={{ mt: 3 }}>
        Loading...
      </Typography>
    </Box>
  );
};

export default LoadingScreen;