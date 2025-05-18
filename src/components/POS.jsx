import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/pos.module.css'; // Updated to use CSS module

// API base URL
const API_BASE_URL = 'http://localhost/HARD-POS/backend/api';

const POS = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart] = useState([]);
    const [discount, setDiscount] = useState('');
    const [discountError, setDiscountError] = useState('');
    const [receiptOpen, setReceiptOpen] = useState(false);
    const [cashReceived, setCashReceived] = useState('');
    const [cashReceivedError, setCashReceivedError] = useState('');
    const receiptRef = useRef(null);
    const [transactionId, setTransactionId] = useState(generateTransactionId());
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState(['All']);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
    const [saleComplete, setSaleComplete] = useState(false);

    function generateTransactionId() {
        return 'TRX-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    useEffect(() => {
        fetchProducts();
        fetchCategories();
    }, []);

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/pos_api.php?action=products`);
            if (!response.ok) throw new Error('Failed to fetch products');
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setProducts(data.products || []);
            setError(null);
        } catch (err) {
            setError(err.message);
            showNotification(`Error: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/pos_api.php?action=categories`);
            if (!response.ok) throw new Error('Failed to fetch categories');
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            setCategories(['All', ...(data.categories || []).map(cat => cat.name)]);
        } catch (err) {
            console.error('Failed to load categories:', err);
        }
    };

    const showNotification = (message, severity = 'info') => {
        setNotification({ open: true, message, severity });
        const timer = setTimeout(() => setNotification({ ...notification, open: false }), 6000);
        return () => clearTimeout(timer);
    };

    const showSaleCompleteNotification = () => {
        setSaleComplete(true);
        const timer = setTimeout(() => setSaleComplete(false), 3000);
        return () => clearTimeout(timer);
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const addToCart = (product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                const productInProducts = products.find(p => p.id === product.id);
                if (productInProducts && existingItem.quantity + 1 > productInProducts.stock) {
                    showNotification(`Cannot add more. Only ${productInProducts.stock} units of ${product.name} available.`, 'warning');
                    return prevCart;
                }
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            const productInProducts = products.find(p => p.id === product.id);
            if (productInProducts && 1 > productInProducts.stock) {
                showNotification(`Cannot add ${product.name}. Item is out of stock.`, 'warning');
                return prevCart;
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const updateQuantity = (productId, change) => {
        setCart(prevCart => {
            const updatedCart = prevCart.map(item => {
                if (item.id === productId) {
                    const newQuantity = item.quantity + change;
                    const productInProducts = products.find(p => p.id === productId);
                    const availableStock = productInProducts ? productInProducts.stock : 0;
                    if (newQuantity <= 0) return null;
                    if (newQuantity > availableStock) {
                        showNotification(`Cannot add more. Only ${availableStock} units of ${item.name} available.`, 'warning');
                        return item;
                    }
                    return { ...item, quantity: newQuantity };
                }
                return item;
            }).filter(Boolean);
            if (prevCart.length > updatedCart.length) {
                const currentTotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0) * (1 - (parseFloat(discount) || 0) / 100);
                if (parseFloat(cashReceived) < currentTotal && parseFloat(cashReceived) > 0) {
                    setCashReceivedError('Cash received is now less than the total.');
                } else {
                    setCashReceivedError('');
                }
            }
            return updatedCart;
        });
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => {
            const updatedCart = prevCart.filter(item => item.id !== productId);
            const currentTotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0) * (1 - (parseFloat(discount) || 0) / 100);
            if (parseFloat(cashReceived) < currentTotal && parseFloat(cashReceived) > 0) {
                setCashReceivedError('Cash received is now less than the total.');
            } else {
                setCashReceivedError('');
            }
            return updatedCart;
        });
    };

    const getSubtotal = () => {
        return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
    };

    const getDiscountAmount = () => {
        const subtotal = getSubtotal();
        if (discountError || discount === '') return 0;
        const numDiscount = parseFloat(discount);
        if (isNaN(numDiscount) || numDiscount < 0 || numDiscount > 100) return 0;
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

    const displayableCashReceived = () => {
        if (cashReceived === '' || cashReceivedError) return 0;
        const num = parseFloat(cashReceived);
        return isNaN(num) || num < 0 ? 0 : num;
    };

    const handleDiscountChange = (e) => {
        const value = e.target.value;
        setDiscount(value);
        if (value === '') {
            setDiscountError('');
            if (parseFloat(cashReceived) < getSubtotal() && parseFloat(cashReceived) > 0) {
                setCashReceivedError('Cash received is now less than the total.');
            } else {
                setCashReceivedError('');
            }
            return;
        }
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
            setDiscountError('Invalid number');
            setCashReceivedError('');
        } else if (numValue < 0) {
            setDiscountError('Discount cannot be negative');
            setCashReceivedError('');
        } else if (numValue > 100) {
            setDiscountError('Discount cannot exceed 100%');
            setCashReceivedError('');
        } else {
            setDiscountError('');
            const currentTotal = getSubtotal() * (1 - numValue / 100);
            if (parseFloat(cashReceived) < currentTotal && parseFloat(cashReceived) > 0) {
                setCashReceivedError('Cash received is now less than the total.');
            } else {
                setCashReceivedError('');
            }
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
        const total = getTotal();
        if (isNaN(numValue)) {
            setCashReceivedError('Invalid number');
        } else if (numValue < 0) {
            setCashReceivedError('Cash cannot be negative');
        } else if (numValue < total && total > 0) {
            setCashReceivedError('Cash received is less than total');
        } else {
            setCashReceivedError('');
        }
    };

    const handleCheckout = () => {
        if (cart.length === 0) {
            showNotification('Cart is empty.', 'warning');
            return;
        }
        if (discountError || cashReceivedError) {
            showNotification('Please fix input errors before checkout.', 'warning');
            return;
        }
        const total = getTotal();
        const numCash = parseFloat(cashReceived);
        if (isNaN(numCash) || numCash < total) {
            setCashReceivedError('Cash received must be greater than or equal to total.');
            showNotification('Please enter a valid cash amount.', 'warning');
            return;
        }
        setReceiptOpen(true);
    };

    const completeTransaction = async () => {
        if (isCompleteSaleDisabled()) {
            showNotification('Please verify all data before completing the sale.', 'warning');
            return;
        }
        for (const item of cart) {
            const productInProducts = products.find(p => p.id === item.id);
            if (!productInProducts || item.quantity > productInProducts.stock) {
                showNotification(`Stock for ${item.name} changed. Available: ${productInProducts ? productInProducts.stock : 0}, Cart: ${item.quantity}. Please update cart.`, 'error');
                setReceiptOpen(false);
                fetchProducts();
                return;
            }
        }
        try {
            const transactionData = {
                transactionId,
                items: cart.map(item => ({ id: item.id, quantity: item.quantity, price: item.price })),
                subtotal: getSubtotal(),
                discount: discount ? parseFloat(discount) : 0,
                total: getTotal(),
                cashReceived: parseFloat(cashReceived),
                notes: ''
            };
            const response = await fetch(`${API_BASE_URL}/pos_api.php?action=create-transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactionData)
            });
            const data = await response.json();
            if (data.error) {
                setReceiptOpen(false);
                showNotification(`Transaction failed: ${data.error}`, 'error');
                fetchProducts();
                return;
            }
            showSaleCompleteNotification();
            setReceiptOpen(false);
            setCart([]);
            setDiscount('');
            setDiscountError('');
            setCashReceived('');
            setCashReceivedError('');
            setTransactionId(generateTransactionId());
            fetchProducts();
        } catch (err) {
            setReceiptOpen(false);
            showNotification(`Network or server error: ${err.message}`, 'error');
        }
    };

    const formatDateTime = () => {
        const now = new Date();
        return now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    };

    const isCompleteSaleDisabled = () => {
        if (cart.length === 0) return true;
        if (discountError || cashReceivedError) return true;
        const numCash = parseFloat(cashReceived);
        const total = getTotal();
        return isNaN(numCash) || numCash < 0 || numCash < total;
    };

    return (
        <div className={styles.posContainer}>
            <div className={styles.posProducts}>
                <div className={styles.searchBar}>
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <span className={styles.searchIcon}>🔍</span>
                </div>

                <div className={styles.categoryFilter}>
                    {categories.map(category => (
                        <button
                            key={category}
                            className={`${styles.categoryButton} ${selectedCategory === category ? styles.active : ''}`}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className={styles.productGrid}>
                    {loading ? (
                        <div className={styles.loading}>
                            <div className={styles.spinner}></div>
                            <p>Loading products...</p>
                        </div>
                    ) : error ? (
                        <div className={styles.error}>
                            <i className={styles.errorIcon}>⚠️</i>
                            <p>{error}</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className={styles.noProducts}>
                            <i className={styles.emptyIcon}>📦</i>
                            <p>No products found</p>
                        </div>
                    ) : (
                        filteredProducts.map(product => (
                            <div key={product.id} className={styles.productCard} onClick={() => addToCart(product)}>
                                <div className={styles.productInfo}>
                                    <p className={styles.productName}>{product.name}</p>
                                    <p className={styles.productSupplier}>Supplier: {product.supplier_name}</p>
                                    <p className={styles.productPrice}>₱{product.price.toFixed(2)}</p>
                                    <p className={styles.productStock}>
                                        <span className={`${styles.stockIndicator} ${parseInt(product.stock) > 10 ? styles.inStock : parseInt(product.stock) > 0 ? styles.lowStock : styles.outStock}`}></span>
                                        Stock: {product.stock} {product.unit}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className={styles.posCart}>
                <h2 className={styles.cartTitle}>YOUR CART</h2>
                <hr className={styles.cartDivider} />
                <div className={styles.cartItems}>
                    {cart.length === 0 && (
                        <div className={styles.emptyCart}>
                            <i className={styles.cartIcon}>🛒</i>
                            <p>Your cart is empty</p>
                        </div>
                    )}
                    {cart.map(item => (
                        <div key={item.id} className={styles.cartItem}>
                            <div className={styles.cartItemInfo}>
                                <p className={styles.itemName}>{item.name}</p>
                                <p className={styles.itemDetails}>₱{item.price.toFixed(2)} x {item.quantity} {item.unit || ''}</p>
                                <p className={styles.itemTotal}>₱{(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                            <div className={styles.cartItemQuantity}>
                                <button onClick={() => updateQuantity(item.id, -1)} className={`${styles.qtyBtn} ${styles.decrease}`}>−</button>
                                <span className={styles.qtyValue}>{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id, 1)} className={`${styles.qtyBtn} ${styles.increase}`}>+</button>
                                <button onClick={() => removeFromCart(item.id)} className={styles.deleteBtn}>
                                    <span className={styles.deleteIcon}>🗑️</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {cart.length > 0 && <hr className={styles.cartDivider} />}

                <div className={styles.discountCashSection}>
                    <div className={styles.inputGroup}>
                        <label>Discount (%)</label>
                        <input
                            type="number"
                            value={discount}
                            onChange={handleDiscountChange}
                            min="0"
                            max="100"
                            placeholder="0"
                        />
                        {discountError && <p className={styles.error}>{discountError}</p>}
                    </div>
                    <div className={styles.inputGroup}>
                        <label>Cash Received</label>
                        <input
                            type="number"
                            value={cashReceived}
                            onChange={handleCashReceivedChange}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className={getTotal() > 0 && !cashReceived && !cashReceivedError ? styles.highlightInput : ""}
                        />
                        {cashReceivedError && <p className={styles.error}>{cashReceivedError}</p>}
                    </div>
                </div>

                <div className={styles.cartSummary}>
                    <div className={styles.summaryLine}>
                        <span>Subtotal:</span>
                        <span>₱{getSubtotal().toFixed(2)}</span>
                    </div>
                    <div className={styles.summaryLine}>
                        <span>Discount {discount && !discountError && parseFloat(discount) > 0 ? `(${parseFloat(discount)}%)` : ''}:</span>
                        <span>- ₱{getDiscountAmount().toFixed(2)}</span>
                    </div>
                    <hr className={styles.summaryDivider} />
                    <div className={styles.summaryTotal}>
                        <span>Total:</span>
                        <span>₱{getTotal().toFixed(2)}</span>
                    </div>
                    {(getTotal() > 0 || cashReceived > 0) && (
                        <>
                            <div className={styles.summaryLine}>
                                <span>Cash Received:</span>
                                <span>₱{displayableCashReceived().toFixed(2)}</span>
                            </div>
                            <div className={styles.summaryLine}>
                                <span>Change:</span>
                                <span className={styles.changeAmount}>₱{getChange().toFixed(2)}</span>
                            </div>
                        </>
                    )}
                    <button
                        className={styles.checkoutButton}
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || !!discountError || !!cashReceivedError || getTotal() <= 0}
                    >
                        <span className={styles.checkoutIcon}>💳</span> SELL
                    </button>
                </div>
            </div>

            {receiptOpen && (
                <div className={styles.modalBackdrop}>
                    <div className={styles.modalContent}>
                        <h2 className={styles.receiptHeader}>Transaction Summary</h2>
                        <div className={styles.receipt} ref={receiptRef}>
                            <div className={styles.receiptStore}>
                                <h3>CJ'S STORE</h3>
                                <p className={styles.receiptTransaction}>Transaction: {transactionId}</p>
                                <p className={styles.receiptDate}>{formatDateTime()}</p>
                            </div>
                            <hr className={styles.receiptDivider} />
                            <div className={styles.receiptItems}>
                                {cart.map((item, index) => (
                                    <div key={index} className={styles.receiptItem}>
                                        <span>{item.quantity}x {item.name}</span>
                                        <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <hr className={styles.receiptDivider} />
                            <div className={styles.receiptSummary}>
                                <span>Subtotal:</span>
                                <span>₱{getSubtotal().toFixed(2)}</span>
                            </div>
                            {getDiscountAmount() > 0 && (
                                <div className={styles.receiptSummary}>
                                    <span>Discount {discount && !discountError && parseFloat(discount) > 0 ? `(${parseFloat(discount)}%)` : ''}:</span>
                                    <span>- ₱{getDiscountAmount().toFixed(2)}</span>
                                </div>
                            )}
                            <hr className={styles.receiptDivider} />
                            <div className={styles.receiptTotal}>
                                <span>Total:</span>
                                <span>₱{getTotal().toFixed(2)}</span>
                            </div>
                            {getTotal() > 0 && (
                                <>
                                    <div className={styles.receiptSummary}>
                                        <span>Cash Tendered:</span>
                                        <span>₱{displayableCashReceived().toFixed(2)}</span>
                                    </div>
                                    <div className={styles.receiptSummary}>
                                        <span>Change:</span>
                                        <span>₱{getChange().toFixed(2)}</span>
                                    </div>
                                </>
                            )}
                            <hr className={styles.receiptDivider} />
                            <div className={styles.receiptFooter}>
                                <p>Thank you for your purchase!</p>
                                <p>Please come again</p>
                            </div>
                        </div>
                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setReceiptOpen(false)}>
                                <span className={styles.btnIcon}>✖</span> Cancel
                            </button>
                            <button
                                className={styles.completeBtn}
                                onClick={completeTransaction}
                                disabled={isCompleteSaleDisabled()}
                            >
                                <span className={styles.btnIcon}>✓</span> Complete Sale
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={`${styles.notification} ${notification.open ? styles.open : ''} ${styles[notification.severity]}`}>
                {notification.message}
            </div>

            <div className={`${styles.saleCompleteNotification} ${saleComplete ? styles.show : ''}`}>
                <div className={styles.checkmark}>✓</div>
                <p>Sale Completed Successfully!</p>
            </div>
        </div>
    );
};

export default POS;