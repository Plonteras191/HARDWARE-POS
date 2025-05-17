import React, { useState, useRef, useEffect } from 'react';
import '../styles/pos.css'; // Ensure this path is correct

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
            // Ensure the backend endpoint provides supplier_name
            const response = await fetch(`${API_BASE_URL}/pos_api.php?action=products`);
            if (!response.ok) throw new Error('Failed to fetch products');
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            // Assuming data.products is an array of product objects including 'supplier_name'
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
        // Clear notification after 6 seconds
        const timer = setTimeout(() => setNotification({ ...notification, open: false }), 6000);
        // Clear any existing timer before setting a new one
        return () => clearTimeout(timer);
    };

    const showSaleCompleteNotification = () => {
        setSaleComplete(true);
        // Hide sale complete notification after 3 seconds
        const timer = setTimeout(() => setSaleComplete(false), 3000);
        return () => clearTimeout(timer);
    };

    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
        // Also include supplier name in search? Add || product.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()) here if needed.
        const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const addToCart = (product) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(item => item.id === product.id);
            if (existingItem) {
                // Check against available stock before increasing quantity
                 const productInProducts = products.find(p => p.id === product.id);
                 if (productInProducts && existingItem.quantity + 1 > productInProducts.stock) {
                     showNotification(`Cannot add more. Only ${productInProducts.stock} units of ${product.name} available.`, 'warning');
                     return prevCart; // Don't update cart
                 }
                return prevCart.map(item =>
                    item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            // Check against available stock for new item
            const productInProducts = products.find(p => p.id === product.id);
            if (productInProducts && 1 > productInProducts.stock) {
                 showNotification(`Cannot add ${product.name}. Item is out of stock.`, 'warning');
                 return prevCart; // Don't update cart
            }

            return [...prevCart, { ...product, quantity: 1 }];
        });
    };

     const updateQuantity = (productId, change) => {
        setCart(prevCart => {
            const updatedCart = prevCart.map(item => {
                if (item.id === productId) {
                    const newQuantity = item.quantity + change;

                    // Find the product in the main products list to check stock
                    const productInProducts = products.find(p => p.id === productId);
                    const availableStock = productInProducts ? productInProducts.stock : 0;

                    if (newQuantity <= 0) {
                        // Quantity is zero or less, mark for removal
                        return null;
                    }
                    if (newQuantity > availableStock) {
                         showNotification(`Cannot add more. Only ${availableStock} units of ${item.name} available.`, 'warning');
                         return item; // Return the item without changing quantity
                    }

                    return { ...item, quantity: newQuantity };
                }
                return item;
            }).filter(Boolean); // Filter out items marked for removal

            // If removing an item, check if cash received is still valid
            if (prevCart.length > updatedCart.length) {
                 const currentTotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0) * (1 - (parseFloat(discount) || 0) / 100);
                 if (parseFloat(cashReceived) < currentTotal && parseFloat(cashReceived) > 0) {
                    setCashReceivedError('Cash received is now less than the total.');
                 } else {
                     setCashReceivedError(''); // Clear error if sufficient
                 }
            }


            return updatedCart;
        });
    };

    const removeFromCart = (productId) => {
        setCart(prevCart => {
            const updatedCart = prevCart.filter(item => item.id !== productId);

            // Check if cash received is still valid after removing an item
            const currentTotal = updatedCart.reduce((sum, item) => sum + item.price * item.quantity, 0) * (1 - (parseFloat(discount) || 0) / 100);
             if (parseFloat(cashReceived) < currentTotal && parseFloat(cashReceived) > 0) {
                setCashReceivedError('Cash received is now less than the total.');
            } else {
                 setCashReceivedError(''); // Clear error if sufficient
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
            // Re-validate cash received if total changes due to discount removal
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
             setCashReceivedError(''); // Clear cash error on discount error
        } else if (numValue < 0) {
            setDiscountError('Discount cannot be negative');
             setCashReceivedError(''); // Clear cash error on discount error
        } else if (numValue > 100) {
            setDiscountError('Discount cannot exceed 100%');
             setCashReceivedError(''); // Clear cash error on discount error
        } else {
             setDiscountError('');
             // Re-validate cash received based on new total
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
        }
        else {
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

         // Check stock levels one last time before committing
         for (const item of cart) {
             const productInProducts = products.find(p => p.id === item.id);
              if (!productInProducts || item.quantity > productInProducts.stock) {
                   showNotification(`Stock for ${item.name} changed. Available: ${productInProducts ? productInProducts.stock : 0}, Cart: ${item.quantity}. Please update cart.`, 'error');
                   setReceiptOpen(false); // Close modal
                   fetchProducts(); // Refresh product list
                   return; // Stop transaction
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
                notes: '' // Add notes field if needed
            };

            const response = await fetch(`${API_BASE_URL}/pos_api.php?action=create-transaction`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transactionData)
            });
            const data = await response.json();

            if (data.error) {
                 // Rollback on the frontend side (clear cart, etc.) but based on backend error
                 setReceiptOpen(false); // Close receipt modal
                 showNotification(`Transaction failed: ${data.error}`, 'error');
                 fetchProducts(); // Refresh products to show correct stock
                 // Optionally clear cart or adjust based on specific error
                 // If the error is due to stock, the user needs to see updated stock and adjust cart
                 return;
            }

            // If success
            showSaleCompleteNotification();

            setReceiptOpen(false);
            setCart([]);
            setDiscount('');
            setDiscountError('');
            setCashReceived('');
            setCashReceivedError('');
            setTransactionId(generateTransactionId());
            fetchProducts(); // Refresh products to show decreased stock
            // Optionally trigger printing the receipt here if needed
            // handlePrintReceipt();

        } catch (err) {
             setReceiptOpen(false); // Close receipt modal
             showNotification(`Network or server error: ${err.message}`, 'error');
        }
    };

    const formatDateTime = () => {
        const now = new Date();
        return now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
    };

    const isCompleteSaleDisabled = () => {
        if (cart.length === 0) return true; // Disable if cart is empty
        if (discountError || cashReceivedError) return true;
        const numCash = parseFloat(cashReceived);
        const total = getTotal();
        // Disable if cash received is not a valid number, is negative, or is less than the total
        return isNaN(numCash) || numCash < 0 || numCash < total;
    };

     // Optional: Handle printing the receipt (requires a library or browser print)
    // const handlePrintReceipt = () => {
    //     if (receiptRef.current) {
    //         const printWindow = window.open('', '_blank');
    //         printWindow.document.write('<html><head><title>Receipt</title>');
    //         // Copy styles from the main window, or use a dedicated print stylesheet
    //         printWindow.document.write('<link rel="stylesheet" href="../styles/pos.css">'); // Ensure this path is correct for the print window context
    //         printWindow.document.write('<style>');
    //         // Add specific print styles if needed, e.g., hide buttons
    //         printWindow.document.write('@media print { .modal-actions, .modal-backdrop { display: none; } body { margin: 0; } .receipt { width: 80mm; margin: 0 auto; padding: 10mm; font-size: 12px; } }');
    //         printWindow.document.write('</style>');
    //         printWindow.document.write('</head><body>');
    //         printWindow.document.write('<div class="receipt-print-area">' + receiptRef.current.innerHTML + '</div>'); // Wrap receipt content
    //         printWindow.document.write('</body></html>');
    //         printWindow.document.close();

    //         // Wait for content to load before printing
    //         printWindow.onload = () => {
    //             printWindow.print();
    //             // Optionally close the window after printing, though behavior varies by browser
    //             // printWindow.close();
    //         };
    //     }
    // };


    return (
        <div className="pos-container">
            <div className="pos-products">
                <div className="search-bar">
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <span className="search-icon">🔍</span>
                </div>

                <div className="category-filter">
                    {categories.map(category => (
                        <button
                            key={category}
                            className={`category-button ${selectedCategory === category ? 'active' : ''}`}
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </div>

                <div className="product-grid">
                    {loading ? (
                        <div className="loading">
                            <div className="spinner"></div>
                            <p>Loading products...</p>
                        </div>
                    ) : error ? (
                        <div className="error">
                            <i className="error-icon">⚠️</i>
                            <p>{error}</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="no-products">
                            <i className="empty-icon">📦</i>
                            <p>No products found</p>
                        </div>
                    ) : (
                        filteredProducts.map(product => (
                            <div key={product.id} className="product-card" onClick={() => addToCart(product)}>
                                <div className="product-info">
                                    <p className="product-name">{product.name}</p>
                                    {/* Add Supplier Name Here */}
                                    <p className="product-supplier">Supplier: {product.supplier_name}</p>
                                    <p className="product-price">₱{product.price.toFixed(2)}</p>
                                    <p className="product-stock">
                                        <span className={`stock-indicator ${parseInt(product.stock) > 10 ? 'in-stock' : parseInt(product.stock) > 0 ? 'low-stock' : 'out-stock'}`}></span>
                                        Stock: {product.stock} {product.unit}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="pos-cart">
                <h2 className="cart-title">YOUR CART</h2>
                <hr className="cart-divider" />
                <div className="cart-items">
                    {cart.length === 0 &&
                        <div className="empty-cart">
                            <i className="cart-icon">🛒</i>
                            <p>Your cart is empty</p>
                        </div>
                    }
                    {cart.map(item => (
                        <div key={item.id} className="cart-item">
                            <div className="cart-item-info">
                                <p className="item-name">{item.name}</p>
                                <p className="item-details">₱{item.price.toFixed(2)} x {item.quantity} {item.unit || ''}</p>
                                <p className="item-total">₱{(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                            <div className="cart-item-quantity">
                                <button onClick={() => updateQuantity(item.id, -1)} className="qty-btn decrease">−</button>
                                <span className="qty-value">{item.quantity}</span>
                                <button onClick={() => updateQuantity(item.id, 1)} className="qty-btn increase">+</button>
                                <button onClick={() => removeFromCart(item.id)} className="delete-btn">
                                    <span className="delete-icon">🗑️</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {cart.length > 0 && <hr className="cart-divider" />}

                <div className="discount-cash-section">
                    <div className="input-group">
                        <label>Discount (%)</label>
                        <input
                            type="number"
                            value={discount}
                            onChange={handleDiscountChange}
                            min="0"
                            max="100"
                            placeholder="0"
                        />
                        {discountError && <p className="error">{discountError}</p>}
                    </div>
                    <div className="input-group">
                        <label>Cash Received</label>
                        <input
                            type="number"
                            value={cashReceived}
                            onChange={handleCashReceivedChange}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className={getTotal() > 0 && !cashReceived && !cashReceivedError ? "highlight-input" : ""}
                        />
                        {cashReceivedError && <p className="error">{cashReceivedError}</p>}
                    </div>
                </div>

                <div className="cart-summary">
                    <div className="summary-line">
                        <span>Subtotal:</span>
                        <span>₱{getSubtotal().toFixed(2)}</span>
                    </div>
                    <div className="summary-line">
                        <span>Discount {discount && !discountError && parseFloat(discount) > 0 ? `(${parseFloat(discount)}%)` : ''}:</span>
                        <span>- ₱{getDiscountAmount().toFixed(2)}</span>
                    </div>
                    <hr className="summary-divider" />
                    <div className="summary-total">
                        <span>Total:</span>
                        <span>₱{getTotal().toFixed(2)}</span>
                    </div>
                     {/* Only show Cash Received and Change if Total is greater than 0 or cashReceived is entered */}
                    {(getTotal() > 0 || cashReceived > 0) && (
                        <>
                            <div className="summary-line">
                                <span>Cash Received:</span>
                                <span>₱{displayableCashReceived().toFixed(2)}</span>
                            </div>
                            <div className="summary-line">
                                <span>Change:</span>
                                <span className="change-amount">₱{getChange().toFixed(2)}</span>
                            </div>
                        </>
                    )}
                    <button
                        className="checkout-button"
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || !!discountError || !!cashReceivedError || getTotal() <= 0} // Disable if total is 0 or less
                    >
                        <span className="checkout-icon">💳</span> Checkout
                    </button>
                </div>
            </div>

            {receiptOpen && (
                <div className="modal-backdrop">
                    <div className="modal-content">
                        <h2 className="receipt-header">Transaction Summary</h2>
                        <div className="receipt" ref={receiptRef}>
                            <div className="receipt-store">
                                <h3>HARD-POS STORE</h3>
                                <p className="receipt-transaction">Transaction: {transactionId}</p>
                                <p className="receipt-date">{formatDateTime()}</p>
                            </div>
                            <hr className="receipt-divider" />
                            <div className="receipt-items">
                                {cart.map((item, index) => (
                                    <div key={index} className="receipt-item">
                                        <span>{item.quantity}x {item.name}</span>
                                        <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                ))}
                            </div>
                            <hr className="receipt-divider" />
                            <div className="receipt-summary">
                                <span>Subtotal:</span>
                                <span>₱{getSubtotal().toFixed(2)}</span>
                            </div>
                            {getDiscountAmount() > 0 && ( // Only show discount if applied
                                <div className="receipt-summary">
                                    <span>Discount {discount && !discountError && parseFloat(discount) > 0 ? `(${parseFloat(discount)}%)` : ''}:</span>
                                    <span>- ₱{getDiscountAmount().toFixed(2)}</span>
                                </div>
                            )}
                            <hr className="receipt-divider" />
                            <div className="receipt-total">
                                <span>Total:</span>
                                <span>₱{getTotal().toFixed(2)}</span>
                            </div>
                             {/* Only show Cash Tendered and Change in receipt if total is > 0 */}
                            {getTotal() > 0 && (
                                <>
                                    <div className="receipt-summary">
                                        <span>Cash Tendered:</span>
                                        <span>₱{displayableCashReceived().toFixed(2)}</span>
                                    </div>
                                    <div className="receipt-summary">
                                        <span>Change:</span>
                                        <span>₱{getChange().toFixed(2)}</span>
                                    </div>
                                </>
                            )}
                            <hr className="receipt-divider" />
                            <div className="receipt-footer">
                                <p>Thank you for your purchase!</p>
                                <p>Please come again</p>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="cancel-btn" onClick={() => setReceiptOpen(false)}>
                                <span className="btn-icon">✖</span> Cancel
                            </button>
                            <button
                                className="complete-btn"
                                onClick={completeTransaction}
                                disabled={isCompleteSaleDisabled()}
                            >
                                <span className="btn-icon">✓</span> Complete Sale
                            </button>
                             {/* Optional: Print button */}
                            {/* <button className="print-btn" onClick={handlePrintReceipt}>
                                <span className="btn-icon">⎙</span> Print Receipt
                            </button> */}
                        </div>
                    </div>
                </div>
            )}

            <div className={`notification ${notification.open ? 'open' : ''} ${notification.severity}`}>
                {notification.message}
            </div>

            {/* Sale complete notification */}
            <div className={`sale-complete-notification ${saleComplete ? 'show' : ''}`}>
                <div className="checkmark">✓</div>
                <p>Sale Completed Successfully!</p>
            </div>
        </div>
    );
};

export default POS;