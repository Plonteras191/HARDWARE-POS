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
    MenuItem,
    CircularProgress // Added for loading state
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
import '../styles/inventory.css'; // Ensure this path is correct
import InventoryAPI from '../services/api'; // Import the API service

const InventoryManagement = () => {
    // State for inventory items
    const [inventory, setInventory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);

    // UI state
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
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [confirmDialog, setConfirmDialog] = useState({
        open: false,
        title: '',
        message: '',
        action: null
    });
    const [stockAdjustDialog, setStockAdjustDialog] = useState({
        open: false,
        item: null,
        amount: '',
        adjustmentType: null
    });
    const [actionMenu, setActionMenu] = useState({
        anchorEl: null,
        itemId: null
    });

    // Fetch inventory data
    const fetchInventory = async () => {
        try {
            setIsLoading(true);
            const status = activeTab === 0 ? 'active' : 'removed';
            const response = await InventoryAPI.getInventory(status, searchTerm, page, rowsPerPage);
            setInventory(response.products);
            setTotalItems(response.total);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            setNotification({
                open: true,
                message: `Error fetching inventory: ${error.message}`,
                severity: 'error'
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Initial data load and refresh on filters change
    useEffect(() => {
        fetchInventory();
    }, [activeTab, page, rowsPerPage, searchTerm]);

    // Check for low stock items
    useEffect(() => {
        const lowStockItems = inventory.filter(item => !item.isRemoved && item.quantity <= item.minStock);
        if (lowStockItems.length > 0) {
            setNotification({
                open: true,
                message: `Low stock alert: ${lowStockItems.map(item => item.name).join(', ')} ${lowStockItems.length === 1 ? 'is' : 'are'} running low.`,
                severity: 'warning'
            });
        }
    }, [inventory]);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
        setPage(0); // Reset page when tab changes
    };

    const handleOpenDialog = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                category: item.category,
                quantity: String(item.quantity),
                unit: item.unit,
                price: String(item.price),
                minStock: String(item.minStock)
            });
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
        handleActionMenuClose();
    };

    const closeConfirmDialog = () => {
        setConfirmDialog({
            open: false,
            title: '',
            message: '',
            action: null
        });
    };

    const openStockAdjustDialog = (item, type) => {
        setStockAdjustDialog({
            open: true,
            item,
            amount: '',
            adjustmentType: type
        });
        handleActionMenuClose();
    };

    const closeStockAdjustDialog = () => {
        setStockAdjustDialog({
            open: false,
            item: null,
            amount: '',
            adjustmentType: null
        });
    };

    const handleStockAdjustment = async () => {
        const { item, amount, adjustmentType } = stockAdjustDialog;

        if (!item || !adjustmentType || !amount || Number(amount) <= 0) {
            setNotification({
                open: true,
                message: 'Please enter a valid positive amount for adjustment.',
                severity: 'error'
            });
            return;
        }

        try {
            const response = await InventoryAPI.adjustStock({
                id: item.id,
                amount: Number(amount),
                adjustmentType
            });

            // Update the local state to reflect the change
            setInventory(prevInventory => 
                prevInventory.map(invItem =>
                    invItem.id === item.id 
                        ? { ...invItem, quantity: response.new_quantity } 
                        : invItem
                )
            );

            closeStockAdjustDialog();
            setNotification({
                open: true,
                message: `Stock for ${item.name} ${adjustmentType === 'add' ? 'increased' : 'decreased'} by ${amount}. New quantity: ${response.new_quantity}.`,
                severity: 'success'
            });
        } catch (error) {
            setNotification({
                open: true,
                message: error.message,
                severity: 'error'
            });
        }
    };

    const handleRemove = async (id) => {
        const itemToRemove = inventory.find(item => item.id === id);
        if (!itemToRemove) return;
        
        openConfirmDialog(
            'Remove Item',
            `Are you sure you want to remove "${itemToRemove.name}"? This action will move the item to the 'Removed Items' tab.`,
            async () => {
                try {
                    await InventoryAPI.changeItemStatus(id, 'remove');
                    
                    // Update local state
                    setInventory(prev => prev.filter(item => item.id !== id));
                    
                    setNotification({
                        open: true,
                        message: `"${itemToRemove.name}" has been moved to Removed Items.`,
                        severity: 'info'
                    });
                    
                    // Refresh data
                    fetchInventory();
                } catch (error) {
                    setNotification({
                        open: true,
                        message: error.message,
                        severity: 'error'
                    });
                }
            }
        );
    };

    const handleRestore = async (id) => {
        const itemToRestore = inventory.find(item => item.id === id);
        if (!itemToRestore) return;
        
        openConfirmDialog(
            'Restore Item',
            `Are you sure you want to restore "${itemToRestore.name}"? This action will move the item to the 'Active Items' tab.`,
            async () => {
                try {
                    await InventoryAPI.changeItemStatus(id, 'restore');
                    
                    // Update local state
                    setInventory(prev => prev.filter(item => item.id !== id));
                    
                    setNotification({
                        open: true,
                        message: `"${itemToRestore.name}" has been restored to Active Items.`,
                        severity: 'success'
                    });
                    
                    // Refresh data
                    fetchInventory();
                } catch (error) {
                    setNotification({
                        open: true,
                        message: error.message,
                        severity: 'error'
                    });
                }
            }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const numericFormData = {
            ...formData,
            quantity: parseInt(formData.quantity, 10) || 0,
            price: parseFloat(formData.price) || 0,
            minStock: parseInt(formData.minStock, 10) || 0,
        };

        if (editingItem) {
            openConfirmDialog(
                'Update Item',
                `Are you sure you want to update "${numericFormData.name}"?`,
                async () => {
                    try {
                        await InventoryAPI.updateItem(editingItem.id, numericFormData);
                        
                        handleCloseDialog();
                        setNotification({
                            open: true,
                            message: `"${numericFormData.name}" has been updated.`,
                            severity: 'success'
                        });
                        
                        fetchInventory();
                    } catch (error) {
                        setNotification({
                            open: true,
                            message: error.message,
                            severity: 'error'
                        });
                    }
                }
            );
        } else {
            try {
                await InventoryAPI.addItem(numericFormData);
                
                handleCloseDialog();
                setNotification({
                    open: true,
                    message: `New item "${numericFormData.name}" has been added.`,
                    severity: 'success'
                });
                
                fetchInventory();
            } catch (error) {
                setNotification({
                    open: true,
                    message: error.message,
                    severity: 'error'
                });
            }
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setPage(0); // Reset to first page on search
    };

    // Delayed search to prevent too many API calls
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            fetchInventory();
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm]);

    return (
        <div className="inventory-container">
            <div className="inventory-header">
                <Typography variant="h4" gutterBottom>Inventory Management</Typography>
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
                placeholder="Search by name or category..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="search-bar"
                InputProps={{
                    startAdornment: <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
                }}
                sx={{ mb: 2 }}
            />

            <Tabs value={activeTab} onChange={handleTabChange} indicatorColor="primary" textColor="primary" sx={{ mb: 2 }}>
                <Tab label="Active Items" />
                <Tab label="Removed Items" />
            </Tabs>

            <TableContainer component={Paper} className="inventory-table">
                <Table stickyHeader aria-label="inventory table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Category</TableCell>
                            <TableCell align="right">Quantity</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell align="right">Price</TableCell>
                            <TableCell align="right">Min Stock</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <CircularProgress />
                                </TableCell>
                            </TableRow>
                        ) : inventory.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} align="center">
                                    <Typography sx={{ py: 3 }}>
                                        {activeTab === 0 ? "No active items found." : "No removed items found."}
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            inventory.map((item) => (
                                <TableRow key={item.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                                    <TableCell component="th" scope="row">{item.name}</TableCell>
                                    <TableCell>{item.category}</TableCell>
                                    <TableCell align="right">{item.quantity}</TableCell>
                                    <TableCell>{item.unit}</TableCell>
                                    <TableCell align="right">₱{item.price.toFixed(2)}</TableCell>
                                    <TableCell align="right">{item.minStock}</TableCell>
                                    <TableCell>
                                        {!item.isRemoved && (item.quantity <= item.minStock) ? (
                                            <Typography variant="body2" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                                                Low Stock
                                            </Typography>
                                        ) : !item.isRemoved ? (
                                            <Typography variant="body2" sx={{ color: 'success.main' }}>
                                                In Stock
                                            </Typography>
                                        ) : (
                                            <Typography variant="body2" color="textSecondary">
                                                Removed
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell align="center">
                                        <IconButton
                                            aria-label="actions"
                                            onClick={(e) => handleActionMenuOpen(e, item.id)}
                                        >
                                            <MoreVertIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25, 50]}
                    component="div"
                    count={totalItems}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
            </TableContainer>

            {/* Action Menu */}
            <Menu
                id="actions-menu"
                anchorEl={actionMenu.anchorEl}
                open={Boolean(actionMenu.anchorEl)}
                onClose={handleActionMenuClose}
                MenuListProps={{
                    'aria-labelledby': 'actions-button',
                }}
            >
                <MenuItem onClick={() => {
                    const itemToEdit = inventory.find(item => item.id === actionMenu.itemId);
                    handleOpenDialog(itemToEdit);
                    handleActionMenuClose();
                }}>
                    <EditIcon fontSize="small" sx={{ mr: 1 }} /> Edit
                </MenuItem>

                {activeTab === 0 && ( // Stock adjustments only for active items
                    <>
                        <MenuItem onClick={() => {
                            const itemToAdjust = inventory.find(item => item.id === actionMenu.itemId);
                            openStockAdjustDialog(itemToAdjust, 'add');
                        }}>
                            <AddCircleIcon fontSize="small" sx={{ mr: 1, color: 'success.main' }} /> Add Stock
                        </MenuItem>
                        <MenuItem onClick={() => {
                            const itemToAdjust = inventory.find(item => item.id === actionMenu.itemId);
                            openStockAdjustDialog(itemToAdjust, 'remove');
                        }}>
                            <RemoveCircleIcon fontSize="small" sx={{ mr: 1, color: 'error.main' }} /> Remove Stock
                        </MenuItem>
                    </>
                )}

                {activeTab === 0 ? (
                    <MenuItem onClick={() => handleRemove(actionMenu.itemId)}>
                        <RemoveIcon fontSize="small" sx={{ mr: 1 }} /> Remove Item
                    </MenuItem>
                ) : (
                    <MenuItem onClick={() => handleRestore(actionMenu.itemId)}>
                        <RestoreIcon fontSize="small" sx={{ mr: 1 }} /> Restore Item
                    </MenuItem>
                )}
            </Menu>

            {/* Add/Edit Item Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} fullWidth maxWidth="sm">
                <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
                <form onSubmit={handleSubmit}>
                    <DialogContent>
                        <TextField name="name" label="Item Name" value={formData.name} onChange={handleInputChange} fullWidth margin="dense" required />
                        <TextField name="category" label="Category" value={formData.category} onChange={handleInputChange} fullWidth margin="dense" required />
                        <TextField name="quantity" label="Quantity" type="number" value={formData.quantity} onChange={handleInputChange} fullWidth margin="dense" required InputProps={{ inputProps: { min: 0 } }} />
                        <TextField name="unit" label="Unit (e.g., pcs, kg, box)" value={formData.unit} onChange={handleInputChange} fullWidth margin="dense" required />
                        <TextField name="price" label="Price (₱)" type="number" value={formData.price} onChange={handleInputChange} fullWidth margin="dense" required InputProps={{ inputProps: { min: 0, step: "0.01" } }} />
                        <TextField name="minStock" label="Minimum Stock Level" type="number" value={formData.minStock} onChange={handleInputChange} fullWidth margin="dense" required InputProps={{ inputProps: { min: 0 } }} />
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog}>Cancel</Button>
                        <Button type="submit" variant="contained">{editingItem ? 'Save Changes' : 'Add Item'}</Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Stock Adjustment Dialog */}
            <Dialog open={stockAdjustDialog.open} onClose={closeStockAdjustDialog} fullWidth maxWidth="xs">
                <DialogTitle>
                    {stockAdjustDialog.adjustmentType === 'add' ? 'Add Stock to ' : 'Remove Stock from '}
                    <strong>{stockAdjustDialog.item?.name}</strong>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <Typography variant="body1" gutterBottom>
                            Current Stock: {stockAdjustDialog.item?.quantity} {stockAdjustDialog.item?.unit}
                        </Typography>
                        <TextField
                            autoFocus
                            margin="dense"
                            fullWidth
                            label="Amount to Adjust"
                            type="number"
                            value={stockAdjustDialog.amount}
                            onChange={(e) => {
                                const val = e.target.value;
                                setStockAdjustDialog(prev => ({ ...prev, amount: val }));
                            }}
                            InputProps={{
                                inputProps: { min: 1 }
                            }}
                            helperText="Enter a positive number for adjustment."
                            sx={{ mt: 1 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeStockAdjustDialog}>Cancel</Button>
                    <Button
                        onClick={handleStockAdjustment}
                        variant="contained"
                        disabled={!stockAdjustDialog.amount || Number(stockAdjustDialog.amount) <= 0}
                        color={stockAdjustDialog.adjustmentType === 'add' ? 'success' : 'error'}
                    >
                        {stockAdjustDialog.adjustmentType === 'add' ? 'Add to Stock' : 'Remove from Stock'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirmation Dialog */}
            <Dialog open={confirmDialog.open} onClose={closeConfirmDialog} fullWidth maxWidth="xs">
                <DialogTitle>{confirmDialog.title}</DialogTitle>
                <DialogContent>
                    <Typography>{confirmDialog.message}</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeConfirmDialog}>Cancel</Button>
                    <Button
                        onClick={() => {
                            if (confirmDialog.action) confirmDialog.action();
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
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Alert
                    onClose={() => setNotification({ ...notification, open: false })}
                    severity={notification.severity}
                    variant="filled"
                    sx={{ width: '100%' }}
                >
                    {notification.message}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default InventoryManagement;