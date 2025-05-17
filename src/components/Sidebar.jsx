import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
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
    useMediaQuery
} from '@mui/material';
import {
    Inventory as InventoryIcon,
    PointOfSale as POSIcon,
    Dashboard as DashboardIcon,
    Menu as MenuIcon,
    Assessment as ReportIcon
} from '@mui/icons-material';

const drawerWidth = 240;

const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { text: 'Inventory', icon: <InventoryIcon />, path: '/inventory' },
    { text: 'POS', icon: <POSIcon />, path: '/pos' },
    { text: 'Report', icon: <ReportIcon />, path: '/report' }
];

const Sidebar = () => {
    const [mobileOpen, setMobileOpen] = useState(false);
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const location = useLocation();

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
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
                minHeight: '64px !important'
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
                    HARD-POS
                </Typography>
            </Toolbar>
            <Divider />
            <List>
                {menuItems.map((item) => (
                    <ListItem 
                        key={item.text} 
                        disablePadding
                        sx={{ 
                            mb: 0.5,
                            '& .MuiListItemButton-root': {
                                borderRadius: '0 24px 24px 0',
                                mx: 1,
                                '&.Mui-selected': {
                                    backgroundColor: 'primary.light',
                                    color: 'primary.main',
                                    '&:hover': {
                                        backgroundColor: 'primary.light',
                                    },
                                    '& .MuiListItemIcon-root': {
                                        color: 'primary.main',
                                    }
                                }
                            }
                        }}
                    >
                        <ListItemButton
                            component={Link}
                            to={item.path}
                            selected={location.pathname === item.path}
                        >
                            <ListItemIcon 
                                sx={{ 
                                    minWidth: 40,
                                    color: location.pathname === item.path ? 'primary.main' : 'inherit'
                                }}
                            >
                                {item.icon}
                            </ListItemIcon>
                            <ListItemText 
                                primary={item.text}
                                primaryTypographyProps={{
                                    fontSize: '0.9rem',
                                    fontWeight: location.pathname === item.path ? 'bold' : 'normal'
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
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
                    backgroundColor: 'background.paper',
                    color: 'text.primary',
                    boxShadow: 'none',
                    borderBottom: '1px solid rgba(0, 0, 0, 0.12)'
                }}
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
                    <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
                        {getPageTitle()}
                    </Typography>
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
                            borderRight: '1px solid rgba(0, 0, 0, 0.12)',
                            backgroundColor: 'background.paper'
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
                            borderRight: '1px solid rgba(0, 0, 0, 0.12)',
                            backgroundColor: 'background.paper'
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
                    backgroundColor: 'background.default',
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