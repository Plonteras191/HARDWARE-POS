import React, { useState, useRef } from 'react';
import {
    TextField,
    Button,
    Typography,
    IconButton,
    Paper,
    Box,
    Divider,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    InputAdornment
} from '@mui/material';
import {
    Add as AddIcon,
    Remove as RemoveIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    Receipt as ReceiptIcon,
    Discount as DiscountIcon
} from '@mui/icons-material';
import '../styles/pos.css'; // Ensure this path is correct

// Sample products data
const sampleProducts = [
    { id: 1, name: '2x4 Cocolumber', category: 'Lumber', price: 120.00, stock: 100 },
    { id: 2, name: 'Cement Bag', category: 'Construction', price: 280.00, stock: 50 },
    { id: 3, name: 'Gravel (1 cu.m)', category: 'Construction', price: 1500.00, stock: 30 },
    { id: 4, name: 'Sand (1 cu.m)', category: 'Construction', price: 1200.00, stock: 25 }
];

const POS = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart] = useState([]);
    const [discount, setDiscount] = useState(''); // Store as string for input field flexibility
    const [discountError, setDiscountError] = useState('');
    const [receiptOpen, setReceiptOpen] = useState(false);
    const [cashReceived, setCashReceived] = useState(''); // Store as string
    const [cashReceivedError, setCashReceivedError] = useState('');
    const receiptRef = useRef(null);
    const [transactionId, setTransactionId] = useState(generateTransactionId());

    function generateTransactionId() {
        return 'TRX-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    const categories = ['All', ...new Set(sampleProducts.map(product => product.category))];

    const filteredProducts = sampleProducts.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const addToCart = (product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                return prevCart.map(item =>
                    item.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId, change) => {
        setCart(prevCart => {
            return prevCart.map(item => {
                if (item.id === productId) {
                    const newQuantity = item.quantity + change;
                    if (newQuantity <= 0) {
                        return null;
                    }
                    return { ...item, quantity: newQuantity };
                }
                return item;
            }).filter(Boolean);
        });
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => prevCart.filter(item => item.id !== productId));
    };

    const getSubtotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const getDiscountAmount = () => {
        const subtotal = getSubtotal();
        if (discountError || discount === '') {
            return 0;
        }
        const numDiscount = parseFloat(discount);
        if (isNaN(numDiscount) || numDiscount < 0 || numDiscount > 100) {
            return 0; // Should be caught by discountError, but as a safeguard
        }
        return subtotal * (numDiscount / 100);
    };

    const getTotal = () => {
        return getSubtotal() - getDiscountAmount();
    };

    const getChange = () => {
        if (cashReceivedError || cashReceived === '') return 0;
        const numCash = parseFloat(cashReceived);
        if (isNaN(numCash) || numCash < 0) return 0;

        const total = getTotal();
        return Math.max(0, numCash - total);
    };

    const handleDiscountChange = (e) => {
        const value = e.target.value;
        setDiscount(value);
        if (value === '') {
            setDiscountError('');
            return;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            setDiscountError('Invalid number');
        } else if (numValue < 0) {
            setDiscountError('Discount cannot be negative');
        } else if (numValue > 100) {
            setDiscountError('Discount cannot exceed 100%');
        } else {
            setDiscountError('');
        }
    };

    const handleCashReceivedChange = (e) => {
        const value = e.target.value;
        setCashReceived(value);
        if (value === '') {
            setCashReceivedError('');
            return;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            setCashReceivedError('Invalid number');
        } else if (numValue < 0) {
            setCashReceivedError('Cash cannot be negative');
        } else {
            setCashReceivedError('');
        }
    };


    const handleCheckout = () => {
        // Basic validation before opening dialog
        if (cart.length === 0 || discountError || cashReceivedError) {
             // Optionally, show a general message or rely on field errors
            if (cart.length === 0) alert("Cart is empty.");
            return;
        }
        // More specific validation for cash being entered could be added here if desired,
        // but the "Complete Sale" button in the dialog will handle final validation.
        setReceiptOpen(true);
    };

    const completeTransaction = () => {
        setReceiptOpen(false);
        setCart([]);
        setDiscount('');
        setDiscountError('');
        setCashReceived('');
        setCashReceivedError('');
        setTransactionId(generateTransactionId());
    };

    const formatDateTime = () => {
        const now = new Date();
        return now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    };

    const isCompleteSaleDisabled = () => {
        if (discountError || cashReceivedError) return true;
        if (cashReceived === '') return true;
        const numCash = parseFloat(cashReceived);
        if (isNaN(numCash) || numCash < 0) return true;
        return numCash < getTotal();
    };
    
    const displayableCashReceived = () => {
        if (cashReceived === '' || cashReceivedError) return 0;
        const num = parseFloat(cashReceived);
        return isNaN(num) || num < 0 ? 0 : num;
    };


    return (
        <div className="pos-container">
            <div className="pos-products">
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-bar"
                    InputProps={{
                        startAdornment: <SearchIcon sx={{ mr: 1, color: 'gray' }} />
                    }}
                />

                <div className="category-filter">
                    {categories.map(category => (
                        <Button
                            key={category}
                            variant={selectedCategory === category ? "contained" : "outlined"}
                            onClick={() => setSelectedCategory(category)}
                            className="category-button"
                        >
                            {category}
                        </Button>
                    ))}
                </div>

                <div className="product-grid">
                    {filteredProducts.map(product => (
                        <Paper
                            key={product.id}
                            className="product-card"
                            onClick={() => addToCart(product)}
                        >
                            <div className="product-info">
                                <Typography className="product-name">
                                    {product.name}
                                </Typography>
                                <Typography className="product-price">
                                    ₱{product.price.toFixed(2)}
                                </Typography>
                                <Typography variant="caption" color="textSecondary">
                                    Stock: {product.stock}
                                </Typography>
                            </div>
                        </Paper>
                    ))}
                </div>
            </div>

            <div className="pos-cart">
                <Typography variant="h5" gutterBottom sx={{ textAlign: 'center', mt: 1 }}>
                    ITEMS
                </Typography>
                <Divider sx={{ mb: 2 }}/>
                
                <div className="cart-items">
                    {cart.length === 0 && (
                        <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', my: 3 }}>
                            EMPTY
                        </Typography>
                    )}
                    {cart.map(item => (
                        <div key={item.id} className="cart-item">
                            <div className="cart-item-info">
                                <Typography variant="subtitle1">
                                    {item.name}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    ₱{item.price.toFixed(2)} x {item.quantity}
                                </Typography>
                            </div>
                            <div className="cart-item-quantity">
                                <IconButton
                                    size="small"
                                    onClick={() => updateQuantity(item.id, -1)}
                                    className="quantity-btn"
                                >
                                    <RemoveIcon />
                                </IconButton>
                                <Typography>{item.quantity}</Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => updateQuantity(item.id, 1)}
                                    className="quantity-btn"
                                >
                                    <AddIcon />
                                </IconButton>
                                <IconButton
                                    size="small"
                                    onClick={() => removeFromCart(item.id)}
                                    color="error"
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </div>
                        </div>
                    ))}
                </div>

                {cart.length > 0 && <Divider sx={{ my: 2 }} />}

                <Box 
                    display="flex" 
                    gap={2} 
                    alignItems="flex-start" // Align items to the top if they have different heights
                    sx={{ 
                        my: 2, 
                        p: 2, // Added padding
                        border: '1px solid #e0e0e0', // Softer border
                        borderRadius: '8px' // More rounded corners
                    }} 
                    className="discount-cash-section"
                >
                    <Box flex={1}> {/* Takes up half the space */}
                        <Typography variant="subtitle1" gutterBottom>Discount</Typography>
                        <TextField
                            type="number"
                            label="Percentage"
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={discount}
                            onChange={handleDiscountChange}
                            error={!!discountError}
                            helperText={discountError}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <DiscountIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                                endAdornment: <InputAdornment position="end">%</InputAdornment>,
                                inputProps: { min: 0 } // Max 100 is behaviorally handled by error
                            }}
                        />
                    </Box>
                    <Box flex={1}> {/* Takes up the other half */}
                        <Typography variant="subtitle1" gutterBottom>Payment</Typography>
                        <TextField
                            label="Cash Received"
                            type="number"
                            fullWidth
                            variant="outlined"
                            size="small"
                            value={cashReceived}
                            onChange={handleCashReceivedChange}
                            error={!!cashReceivedError}
                            helperText={cashReceivedError}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                                inputProps: { min: 0 }
                            }}
                        />
                    </Box>
                </Box>


                <div className="cart-summary">
                    <div className="cart-total-line">
                        <Typography>Subtotal:</Typography>
                        <Typography>₱{getSubtotal().toFixed(2)}</Typography>
                    </div>
                    <div className="cart-total-line">
                        <Typography>Discount {discount && !discountError && parseFloat(discount)>0 ? `(${parseFloat(discount)}%)` : ''}:</Typography>
                        <Typography>- ₱{getDiscountAmount().toFixed(2)}</Typography>
                    </div>
                    <Divider sx={{my:1}}/>
                    <div className="cart-total">
                        <Typography variant="h6">Total:</Typography>
                        <Typography variant="h6">₱{getTotal().toFixed(2)}</Typography>
                    </div>
                    <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        className="checkout-button"
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || !!discountError || !!cashReceivedError}
                        startIcon={<ReceiptIcon />}
                        sx={{ mt: 2 }}
                    >
                        Checkout
                    </Button>
                </div>
            </div>

            {/* Receipt Dialog */}
            <Dialog 
                open={receiptOpen} 
                onClose={() => setReceiptOpen(false)}
                maxWidth="xs" // Adjusted for a typical receipt width
                fullWidth
            >
                <DialogTitle sx={{ textAlign: 'center', pb:0 }}>Transaction Summary</DialogTitle>
                <DialogContent>
                    {/* Store Name and Address Removed */}
                                        
                    <Paper elevation={0} sx={{ p: 2, mt: 1, border: '1px dashed grey' }} ref={receiptRef}>
                        <Box display="flex" justifyContent="space-between" mb={1}>
                            <Typography variant="caption">Transaction: {transactionId}</Typography>
                            <Typography variant="caption">{formatDateTime()}</Typography>
                        </Box>
                        
                        <Divider sx={{ my: 1 }} />
                        
                        {cart.map((item, index) => (
                            <Box key={index} display="flex" justifyContent="space-between" mb={0.5}>
                                <Typography variant="body2">
                                    {item.quantity}x {item.name}
                                </Typography>
                                <Typography variant="body2">
                                    ₱{(item.price * item.quantity).toFixed(2)}
                                </Typography>
                            </Box>
                        ))}
                        
                        <Divider sx={{ my: 1 }} />
                        
                        <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">Subtotal:</Typography>
                            <Typography variant="body2">₱{getSubtotal().toFixed(2)}</Typography>
                        </Box>
                        
                        <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">
                                Discount {discount && !discountError && parseFloat(discount)>0 ? `(${parseFloat(discount)}%)` : ''}:
                            </Typography>
                            <Typography variant="body2">- ₱{getDiscountAmount().toFixed(2)}</Typography>
                        </Box>
                        
                        <Divider sx={{ my: 1 }} />

                        <Box display="flex" justifyContent="space-between" mb={0.5}>
                            <Typography variant="subtitle1" fontWeight="bold">Total:</Typography>
                            <Typography variant="subtitle1" fontWeight="bold">₱{getTotal().toFixed(2)}</Typography>
                        </Box>
                        
                        <Box display="flex" justifyContent="space-between">
                            <Typography variant="body2">Cash Tendered:</Typography>
                            <Typography variant="body2">₱{displayableCashReceived().toFixed(2)}</Typography>
                        </Box>
                        
                        <Box display="flex" justifyContent="space-between" mb={2}>
                            <Typography variant="subtitle1" fontWeight="bold">Change:</Typography>
                            <Typography variant="subtitle1" fontWeight="bold">₱{getChange().toFixed(2)}</Typography>
                        </Box>
                        
                        <Divider sx={{ mb: 1 }} />
                        
                        <Box display="flex" flexDirection="column" alignItems="center">
                            <Typography variant="body2" sx={{fontSize: '0.8rem'}}>Thank you for your purchase!</Typography>
                            <Typography variant="caption" sx={{fontSize: '0.7rem'}}>Please come again</Typography>
                        </Box>
                    </Paper>
                </DialogContent>
                <DialogActions sx={{p:2}}>
                    <Button onClick={() => setReceiptOpen(false)} color="inherit">Cancel</Button>
                    <Button 
                        variant="contained" 
                        color="primary" 
                        onClick={completeTransaction}
                        disabled={isCompleteSaleDisabled()}
                    >
                        Complete Sale
                    </Button>
                </DialogActions>
            </Dialog>
        </div>
    );
};

export default POS;