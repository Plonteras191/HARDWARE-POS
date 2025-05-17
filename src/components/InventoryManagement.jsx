
import React, { useState, useEffect, useCallback } from 'react';
import '../styles/inventory.css';

const API_BASE_URL = 'http://localhost/HARD-POS/backend/api';

const InventoryManagement = () => {
    const [inventory, setInventory] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [openDialog, setOpenDialog] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: '',
        supplier_name: '',
        quantity: '',
        unit: '',
        price: '',
        minStock: ''
    });
    const [formErrors, setFormErrors] = useState({ name: '' });
    const [activeTab, setActiveTab] = useState(0);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [loading, setLoading] = useState(false);
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
        adjustmentType: null,
        notes: ''
    });

    const fetchInventory = useCallback(async () => {
        setLoading(true);
        try {
            const isActive = activeTab === 0 ? 'true' : 'false';
            let url = `${API_BASE_URL}/inventory_management.php?active=${isActive}`;
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to fetch data' }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.products) {
                const filteredProducts = data.products.filter(item =>
                    activeTab === 0 ? !item.isRemoved : item.isRemoved
                );
                setInventory(filteredProducts);
            } else if (data.error) {
                throw new Error(data.error);
            } else {
                setInventory([]);
            }
        } catch (error) {
            console.error("Error fetching inventory:", error);
            setNotification({
                open: true,
                message: `Error fetching inventory: ${error.message}`,
                severity: 'error'
            });
            setInventory([]);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, activeTab]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    useEffect(() => {
        const lowStockItems = inventory.filter(item => !item.isRemoved && item.quantity <= item.minStock);
        if (lowStockItems.length > 0 && activeTab === 0) {
            setNotification({
                open: true,
                message: `Low stock alert: ${lowStockItems.map(item => item.name).join(', ')} ${lowStockItems.length === 1 ? 'is' : 'are'} running low.`,
                severity: 'warning'
            });
        } else if (notification.severity === 'warning') {
            setNotification(prev => ({ ...prev, open: false }));
        }
    }, [inventory, activeTab]);

    const handleTabChange = (newValue) => {
        setActiveTab(newValue);
        setPage(0);
    };

    const handleOpenDialog = (item = null) => {
        if (item) {
            setEditingItem(item);
            setFormData({
                name: item.name,
                category: item.category,
                supplier_name: item.supplier_name || '',
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
                supplier_name: '',
                quantity: '',
                unit: '',
                price: '',
                minStock: ''
            });
        }
        setFormErrors({ name: '' });
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingItem(null);
        setFormErrors({ name: '' });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (name === 'name') {
            setFormErrors(prev => ({
                ...prev,
                name: ''
            }));
        }
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
        setConfirmDialog(prev => ({ ...prev, open: false }));
    };

    const openStockAdjustDialog = (item, type) => {
        const currentItem = inventory.find(invItem => invItem.id === item.id);
        if (!currentItem) {
            setNotification({ open: true, message: 'Item not found for stock adjustment.', severity: 'error' });
            return;
        }
        setStockAdjustDialog({
            open: true,
            item: currentItem,
            amount: '',
            notes: '',
            adjustmentType: type
        });
    };

    const closeStockAdjustDialog = () => {
        setStockAdjustDialog(prev => ({ ...prev, open: false, item: null, amount: '', notes: '' }));
    };

    const handleStockAdjustment = async () => {
        const { item, amount, adjustmentType, notes } = stockAdjustDialog;

        if (!item || !adjustmentType || !amount || Number(amount) <= 0) {
            setNotification({
                open: true,
                message: 'Please enter a valid positive amount for adjustment.',
                severity: 'error'
            });
            return;
        }

        if (!notes.trim()) {
            setNotification({
                open: true,
                message: 'Please provide a note for the adjustment.',
                severity: 'error'
            });
            return;
        }

        const payload = {
            amount: Number(amount),
            adjustmentType,
            notes: notes.trim()
        };

        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/inventory_management.php?action=adjust-stock&id=${item.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            setNotification({
                open: true,
                message: result.message || 'Stock adjusted successfully!',
                severity: 'success'
            });

            if (result.product) {
                setInventory(prevInventory =>
                    prevInventory.map(invItem =>
                        invItem.id === result.product.id ? { ...invItem, quantity: result.product.quantity } : invItem
                    )
                );
            } else {
                fetchInventory();
            }
            closeStockAdjustDialog();
        } catch (error) {
            console.error("Error adjusting stock:", error);
            setNotification({
                open: true,
                message: `Error adjusting stock: ${error.message}`,
                severity: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleProductStatus = async (id, currentIsRemoved) => {
        const item = inventory.find(item => item.id === id);
        if (!item) return;

        const actionText = currentIsRemoved ? "restore" : "remove";
        const newStatusText = currentIsRemoved ? "Active Items" : "Removed Items";

        openConfirmDialog(
            `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} Item`,
            `Are you sure you want to ${actionText} "${item.name}"? This will move the item to '${newStatusText}'.`,
            async () => {
                setLoading(true);
                try {
                    const response = await fetch(`${API_BASE_URL}/inventory_management.php?action=toggle-status&id=${id}`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                    const result = await response.json();

                    if (!response.ok || result.error) {
                        throw new Error(result.error || `HTTP error! status: ${response.status}`);
                    }

                    setNotification({
                        open: true,
                        message: result.message || `"${item.name}" status updated successfully.`,
                        severity: 'success'
                    });

                    setInventory(prevInventory =>
                        prevInventory.filter(invItem => invItem.id !== id)
                    );
                    fetchInventory();
                } catch (error) {
                    console.error(`Error toggling status for ${item.name}:`, error);
                    setNotification({
                        open: true,
                        message: `Error updating status: ${error.message}`,
                        severity: 'error'
                    });
                } finally {
                    setLoading(false);
                    closeConfirmDialog();
                }
            }
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.category || !formData.quantity || 
            !formData.unit || !formData.price || !formData.minStock ||
            !formData.supplier_name) {
            setNotification({ open: true, message: 'All fields are required.', severity: 'error' });
            return;
        }

        const productData = {
            name: formData.name,
            category: formData.category,
            supplier_name: formData.supplier_name,
            quantity: parseInt(formData.quantity, 10),
            unit: formData.unit,
            price: parseFloat(formData.price),
            minStock: parseInt(formData.minStock, 10)
        };

        if (isNaN(productData.quantity) || isNaN(productData.price) || isNaN(productData.minStock)) {
            setNotification({ open: true, message: 'Quantity, Price, and Min Stock must be valid numbers.', severity: 'error' });
            return;
        }
        if (productData.quantity < 0 || productData.price < 0 || productData.minStock < 0) {
            setNotification({ open: true, message: 'Quantity, Price, and Min Stock cannot be negative.', severity: 'error' });
            return;
        }

        const duplicateName = inventory.some(item => 
            item.name.toLowerCase() === formData.name.toLowerCase() && 
            !item.isRemoved && 
            (!editingItem || item.id !== editingItem.id)
        );

        if (duplicateName) {
            setFormErrors({ name: 'Product name already exists.' });
            return;
        }

        const confirmAction = async () => {
            setLoading(true);
            let url = `${API_BASE_URL}/inventory_management.php`;
            let method = 'POST';

            if (editingItem) {
                url += `?id=${editingItem.id}`;
                method = 'PUT';
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(productData),
                });

                const result = await response.json();

                if (!response.ok || result.error) {
                    throw new Error(result.error || `HTTP error! status: ${response.status}`);
                }

                setNotification({
                    open: true,
                    message: editingItem ? `"${result.product.name}" updated successfully!` : `"${result.product.name}" added successfully!`,
                    severity: 'success'
                });
                handleCloseDialog();
                fetchInventory();
            } catch (error) {
                console.error("Error submitting product:", error);
                setNotification({
                    open: true,
                    message: `Error: ${error.message}`,
                    severity: 'error'
                });
            } finally {
                setLoading(false);
                closeConfirmDialog();
            }
        };

        if (editingItem) {
            openConfirmDialog(
                'Update Item',
                `Are you sure you want to update "${formData.name}"?`,
                confirmAction
            );
        } else {
            confirmAction();
        }
    };

    const handleChangePage = (newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedInventory = inventory.slice(startIndex, endIndex);
    const totalPages = Math.ceil(inventory.length / rowsPerPage);

    return (
        <div className="inventory-container">
            <div className="inventory-header">
                <h1>Inventory Management</h1>
                <button className="add-item-button" onClick={() => handleOpenDialog()}>
                    <span className="icon">+</span> Add New Item
                </button>
            </div>

            <div className="search-bar-container">
                <input
                    type="text"
                    className="search-bar"
                    placeholder="Search by name, category, or supplier..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(0);
                    }}
                />
            </div>

            <div className="tabs">
                <button 
                    className={`tab ${activeTab === 0 ? 'active' : ''}`} 
                    onClick={() => handleTabChange(0)}
                >
                    Active Items
                </button>
                <button 
                    className={`tab ${activeTab === 1 ? 'active' : ''}`}
                    onClick={() => handleTabChange(1)}
                >
                    Removed Items
                </button>
            </div>

            {loading && <div className="loading-spinner">Loading...</div>}

            {!loading && (
                <div className="table-container">
                    <table className="inventory-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Category</th>
                                <th>Supplier</th>
                                <th className="right-align">Quantity</th>
                                <th>Unit</th>
                                <th className="right-align">Price</th>
                                <th className="right-align">Min Stock</th>
                                <th>Status</th>
                                <th className="center-align">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedInventory.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="empty-message">
                                        {activeTab === 0 ? "No active items found." : "No removed items found."}
                                        {searchTerm && " (Try clearing the search)"}
                                    </td>
                                </tr>
                            ) : (
                                paginatedInventory.map((item) => (
                                    <tr key={item.id} className={
                                        (!item.isRemoved && item.quantity <= item.minStock && item.quantity > 0) ? 'low-stock' : 
                                        (item.quantity === 0 && !item.isRemoved) ? 'out-of-stock' : ''
                                    }>
                                        <td>{item.name}</td>
                                        <td>{item.category}</td>
                                        <td>{item.supplier_name}</td>
                                        <td className="right-align">{item.quantity}</td>
                                        <td>{item.unit}</td>
                                        <td className="right-align">₱{typeof item.price === 'number' ? item.price.toFixed(2) : 'N/A'}</td>
                                        <td className="right-align">{item.minStock}</td>
                                        <td>
                                            {!item.isRemoved ? (
                                                item.quantity === 0 ? (
                                                    <span className="status out-of-stock">Out of Stock</span>
                                                ) : item.quantity <= item.minStock ? (
                                                    <span className="status low-stock">Low Stock</span>
                                                ) : (
                                                    <span className="status in-stock">In Stock</span>
                                                )
                                            ) : (
                                                <span className="status removed">Removed</span>
                                            )}
                                        </td>
                                        <td className="center-align action-buttons">
                                            {!item.isRemoved ? (
                                                <>
                                                    <button 
                                                        className="action-button edit"
                                                        onClick={() => handleOpenDialog(item)}
                                                        title="Edit"
                                                    >
                                                        ✏️
                                                    </button>
                                                    <button 
                                                        className="action-button add-stock"
                                                        onClick={() => openStockAdjustDialog(item, 'add')}
                                                        title="Add Stock"
                                                    >
                                                        ➕
                                                    </button>
                                                    <button 
                                                        className="action-button remove-stock"
                                                        onClick={() => openStockAdjustDialog(item, 'remove')}
                                                        title="Remove Stock"
                                                    >
                                                        ➖
                                                    </button>
                                                    <button 
                                                        className="action-button remove-item"
                                                        onClick={() => toggleProductStatus(item.id, false)}
                                                        title="Remove Item"
                                                    >
                                                        🗑️
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    className="action-button restore"
                                                    onClick={() => toggleProductStatus(item.id, true)}
                                                    title="Restore Item"
                                                >
                                                    ♻️
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    
                    <div className="pagination">
                        <button 
                            className="pagination-button" 
                            disabled={page === 0}
                            onClick={() => handleChangePage(page - 1)}
                        >
                            {'< Prev'}
                        </button>
                        <span className="page-info">
                            Page {page + 1} of {totalPages || 1}
                        </span>
                        <button 
                            className="pagination-button" 
                            disabled={page >= totalPages - 1 || paginatedInventory.length === 0}
                            onClick={() => handleChangePage(page + 1)}
                        >
                            Next {'>'}
                        </button>
                        <select 
                            className="rows-per-page" 
                            value={rowsPerPage}
                            onChange={handleChangeRowsPerPage}
                        >
                            <option value={5}>5 per page</option>
                            <option value={10}>10 per page</option>
                            <option value={25}>25 per page</option>
                        </select>
                    </div>
                </div>
            )}

            {openDialog && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>{editingItem ? 'Edit Item' : 'Add New Item'}</h2>
                            <button className="close-button" onClick={handleCloseDialog}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label htmlFor="name">Name</label>
                                    <input
                                        id="name"
                                        name="name"
                                        type="text"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                        className={formErrors.name ? 'error' : ''}
                                    />
                                    {formErrors.name && (
                                        <span className="error-message">{formErrors.name}</span>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="category">Category</label>
                                    <input
                                        id="category"
                                        name="category"
                                        type="text"
                                        value={formData.category}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="supplier_name">Supplier</label>
                                    <input
                                        id="supplier_name"
                                        name="supplier_name"
                                        type="text"
                                        value={formData.supplier_name}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="quantity">Quantity</label>
                                    <input
                                        id="quantity"
                                        name="quantity"
                                        type="number"
                                        min="0"
                                        value={formData.quantity}
                                        onChange={handleInputChange}
                                        required
                                        disabled={!!editingItem}
                                    />
                                    {editingItem && (
                                        <small className="helper-text">Quantity is managed via Add/Remove Stock actions.</small>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label htmlFor="unit">Unit (e.g., pcs, bags, gallon)</label>
                                    <input
                                        id="unit"
                                        name="unit"
                                        type="text"
                                        value={formData.unit}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="price">Price (₱)</label>
                                    <input
                                        id="price"
                                        name="price"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="minStock">Minimum Stock Level</label>
                                    <input
                                        id="minStock"
                                        name="minStock"
                                        type="number"
                                        min="0"
                                        value={formData.minStock}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="button secondary" onClick={handleCloseDialog}>Cancel</button>
                                <button type="submit" className="button primary">
                                    {editingItem ? 'Save Changes' : 'Add Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {confirmDialog.open && (
                <div className="modal-overlay">
                    <div className="modal confirm-dialog">
                        <div className="modal-header">
                            <h2>{confirmDialog.title}</h2>
                        </div>
                        <div className="modal-body">
                            <p>{confirmDialog.message}</p>
                        </div>
                        <div className="modal-footer">
                            <button className="button secondary" onClick={closeConfirmDialog}>Cancel</button>
                            <button 
                                className="button primary" 
                                onClick={() => {
                                    if (confirmDialog.action) confirmDialog.action();
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {stockAdjustDialog.open && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h2>
                                {stockAdjustDialog.adjustmentType === 'add' ? 'Add Stock to ' : 'Remove Stock from '}
                                <span className="emphasized">{stockAdjustDialog.item?.name}</span>
                            </h2>
                            <button className="close-button" onClick={closeStockAdjustDialog}>×</button>
                        </div>
                        <div className="modal-body">
                            <p className="current-quantity">Current Quantity: {stockAdjustDialog.item?.quantity}</p>
                            <div className="form-group">
                                <label htmlFor="adjustment-amount">Amount to Adjust</label>
                                <input
                                    id="adjustment-amount"
                                    type="number"
                                    min="1"
                                    value={stockAdjustDialog.amount}
                                    onChange={(e) => setStockAdjustDialog(prev => ({ ...prev, amount: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="adjustment-notes">Adjustment Notes (Required)</label>
                                <textarea
                                    id="adjustment-notes"
                                    value={stockAdjustDialog.notes}
                                    onChange={(e) => setStockAdjustDialog(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Enter reason for stock adjustment..."
                                    rows="3"
                                    required
                                ></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="button secondary" onClick={closeStockAdjustDialog}>Cancel</button>
                            <button className="button primary" onClick={handleStockAdjustment}>
                                {stockAdjustDialog.adjustmentType === 'add' ? 'Add' : 'Remove'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {notification.open && (
                <div className={`notification ${notification.severity}`}>
                    <span className="notification-message">{notification.message}</span>
                    <button 
                        className="notification-close" 
                        onClick={() => setNotification(prev => ({ ...prev, open: false }))}
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
};

export default InventoryManagement;