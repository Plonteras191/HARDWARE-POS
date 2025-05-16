import React, { useState, useEffect } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    TextField,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Typography,
    Box,
    Tabs,
    Tab,
    Snackbar,
    Alert,
    TablePagination,
    InputAdornment,
    Menu,
    MenuItem
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Remove as RemoveIcon,
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    AddCircle as AddCircleIcon,
    RemoveCircle as RemoveCircleIcon,
    Restore as RestoreIcon
} from '@mui/icons-material';
import '../styles/inventory.css';

const InventoryManagement = () => {
    const [inventory, setInventory] = useState([
        {
            id: 1,
            name: '2x4 Cocolumber',
            category: 'Lumber',
            quantity: 100,
            unit: 'pcs',
            price: 120.00,
            minStock: 20,
            isRemoved: false
        },
        {
            id: 2,
            name: 'Cement Bag',
            category: 'Construction',
            quantity: 50,
            unit: 'bags',
            price: 280.00,
            minStock: 10,
            isRemoved: false
        }
    ]);

    const [searchTerm, setSearchTerm] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        quantity: '',
        unit: '',
        price: '',
        minStock: ''
    });
    const [activeTab, setActiveTab] = useState(0);
    const [stockAdjustment, setStockAdjustment] = useState({ id: null, amount: '' });
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    
    // New state variables for modals and menus
    const [confirmDialog, setConfirmDialog] = useState({
        open: false,
        title: '',
        message: '',
        action: null
    });
    const [stockAdjustDialog, setStockAdjustDialog] = useState({
        open: false,
        item: null,
        amount: ''
    });
    const [actionMenu, setActionMenu] = useState({
        anchorEl: null,
        itemId: null
    });

    // Check for low stock items
    useEffect(() => {
        const lowStockItems = inventory.filter(item => !item.isRemoved && item.quantity <= item.minStock);
        if (lowStockItems.length > 0) {
            setNotification({
                open: true,
                message: `Low stock alert: ${lowStockItems.map(item => item.name).join(', ')}`,
                severity: 'warning'
            });
        }
    }, [inventory]);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleOpenDialog = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData(item);
        } else {
            setEditingItem(null);
            setFormData({
                name: '',
                category: '',
                quantity: '',
                unit: '',
                price: '',
                minStock: ''
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingItem(null);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleActionMenuOpen = (event, itemId) => {
        setActionMenu({
            anchorEl: event.currentTarget,
            itemId
        });
    };

    const handleActionMenuClose = () => {
        setActionMenu({
            anchorEl: null,
            itemId: null
        });
    };

    const openConfirmDialog = (title, message, action) => {
        setConfirmDialog({
            open: true,
            title,
            message,
            action
        });
    };

    const closeConfirmDialog = () => {
        setConfirmDialog({
            open: false,
            title: '',
            message: '',
            action: null
        });
    };

    const openStockAdjustDialog = (item) => {
        setStockAdjustDialog({
            open: true,
            item,
            amount: ''
        });
    };

    const closeStockAdjustDialog = () => {
        setStockAdjustDialog({
            open: false,
            item: null,
            amount: ''
        });
    };

    const handleStockAdjustment = () => {
        const { item, amount } = stockAdjustDialog;
        if (!item || !amount) return;

        const newQuantity = Number(item.quantity) + Number(amount);
        if (newQuantity < 0) {
            setNotification({
                open: true,
                message: 'Cannot reduce stock below 0',
                severity: 'error'
            });
            return;
        }

        setInventory(prev => prev.map(invItem =>
            invItem.id === item.id ? { ...invItem, quantity: newQuantity } : invItem
        ));

        closeStockAdjustDialog();
        setNotification({
            open: true,
            message: `Stock adjusted by ${amount > 0 ? '+' : ''}${amount}`,
            severity: 'success'
        });
    };

    const handleRemove = (id) => {
        const item = inventory.find(item => item.id === id);
        openConfirmDialog(
            'Remove Item',
            `Are you sure you want to remove "${item.name}"?`,
            () => {
                setInventory(prev => prev.map(item =>
                    item.id === id ? { ...item, isRemoved: true } : item
                ));
                setNotification({
                    open: true,
                    message: 'Item has been removed',
                    severity: 'info'
                });
            }
        );
    };

    const handleRestore = (id) => {
        const item = inventory.find(item => item.id === id);
        openConfirmDialog(
            'Restore Item',
            `Are you sure you want to restore "${item.name}"?`,
            () => {
                setInventory(prev => prev.map(item =>
                    item.id === id ? { ...item, isRemoved: false } : item
                ));
                setNotification({
                    open: true,
                    message: 'Item has been restored',
                    severity: 'success'
                });
            }
        );
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editingItem) {
            openConfirmDialog(
                'Update Item',
                `Are you sure you want to update "${formData.name}"?`,
                () => {
                    setInventory(prev => prev.map(item =>
                        item.id === editingItem.id ? { ...formData, id: item.id, isRemoved: item.isRemoved } : item
                    ));
                    handleCloseDialog();
                    setNotification({
                        open: true,
                        message: 'Item has been updated',
                        severity: 'success'
                    });
                }
            );
        } else {
            setInventory(prev => [...prev, {
                ...formData,
                id: Math.max(...prev.map(item => item.id)) + 1,
                isRemoved: false
            }]);
            handleCloseDialog();
            setNotification({
                open: true,
                message: 'New item has been added',
                severity: 'success'
            });
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.category.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTab = activeTab === 0 ? !item.isRemoved : item.isRemoved;
        return matchesSearch && matchesTab;
    });

    const paginatedInventory = filteredInventory.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    return (
        <div className="inventory-container">
            <div className="inventory-header">
                <Typography variant="h4">Inventory Management</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    className="add-item-button"
                >
                    Add New Item
                </Button>
            </div>

            <TextField
                fullWidth
                variant="outlined"
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-bar"
                InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'gray' }} />
                }}
            />

            <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
                <Tab label="Active Items" />
                <Tab label="Removed Items" />
            </Tabs>

            <TableContainer component={Paper} className="inventory-table">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell>Quantity</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell>Price</TableCell>
                            <TableCell>Min Stock</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedInventory.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.category}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{item.unit}</TableCell>
                                <TableCell>₱{item.price.toFixed(2)}</TableCell>
                                <TableCell>{item.minStock}</TableCell>
                                <TableCell>
                                    <Typography
                                        className={item.quantity <= item.minStock ? 'stock-warning' : 'stock-ok'}
                                    >
                                        {item.quantity <= item.minStock ? 'Low Stock' : 'In Stock'}
                                    </Typography>
                                </TableCell>
                                <TableCell>
                                    <div className="inventory-actions">
                                        <IconButton
                                            onClick={(e) => handleActionMenuOpen(e, item.id)}
                                        >
                                            <MoreVertIcon />
                                        </IconButton>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={filteredInventory.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </TableContainer>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenu.anchorEl}
                open={Boolean(actionMenu.anchorEl)}
                onClose={handleActionMenuClose}
            >
                <MenuItem onClick={() => {
                    handleActionMenuClose();
                    handleOpenDialog(inventory.find(item => item.id === actionMenu.itemId));
                }}>
                    <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
                </MenuItem>
                <MenuItem onClick={() => {
                    handleActionMenuClose();
                    openStockAdjustDialog(inventory.find(item => item.id === actionMenu.itemId));
                }}>
                    <AddCircleIcon fontSize="small" sx={{ mr: 1 }} /> Adjust Stock
                </MenuItem>
                {activeTab === 0 ? (
                    <MenuItem onClick={() => {
                        handleActionMenuClose();
                        handleRemove(actionMenu.itemId);
                    }}>
                        <RemoveIcon fontSize="small" sx={{ mr: 1 }} /> Remove
                    </MenuItem>
                ) : (
                    <MenuItem onClick={() => {
                        handleActionMenuClose();
                        handleRestore(actionMenu.itemId);
                    }}>
                        <RestoreIcon fontSize="small" sx={{ mr: 1 }} /> Restore
                    </MenuItem>
                )}
            </Menu>

            {/* Stock Adjustment Dialog */}
            <Dialog open={stockAdjustDialog.open} onClose={closeStockAdjustDialog}>
                <DialogTitle>Adjust Stock</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Typography variant="subtitle1" gutterBottom>
                            {stockAdjustDialog.item?.name}
                        </Typography>
                        <Typography variant="body2" color="textSecondary" gutterBottom>
                            Current Stock: {stockAdjustDialog.item?.quantity} {stockAdjustDialog.item?.unit}
                        </Typography>
                        <TextField
                            fullWidth
                            label="Adjustment Amount"
                            type="number"
                            value={stockAdjustDialog.amount}
                            onChange={(e) => setStockAdjustDialog(prev => ({ ...prev, amount: e.target.value }))}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">±</InputAdornment>
                            }}
                            sx={{ mt: 2 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeStockAdjustDialog}>Cancel</Button>
                    <Button 
                        onClick={handleStockAdjustment}
                        variant="contained"
                        disabled={!stockAdjustDialog.amount}
                    >
                        Apply Adjustment
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={confirmDialog.open} onClose={closeConfirmDialog}>
                <DialogTitle>{confirmDialog.title}</DialogTitle>
                <DialogContent>
                    <Typography>{confirmDialog.message}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeConfirmDialog}>Cancel</Button>
                    <Button 
                        onClick={() => {
                            confirmDialog.action();
                            closeConfirmDialog();
                        }}
                        variant="contained"
                        color="primary"
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={notification.open}
                autoHideDuration={6000}
                onClose={() => setNotification({ ...notification, open: false })}
            >
                <Alert
                    onClose={() => setNotification({ ...notification, open: false })}
                    severity={notification.severity}
                    sx={{ width: '100%' }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default InventoryManagement; 