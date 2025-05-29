import React, { useState, useRef, useEffect } from 'react';
import styles from '../styles/pos.module.css';

// API base URL
const API_BASE_URL = 'http://localhost/HARD-POS/backend/api';

const POS = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [cart, setCart] = useState([]);

    const [discount, setDiscount] = useState('');
    const [discountType, setDiscountType] = useState('percent'); // 'percent' or 'fixed'
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
        const timer = setTimeout(() => setNotification({ open: false, message: '', severity: 'info' }), 6000);
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
            const productInProducts = products.find(p => p.id === product.id);

            if (!productInProducts || productInProducts.stock <= 0) {
                showNotification(`${product.name} is out of stock.`, 'warning');
                return prevCart;
            }

            if (existingItem) {
                if (existingItem.quantity + 1 > productInProducts.stock) {
                    showNotification(`Cannot add more. Only ${productInProducts.stock} units of ${product.name} available.`, 'warning');
                    return prevCart;
                }
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

    const handleQuantityInputChange = (productId, inputValue) => {
        const newQuantityInt = parseInt(inputValue, 10);

        if (inputValue === '') {
            setCart(prevCart => prevCart.map(item =>
                item.id === productId ? { ...item, quantity: '' } : item
            ));
            return;
        }

        if (isNaN(newQuantityInt) || newQuantityInt < 0) { // Allow 0 temporarily, validate on blur/checkout
            showNotification('Quantity must be a positive number.', 'warning');
            // Keep the input as is, or revert, depending on desired UX
            setCart(prevCart => prevCart.map(item =>
                item.id === productId ? { ...item, quantity: inputValue } : item // Keep invalid input for user to see
            ));
            return;
        }
        // Directly update with the potentially valid number string, final validation on blur/updateQuantity
        setCart(prevCart => prevCart.map(item =>
            item.id === productId ? { ...item, quantity: inputValue } : item
        ));
    };

    const validateAndFinalizeQuantity = (productId, quantityValue) => {
        let newQuantity = parseInt(quantityValue, 10);
        const productInProducts = products.find(p => p.id === productId);
        const availableStock = productInProducts ? productInProducts.stock : 0;

        if (isNaN(newQuantity) || newQuantity <= 0) {
            showNotification(`Invalid quantity for ${products.find(p=>p.id === productId)?.name || 'item'}. Setting to 1.`, 'warning');
            newQuantity = 1;
        }

        if (newQuantity > availableStock) {
            showNotification(`Cannot set quantity to ${newQuantity}. Only ${availableStock} units of ${productInProducts.name} available. Setting to max stock.`, 'warning');
            newQuantity = availableStock;
        }
        updateQuantity(productId, newQuantity);
    }


    const updateQuantity = (productId, newQuantityNum) => {
        setCart(prevCart => {
            const updatedCart = prevCart.map(item => {
                if (item.id === productId) {
                    return { ...item, quantity: newQuantityNum };
                }
                return item;
            }).filter(item => item.quantity > 0); // Remove item if quantity becomes 0 or less effectively

            const currentSubtotal = updatedCart.reduce((sum, item) => sum + item.price * (item.quantity || 0), 0);
            // Recalculate discount amount based on new subtotal if discount is percentage
            let currentDiscountAmount = 0;
            const numDiscount = parseFloat(discount);

            if (!discountError && discount !== '') {
                if (discountType === 'percent') {
                    if (!isNaN(numDiscount) && numDiscount >= 0 && numDiscount <= 100) {
                        currentDiscountAmount = currentSubtotal * (numDiscount / 100);
                    }
                } else { // fixed
                    if (!isNaN(numDiscount) && numDiscount >= 0) {
                        currentDiscountAmount = numDiscount;
                    }
                }
            }
            
            const currentTotal = currentSubtotal - currentDiscountAmount;

            if (parseFloat(cashReceived) < currentTotal && parseFloat(cashReceived) > 0) {
                setCashReceivedError('Cash received is now less than the total.');
            } else if (cashReceived !== '' && !isNaN(parseFloat(cashReceived)) && parseFloat(cashReceived) >= currentTotal) {
                setCashReceivedError('');
            }
            return updatedCart;
        });
    };


    const removeFromCart = (productId) => {
        setCart(prevCart => {
            const updatedCart = prevCart.filter(item => item.id !== productId);
            // Recalculate total and check cash received error
            const subtotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0);
            let newDiscountAmount = 0;
            if (!discountError && discount !== '') {
                const numDisc = parseFloat(discount);
                if (discountType === 'percent' && !isNaN(numDisc) && numDisc >=0 && numDisc <=100) {
                    newDiscountAmount = subtotal * (numDisc / 100);
                } else if (discountType === 'fixed' && !isNaN(numDisc) && numDisc >=0) {
                    newDiscountAmount = numDisc;
                }
            }
            const currentTotal = subtotal - newDiscountAmount;
            if (parseFloat(cashReceived) < currentTotal && parseFloat(cashReceived) > 0) {
                setCashReceivedError('Cash received is now less than the total.');
            } else {
                setCashReceivedError('');
            }
            return updatedCart;
        });
    };

    const getSubtotal = () => {
        return cart.reduce((total, item) => total + (item.price * (item.quantity || 0)), 0);
    };

    const getDiscountAmount = () => {
        const subtotal = getSubtotal();
        if (discountError || discount === '') return 0;

        const numDiscount = parseFloat(discount);
        if (isNaN(numDiscount) || numDiscount < 0) return 0;

        if (discountType === 'percent') {
            if (numDiscount > 100) return 0; // Invalid percentage
            return subtotal * (numDiscount / 100);
        } else { // discountType === 'fixed'
            // For fixed discount, it should not make the total negative.
            // It can be greater than subtotal if you want to allow "owing" or free items.
            // For now, let's cap it at subtotal to prevent negative total.
            return Math.min(numDiscount, subtotal);
        }
    };

    const getTotal = () => {
        return Math.max(0, getSubtotal() - getDiscountAmount()); // Ensure total is not negative
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

    const handleDiscountTypeChange = (newType) => {
        setDiscountType(newType);
        setDiscount(''); // Reset discount value when type changes
        setDiscountError('');
        // Recalculate cash received error as total might change
        const currentTotal = getSubtotal(); // Total before any new discount
        if (parseFloat(cashReceived) < currentTotal && parseFloat(cashReceived) > 0) {
            setCashReceivedError('Cash received is now less than the total.');
        } else if (cashReceived !== '' && !isNaN(parseFloat(cashReceived)) && parseFloat(cashReceived) >= currentTotal){
            setCashReceivedError('');
        }
    };

    const handleDiscountChange = (e) => {
        const value = e.target.value;
        setDiscount(value);
        const subtotal = getSubtotal();
        let currentTotalAfterDiscount = subtotal; // Initialize with subtotal

        if (value === '') {
            setDiscountError('');
        } else {
            const numValue = parseFloat(value);
            if (isNaN(numValue)) {
                setDiscountError('Invalid number');
            } else if (numValue < 0) {
                setDiscountError('Discount cannot be negative');
            } else {
                if (discountType === 'percent') {
                    if (numValue > 100) {
                        setDiscountError('Discount cannot exceed 100%');
                    } else {
                        setDiscountError('');
                        currentTotalAfterDiscount = subtotal * (1 - numValue / 100);
                    }
                } else { // discountType === 'fixed'
                    if (numValue > subtotal && subtotal > 0) { // only warn if subtotal is positive
                        setDiscountError('Fixed discount exceeds subtotal. Total will be ₱0.00.');
                         // We allow it, but show a warning. getDiscountAmount will cap it.
                    } else {
                         setDiscountError('');
                    }
                    currentTotalAfterDiscount = Math.max(0, subtotal - numValue);
                }
            }
        }
        // Update cash received error based on potentially new total
        const finalTotal = Math.max(0, currentTotalAfterDiscount); // Ensure total isn't negative from calculation
        if (parseFloat(cashReceived) < finalTotal && parseFloat(cashReceived) > 0) {
            setCashReceivedError('Cash received is now less than the total.');
        } else if (cashReceived !== '' && !isNaN(parseFloat(cashReceived)) && parseFloat(cashReceived) >= finalTotal) {
            setCashReceivedError('');
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
        const total = getTotal(); // This now correctly uses the selected discount type
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
        let cartIsValid = true;
        const validatedCart = cart.map(item => {
            const productInProducts = products.find(p => p.id === item.id);
            const availableStock = productInProducts ? productInProducts.stock : 0;
            let currentQuantity = parseInt(item.quantity, 10);

            if (isNaN(currentQuantity) || currentQuantity <= 0) {
                showNotification(`Quantity for ${item.name} is invalid. Please correct it.`, 'warning');
                cartIsValid = false;
                return {...item, quantity: 1}; // Or some other handling
            }
            if (currentQuantity > availableStock) {
                showNotification(`Quantity for ${item.name} exceeds stock (${availableStock}). Adjusting.`, 'warning');
                cartIsValid = false; // Or true if you auto-adjust and proceed
                return {...item, quantity: availableStock};
            }
            return item;
        });

        if (!cartIsValid) {
            setCart(validatedCart); // Update cart with corrected quantities
            return;
        }


        if (cart.length === 0) {
            showNotification('Cart is empty.', 'warning');
            return;
        }
        if (discountError && !(discountType === 'fixed' && parseFloat(discount) > getSubtotal() && getSubtotal() > 0) ) { // Allow specific fixed discount "error"
             if (discountError !== 'Fixed discount exceeds subtotal. Total will be ₱0.00.'){ // Suppress this specific "error" at checkout
                showNotification('Please fix discount error before checkout.', 'warning');
                return;
             }
        }
        if (cashReceivedError && parseFloat(cashReceived) < getTotal()) {
            showNotification('Please fix cash received error before checkout.', 'warning');
            return;
        }

        const total = getTotal();
        const numCash = parseFloat(cashReceived);

        if (total > 0 && (isNaN(numCash) || numCash < total)) {
            setCashReceivedError('Cash received must be greater than or equal to total.');
            showNotification('Please enter a valid cash amount that covers the total.', 'warning');
            return;
        }
        setCashReceivedError('');
        setReceiptOpen(true);
    };

    const completeTransaction = async () => {
        if (isCompleteSaleDisabled()) {
            showNotification('Please verify all data before completing the sale.', 'warning');
            return;
        }

        for (const item of cart) {
            const currentQuantity = parseInt(item.quantity,10);
             if (isNaN(currentQuantity) || currentQuantity <= 0) {
                showNotification(`Invalid quantity for ${item.name}. Please correct.`, 'error');
                setReceiptOpen(false);
                return;
            }
            const productInProducts = products.find(p => p.id === item.id);
            if (!productInProducts || currentQuantity > productInProducts.stock) {
                showNotification(`Stock for ${item.name} changed or insufficient. Available: ${productInProducts ? productInProducts.stock : 0}, In Cart: ${currentQuantity}. Please update cart.`, 'error');
                setReceiptOpen(false);
                await fetchProducts();
                return;
            }
        }
        try {
            const transactionData = {
                transactionId,
                items: cart.map(item => ({ id: item.id, quantity: parseInt(item.quantity, 10), price: item.price })),
                subtotal: getSubtotal(),
                // For backend: send discount type, value, and calculated amount separately if possible
                discount_type: discountType,
                discount_value: discount ? parseFloat(discount) : 0,
                discount_amount_applied: getDiscountAmount(), // Send the actual deducted amount
                total: getTotal(),
                cashReceived: parseFloat(cashReceived),
                notes: '' // Add a notes field if you need it
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
                await fetchProducts();
                return;
            }
            showSaleCompleteNotification();
            setReceiptOpen(false);
            setCart([]);
            setDiscount('');
            setDiscountError('');
            // setDiscountType('percent'); // Optionally reset discount type
            setCashReceived('');
            setCashReceivedError('');
            setTransactionId(generateTransactionId());
            await fetchProducts();
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
        if (cart.some(item => item.quantity === '' || isNaN(parseInt(item.quantity)) || parseInt(item.quantity) <= 0)) return true;

        const tempDiscountError = discountError;
        // Allow specific "error" for fixed discount exceeding subtotal during completion check
        if (tempDiscountError && tempDiscountError === 'Fixed discount exceeds subtotal. Total will be ₱0.00.') {
            // This is not a blocking error for completing the sale
        } else if (tempDiscountError) {
            return true; // Other discount errors are blocking
        }

        const numCash = parseFloat(cashReceived);
        const total = getTotal();
        if (total > 0 && (isNaN(numCash) || numCash < 0 || numCash < total)) return true;
        if (cashReceivedError && numCash < total) return true;
        return false;
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
                            <div key={product.id} className={`${styles.productCard} ${product.stock <= 0 ? styles.disabledProduct : ''}`} onClick={() => product.stock > 0 && addToCart(product)}>
                                <div className={styles.productInfo}>
                                    <p className={styles.productName}>{product.name}</p>
                                    <p className={styles.productSupplier}>Supplier: {product.supplier_name}</p>
                                    <p className={styles.productPrice}>₱{parseFloat(product.price).toFixed(2)}</p>
                                    <p className={styles.productStock}>
                                        <span className={`${styles.stockIndicator} ${parseInt(product.stock) > 10 ? styles.inStock : parseInt(product.stock) > 0 ? styles.lowStock : styles.outStock}`}></span>
                                        Stock: {product.stock} {product.unit}
                                    </p>
                                    {product.stock <= 0 && <p className={styles.outOfStockLabel}>Out of Stock</p>}
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
                                <p className={styles.itemDetails}>₱{parseFloat(item.price).toFixed(2)} x {item.quantity === '' ? '0' : item.quantity} {item.unit || ''}</p>
                                <p className={styles.itemTotal}>₱{(item.price * (item.quantity || 0)).toFixed(2)}</p>
                            </div>
                            <div className={styles.cartItemQuantity}>
                                <input
                                    type="number"
                                    className={styles.qtyInput}
                                    value={item.quantity}
                                    onChange={(e) => handleQuantityInputChange(item.id, e.target.value)}
                                    onBlur={(e) => validateAndFinalizeQuantity(item.id, e.target.value)}
                                    min="1"
                                />
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
                        <label>Discount Type</label>
                        <div className={styles.discountTypeSelector}>
                            <button
                                className={discountType === 'percent' ? styles.activeDiscountType : ''}
                                onClick={() => handleDiscountTypeChange('percent')}
                            >
                                Percent (%)
                            </button>
                            <button
                                className={discountType === 'fixed' ? styles.activeDiscountType : ''}
                                onClick={() => handleDiscountTypeChange('fixed')}
                            >
                                Fixed (₱)
                            </button>
                        </div>
                    </div>

                    <div className={styles.inputGroup}>
                        <label>Discount ({discountType === 'percent' ? '%' : '₱'})</label>
                        <input
                            type="number"
                            value={discount}
                            onChange={handleDiscountChange}
                            min="0"
                            max={discountType === 'percent' ? "100" : undefined} // Max only for percent
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
                        <span>
                            Discount
                            {discount && !discountError && parseFloat(discount) > 0 ?
                                (discountType === 'percent' ? ` (${parseFloat(discount)}%)` : ' (₱)') :
                                ':'}
                        </span>
                        <span>- ₱{getDiscountAmount().toFixed(2)}</span>
                    </div>
                    <hr className={styles.summaryDivider} />
                    <div className={styles.summaryTotal}>
                        <span>Total:</span>
                        <span>₱{getTotal().toFixed(2)}</span>
                    </div>
                    {(getTotal() > 0 || parseFloat(cashReceived) > 0) && (
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
                        disabled={
                            cart.length === 0 ||
                            (!!discountError && !(discountError === 'Fixed discount exceeds subtotal. Total will be ₱0.00.')) || // Allow checkout if it's just the fixed discount warning
                            (!!cashReceivedError && parseFloat(cashReceived) < getTotal()) ||
                            getTotal() < 0 || // Should not happen with Math.max(0, ...)
                            cart.some(item => item.quantity === '' || isNaN(parseInt(item.quantity)) || parseInt(item.quantity) <= 0) ||
                            (getTotal() > 0 && (cashReceived === '' || parseFloat(cashReceived) < getTotal())) // If total > 0, cash must be sufficient
                        }
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
                                        <span>{parseInt(item.quantity,10)}x {item.name}</span>
                                        <span>₱{(item.price * parseInt(item.quantity,10)).toFixed(2)}</span>
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
                                    <span>
                                        Discount
                                        {discountType === 'percent' ? ` (${parseFloat(discount)}%)` : ' (Fixed ₱)'}:
                                    </span>
                                    <span>- ₱{getDiscountAmount().toFixed(2)}</span>
                                </div>
                            )}
                            <hr className={styles.receiptDivider} />
                            <div className={styles.receiptTotal}>
                                <span>Total:</span>
                                <span>₱{getTotal().toFixed(2)}</span>
                            </div>
                            {getTotal() >= 0 && parseFloat(cashReceived) >= getTotal() && ( // Show only if cash is sufficient or total is 0
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

            {notification.open && (
                <div className={`${styles.notification} ${notification.open ? styles.open : ''} ${styles[notification.severity]}`}>
                    {notification.message}
                </div>
            )}

            <div className={`${styles.saleCompleteNotification} ${saleComplete ? styles.show : ''}`}>
                <div className={styles.checkmark}>✓</div>
                <p>Sale Completed Successfully!</p>
            </div>
        </div>
    );
};

export default POS;