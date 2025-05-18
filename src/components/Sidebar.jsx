import React, { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import {
    Drawer,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
    Box,
    Divider,
    ListItemButton,
    AppBar,
    IconButton,
    useTheme,
    useMediaQuery,
    Avatar,
    Menu,
    MenuItem
} from '@mui/material';
import {
    Inventory as InventoryIcon,
    PointOfSale as POSIcon,
    Dashboard as DashboardIcon,
    Menu as MenuIcon,
    Assessment as ReportIcon,
    Logout as LogoutIcon,
    AccountCircle as AccountIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

const drawerWidth = 240;

const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Inventory', icon: <InventoryIcon />, path: '/inventory' },
    { text: 'POS', icon: <POSIcon />, path: '/pos' },
    { text: 'Report', icon: <ReportIcon />, path: '/report' }
];

const Sidebar = () => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    const handleMenu = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = () => {
        handleClose();
        logout();
        navigate('/login');
    };

    // Get current page title based on route
    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/dashboard') return 'Dashboard';
        if (path === '/inventory') return 'Inventory Management';
        if (path === '/pos') return 'Point of Sale';
        if (path === '/report') return 'Sales Report';
        return '';
    };

    const drawer = (
        <div>
            <Toolbar sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                minHeight: '64px !important',
                backgroundColor: 'white'
            }}>
                <Typography 
                    variant="h6" 
                    noWrap 
                    component="div"
                    sx={{ 
                        fontWeight: 'bold',
                        color: 'primary.main',
                        fontSize: '1.5rem'
                    }}
                >
                    CJ'S STORE
                </Typography>
            </Toolbar>
            <Divider />
            <List sx={{ backgroundColor: 'white', py: 1 }}>
                {menuItems.map((item) => (
                    <ListItem 
                        key={item.text} 
                        disablePadding
                        sx={{ mb: 0.75 }}
                    >
                        <ListItemButton
                            component={Link}
                            to={item.path}
                            selected={location.pathname === item.path}
                            sx={{
                                py: 1.2,
                                px: 2,
                                borderLeft: location.pathname === item.path ? '4px solid' : '4px solid transparent',
                                borderColor: location.pathname === item.path ? 'primary.main' : 'transparent',
                                backgroundColor: location.pathname === item.path ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                                transition: 'all 0.2s ease',
                                '&:hover': {
                                    backgroundColor: location.pathname === item.path ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                                },
                                '&.Mui-selected': {
                                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                    '&:hover': {
                                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                    }
                                }
                            }}
                        >
                            <ListItemIcon 
                                sx={{ 
                                    minWidth: 40,
                                    color: location.pathname === item.path ? 'primary.main' : 'text.secondary',
                                    transition: 'color 0.2s ease'
                                }}
                            >
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText 
                                primary={item.text}
                                primaryTypographyProps={{
                                    fontSize: '0.95rem',
                                    fontWeight: location.pathname === item.path ? '600' : '400',
                                    color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                                    transition: 'color 0.2s ease, font-weight 0.2s ease'
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
            <Divider />
            <List sx={{ backgroundColor: 'white', py: 1 }}>
                <ListItem disablePadding>
                    <ListItemButton 
                        onClick={handleLogout}
                        sx={{
                            py: 1.2,
                            px: 2,
                            '&:hover': {
                                backgroundColor: 'transparent',
                            }
                        }}
                    >
                        <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
                            <LogoutIcon />
                        </ListItemIcon>
                        <ListItemText 
                            primary="Logout"
                            primaryTypographyProps={{
                                fontSize: '0.95rem',
                                color: 'text.primary'
                            }}
                        />
                    </ListItemButton>
                </ListItem>
            </List>
        </div>
    );

    return (
        <Box sx={{ display: 'flex' }}>
            <AppBar
                position="fixed"
                sx={{
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    ml: { sm: `${drawerWidth}px` },
                    backgroundColor: 'white',
                    color: 'text.primary',
                    boxShadow: 'none',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.08)'
                }}
                elevation={0}
            >
                <Toolbar>
                    <IconButton
                        color="inherit"
                        aria-label="open drawer"
                        edge="start"
                        onClick={handleDrawerToggle}
                        sx={{ mr: 2, display: { sm: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography 
                        variant="h6" 
                        noWrap 
                        component="div" 
                        sx={{ 
                            flexGrow: 1,
                            fontWeight: 500
                        }}
                    >
                        {getPageTitle()}
                    </Typography>
                    <div>
                        <IconButton
                            size="large"
                            aria-label="account of current user"
                            aria-controls="menu-appbar"
                            aria-haspopup="true"
                            onClick={handleMenu}
                            color="inherit"
                        >
                            <Avatar 
                                sx={{ 
                                    width: 34, 
                                    height: 34,
                                    bgcolor: 'primary.main',
                                    fontSize: '0.9rem'
                                }}
                            >
                                {user?.name?.charAt(0) || 'U'}
                            </Avatar>
                        </IconButton>
                        <Menu
                            id="menu-appbar"
                            anchorEl={anchorEl}
                            anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'right',
                            }}
                            keepMounted
                            transformOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            open={Boolean(anchorEl)}
                            onClose={handleClose}
                            PaperProps={{
                                elevation: 2,
                                sx: {
                                    borderRadius: 1.5,
                                    mt: 0.5
                                }
                            }}
                        >
                            <MenuItem disabled>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                    {user?.name || 'User'}
                                </Typography>
                            </MenuItem>
                            <Divider />
                            <MenuItem onClick={handleLogout}>
                                <ListItemIcon>
                                    <LogoutIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText primary="Logout" />
                            </MenuItem>
                        </Menu>
                    </div>
                </Toolbar>
            </AppBar>

            <Box
                component="nav"
                sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
            >
                <Drawer
                    variant="temporary"
                    open={mobileOpen}
                    onClose={handleDrawerToggle}
                    ModalProps={{
                        keepMounted: true, // Better open performance on mobile.
                    }}
                    sx={{
                        display: { xs: 'block', sm: 'none' },
                        '& .MuiDrawer-paper': { 
                            boxSizing: 'border-box', 
                            width: drawerWidth,
                            borderRight: '1px solid rgba(0, 0, 0, 0.08)',
                            backgroundColor: 'white',
                            boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)'
                        },
                    }}
                >
                    {drawer}
                </Drawer>
                <Drawer
                    variant="permanent"
                    sx={{
                        display: { xs: 'none', sm: 'block' },
                        '& .MuiDrawer-paper': { 
                            boxSizing: 'border-box', 
                            width: drawerWidth,
                            borderRight: '1px solid rgba(0, 0, 0, 0.08)',
                            backgroundColor: 'white',
                            boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.05)'
                        },
                    }}
                    open
                >
                    {drawer}
                </Drawer>
            </Box>

            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { sm: `calc(100% - ${drawerWidth}px)` },
                    minHeight: '100vh',
                    backgroundColor: '#f9fafb',
                    display: 'flex',
                    flexDirection: 'column'
                }}
            >
                <Toolbar /> {/* This toolbar is for spacing below the AppBar */}
                <Box sx={{ flexGrow: 1 }}>
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
};

export default Sidebar;