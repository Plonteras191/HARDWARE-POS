import React, { useState } from 'react';
import {
    TextField,
    Button,
    Typography,
    IconButton,
    Paper,
    Box,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Remove as RemoveIcon,
    Delete as DeleteIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import '../styles/pos.css';

// Sample products data (in a real app, this would come from your inventory)
const sampleProducts = [
    {
        id: 1,
        name: '2x4 Cocolumber',
        category: 'Lumber',
        price: 120.00,
        image: 'https://via.placeholder.com/150',
        stock: 100
    },
    {
        id: 2,
        name: 'Cement Bag',
        category: 'Construction',
        price: 280.00,
        image: 'https://via.placeholder.com/150',
        stock: 50
    },
    {
        id: 3,
        name: 'Gravel (1 cu.m)',
        category: 'Construction',
        price: 1500.00,
        image: 'https://via.placeholder.com/150',
        stock: 30
    },
    {
        id: 4,
        name: 'Sand (1 cu.m)',
        category: 'Construction',
        price: 1200.00,
        image: 'https://via.placeholder.com/150',
        stock: 25
    }
];

const POS = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart] = useState([]);

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

    const getTotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const handleCheckout = () => {
        // In a real app, this would process the sale and update inventory
        alert('Sale completed! Total: ₱' + getTotal().toFixed(2));
        setCart([]);
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
                            <img
                                src={product.image}
                                alt={product.name}
                                className="product-image"
                            />
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
                <Typography variant="h5" gutterBottom>
                    Shopping Cart
                </Typography>
                <Divider />
                
                <div className="cart-items">
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

                <div className="cart-summary">
                    <div className="cart-total">
                        <Typography>Total:</Typography>
                        <Typography>₱{getTotal().toFixed(2)}</Typography>
                    </div>
                    <Button
                        variant="contained"
                        color="primary"
                        fullWidth
                        className="checkout-button"
                        onClick={handleCheckout}
                        disabled={cart.length === 0}
                    >
                        Checkout
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default POS; 