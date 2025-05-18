import React, { useState, useEffect, useMemo, useRef } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, addDays } from 'date-fns';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import styles from '../styles/report.module.css';

const Report = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesData, setSalesData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [adjustmentData, setAdjustmentData] = useState([]);
  const [salesPage, setSalesPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [adjustmentPage, setAdjustmentPage] = useState(1);
  const [salesFilterType, setSalesFilterType] = useState('date');
  const [salesSelectedPeriod, setSalesSelectedPeriod] = useState(new Date()); // Default to today
  const [adjustmentFilterType, setAdjustmentFilterType] = useState('date');
  const [adjustmentSelectedPeriod, setAdjustmentSelectedPeriod] = useState(new Date()); // Default to today
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const receiptRef = useRef(null);
  const itemsPerPage = 10;

  // Fetch data functions
  const fetchSalesData = async (start, end) => {
    if (!start || !end) return;
    setLoadingData(true);
    const url = `http://localhost/HARD-POS/backend/api/report.php?report=sales&start_date=${start}&end_date=${end}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      setSalesData(data.transactions || []);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchInventoryData = async () => {
    setLoadingData(true);
    const url = `http://localhost/HARD-POS/backend/api/report.php?report=inventory`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      setInventoryData(data.inventory || []);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchAdjustmentData = async (start, end) => {
    if (!start || !end) return;
    setLoadingData(true);
    const url = `http://localhost/HARD-POS/backend/api/report.php?report=stock_adjustments&start_date=${start}&end_date=${end}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      setAdjustmentData(data.stock_adjustments || []);
    } catch (error) {
      console.error('Error fetching adjustment data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const fetchReceiptDetails = async (transactionId) => {
    const url = `http://localhost/HARD-POS/backend/api/report.php?report=sales_detail&transaction_id=${transactionId}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      setReceiptData(data.transaction_detail);
    } catch (error) {
      console.error('Error fetching receipt details:', error);
    }
  };

  // Load initial data on component mount
  useEffect(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    fetchSalesData(today, today);
    fetchInventoryData();
    fetchAdjustmentData(today, today);
  }, []);

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === 'inventory' && inventoryData.length === 0) {
      fetchInventoryData();
    }
  }, [activeTab]);

  // Pagination function
  const paginate = (data, page) => {
    const startIndex = (page - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  };

  // Monthly sales for chart
  const monthlySales = useMemo(() => {
    const salesByMonth = salesData.reduce((acc, transaction) => {
      const date = parseISO(transaction.date);
      const month = format(date, 'yyyy-MM');
      acc[month] = (acc[month] || 0) + transaction.total;
      return acc;
    }, {});
    return Object.entries(salesByMonth).map(([month, total]) => ({ month, total }));
  }, [salesData]);

  // Current page data
  const currentSales = useMemo(() => paginate(salesData, salesPage), [salesData, salesPage]);
  const currentInventory = useMemo(() => paginate(inventoryData, inventoryPage), [inventoryData, inventoryPage]);
  const currentAdjustments = useMemo(() => paginate(adjustmentData, adjustmentPage), [adjustmentData, adjustmentPage]);

  // Total pages
  const totalSalesPages = Math.max(1, Math.ceil(salesData.length / itemsPerPage));
  const totalInventoryPages = Math.max(1, Math.ceil(inventoryData.length / itemsPerPage));
  const totalAdjustmentPages = Math.max(1, Math.ceil(adjustmentData.length / itemsPerPage));

  // Handle receipt view
  const handleViewReceipt = (transactionId) => {
    setSelectedTransaction(transactionId);
    fetchReceiptDetails(transactionId);
  };

  // Date change handlers
  const handleSalesDateChange = (date) => {
    setSalesSelectedPeriod(date);
    if (date) {
      if (salesFilterType === 'date') {
        const formattedDate = format(date, 'yyyy-MM-dd');
        fetchSalesData(formattedDate, formattedDate);
      } else {
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');
        fetchSalesData(start, end);
      }
    }
  };

  const handleAdjustmentDateChange = (date) => {
    setAdjustmentSelectedPeriod(date);
    if (date) {
      if (adjustmentFilterType === 'date') {
        const formattedDate = format(date, 'yyyy-MM-dd');
        fetchAdjustmentData(formattedDate, formattedDate);
      } else {
        const start = format(startOfMonth(date), 'yyyy-MM-dd');
        const end = format(endOfMonth(date), 'yyyy-MM-dd');
        fetchAdjustmentData(start, end);
      }
    }
  };

  // Filter type change handlers
  const handleSalesFilterTypeChange = (e) => {
    const newFilterType = e.target.value;
    setSalesFilterType(newFilterType);
    
    if (salesSelectedPeriod) {
      if (newFilterType === 'date') {
        const formattedDate = format(salesSelectedPeriod, 'yyyy-MM-dd');
        fetchSalesData(formattedDate, formattedDate);
      } else {
        const start = format(startOfMonth(salesSelectedPeriod), 'yyyy-MM-dd');
        const end = format(endOfMonth(salesSelectedPeriod), 'yyyy-MM-dd');
        fetchSalesData(start, end);
      }
    }
  };

  const handleAdjustmentFilterTypeChange = (e) => {
    const newFilterType = e.target.value;
    setAdjustmentFilterType(newFilterType);
    
    if (adjustmentSelectedPeriod) {
      if (newFilterType === 'date') {
        const formattedDate = format(adjustmentSelectedPeriod, 'yyyy-MM-dd');
        fetchAdjustmentData(formattedDate, formattedDate);
      } else {
        const start = format(startOfMonth(adjustmentSelectedPeriod), 'yyyy-MM-dd');
        const end = format(endOfMonth(adjustmentSelectedPeriod), 'yyyy-MM-dd');
        fetchAdjustmentData(start, end);
      }
    }
  };

  // CSV Download functions
  const downloadCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    
    // Get headers from first item
    const headers = Object.keys(data[0]);
    
    // Convert to CSV format
    let csvContent = headers.join(',') + '\n';
    
    data.forEach(item => {
      const row = headers.map(header => {
        const value = item[header];
        // Handle commas, newlines, and quotes in the data
        const cell = value === null ? '' : String(value);
        return `"${cell.replace(/"/g, '""')}"`;
      }).join(',');
      csvContent += row + '\n';
    });
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print receipt function
  const printReceipt = () => {
    const printWindow = window.open('', '_blank', 'height=600,width=800');
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt #${receiptData?.ref || ''}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              font-size: 12px;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 20px;
            }
            .receipt-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 5px;
            }
            .receipt-subtitle {
              font-size: 14px;
              margin-bottom: 10px;
            }
            .receipt-details {
              margin-bottom: 15px;
            }
            .receipt-info {
              display: flex;
              justify-content: space-between;
              margin-bottom: 5px;
            }
            .receipt-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 15px;
            }
            .receipt-table th, .receipt-table td {
              border-bottom: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            .receipt-table th {
              font-weight: bold;
            }
            .receipt-summary {
              margin-top: 20px;
              text-align: right;
            }
            .receipt-summary div {
              margin-bottom: 5px;
            }
            .receipt-footer {
              margin-top: 30px;
              text-align: center;
              font-size: 11px;
            }
            .bold {
              font-weight: bold;
            }
            @media print {
              body {
                margin: 0;
                padding: 10px;
              }
              @page {
                size: 80mm 297mm;
                margin: 0;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <div class="receipt-title">Cocolumber Construction Supply</div>
            <div class="receipt-subtitle">Sales Receipt</div>
            <div>TAGOLOAN</div>
            <div>CELL: 0924356734</div>
          </div>
          
          <div class="receipt-details">
            <div class="receipt-info">
              <span>Receipt No:</span>
              <span>${receiptData?.ref || ''}</span>
            </div>
            <div class="receipt-info">
              <span>Date:</span>
              <span>${receiptData?.date || ''}</span>
            </div>
          </div>
          
          <table class="receipt-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${receiptData?.items.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td>${item.quantity}</td>
                  <td>₱${item.price.toLocaleString()}</td>
                  <td>₱${item.total.toLocaleString()}</td>
                </tr>
              `).join('') || ''}
            </tbody>
          </table>
          
          <div class="receipt-summary">
            <div><span>Subtotal: </span><span>₱${receiptData?.subtotal.toLocaleString() || ''}</span></div>
            <div><span>Discount: </span><span>${receiptData?.discount || 0}%</span></div>
            <div class="bold"><span>Total: </span><span>₱${receiptData?.total.toLocaleString() || ''}</span></div>
            <div><span>Payment: </span><span>₱${receiptData?.payment.toLocaleString() || ''}</span></div>
            <div><span>Change: </span><span>₱${receiptData?.change.toLocaleString() || ''}</span></div>
          </div>
          
          <div class="receipt-footer">
            <p>Thank you for your purchase!</p>
            <p>Please come again</p>
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Print after a short delay to ensure content is loaded
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className={styles.reportContainer}>
      <div className={styles.reportHeader}>
        <h2 className={styles.reportTitle}>Reports</h2>
      </div>
      <div className={styles.tabsContainer}>
        <button
          className={activeTab === 'sales' ? styles.tabButtonActive : styles.tabButtonInactive}
          onClick={() => setActiveTab('sales')}
        >
          Sales
        </button>
        <button
          className={activeTab === 'inventory' ? styles.tabButtonActive : styles.tabButtonInactive}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory
        </button>
        <button
          className={activeTab === 'adjustments' ? styles.tabButtonActive : styles.tabButtonInactive}
          onClick={() => setActiveTab('adjustments')}
        >
          Stock Adjustments
        </button>
      </div>

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div>
          <div className={styles.filterControls}>
            <label className={styles.filterLabel}>Filter by:</label>
            <select
              value={salesFilterType}
              onChange={handleSalesFilterTypeChange}
              className={styles.filterSelect}
            >
              <option value="date">Date</option>
              <option value="month">Month</option>
            </select>
            {salesFilterType === 'date' && (
              <DatePicker
                selected={salesSelectedPeriod}
                onChange={handleSalesDateChange}
                dateFormat="yyyy-MM-dd"
                className={styles.filterInput}
                placeholderText="Select a date"
              />
            )}
            {salesFilterType === 'month' && (
              <DatePicker
                selected={salesSelectedPeriod}
                onChange={handleSalesDateChange}
                dateFormat="yyyy-MM"
                showMonthYearPicker
                className={styles.filterInput}
                placeholderText="Select a month"
              />
            )}
            <button 
              className={styles.downloadButton}
              onClick={() => downloadCSV(salesData, 'sales_report')}
              disabled={salesData.length === 0}
            >
              Download CSV
            </button>
          </div>
          {loadingData ? (
            <div className={styles.loadingIndicator}>Loading sales data...</div>
          ) : (
            <>
              <div className={styles.chartContainer}>
                <BarChart width={600} height={300} data={monthlySales}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#3b82f6" />
                </BarChart>
              </div>
              <div className={styles.tableContainer}>
                <table className={styles.reportTable}>
                  <thead className={styles.tableHeader}>
                    <tr>
                      <th className={styles.tableHeaderCell}>Transaction ID</th>
                      <th className={styles.tableHeaderCell}>Date</th>
                      <th className={styles.tableHeaderCell}>Total (₱)</th>
                      <th className={styles.tableHeaderCell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentSales.length > 0 ? (
                      currentSales.map((transaction) => (
                        <tr key={transaction.id} className={styles.tableRow}>
                          <td className={styles.tableCell}>{transaction.ref}</td>
                          <td className={styles.tableCell}>{transaction.date}</td>
                          <td className={styles.tableCell}>₱{transaction.total.toLocaleString()}</td>
                          <td className={styles.tableCell}>
                            <button
                              onClick={() => handleViewReceipt(transaction.id)}
                              className={styles.actionButton}
                            >
                              View Receipt
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className={styles.emptyTableMessage}>No sales data available for the selected period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {currentSales.length > 0 && (
                <div className={styles.paginationContainer}>
                  <button
                    onClick={() => setSalesPage((prev) => Math.max(prev - 1, 1))}
                    disabled={salesPage === 1}
                    className={styles.paginationButton}
                  >
                    Previous
                  </button>
                  <span className={styles.paginationText}>Page {salesPage} of {totalSalesPages}</span>
                  <button
                    onClick={() => setSalesPage((prev) => Math.min(prev + 1, totalSalesPages))}
                    disabled={salesPage === totalSalesPages}
                    className={styles.paginationButton}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div>
          <div className={styles.actionBar}>
            <button 
              className={styles.downloadButton}
              onClick={() => downloadCSV(inventoryData, 'inventory_report')}
              disabled={inventoryData.length === 0}
            >
              Download CSV
            </button>
          </div>
          {loadingData ? (
            <div className={styles.loadingIndicator}>Loading inventory data...</div>
          ) : (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.reportTable}>
                  <thead className={styles.tableHeader}>
                    <tr>
                      <th className={styles.tableHeaderCell}>Product</th>
                      <th className={styles.tableHeaderCell}>Category</th>
                      <th className={styles.tableHeaderCell}>Supplier</th>
                      <th className={styles.tableHeaderCell}>Stock</th>
                      <th className={styles.tableHeaderCell}>Min Stock</th>
                      <th className={styles.tableHeaderCell}>Unit</th>
                      <th className={styles.tableHeaderCell}>Price (₱)</th>
                      <th className={styles.tableHeaderCell}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentInventory.length > 0 ? (
                      currentInventory.map((item) => (
                        <tr key={item.id} className={styles.tableRow}>
                          <td className={styles.tableCell}>{item.name}</td>
                          <td className={styles.tableCell}>{item.category}</td>
                          <td className={styles.tableCell}>{item.supplier_name}</td>
                          <td className={styles.tableCell}>{item.current_stock}</td>
                          <td className={styles.tableCell}>{item.min_stock}</td>
                          <td className={styles.tableCell}>{item.unit}</td>
                          <td className={styles.tableCell}>₱{item.price.toLocaleString()}</td>
                          <td className={`${styles.tableCell} ${item.stock_status === 'Low Stock' ? styles.lowStock : ''}`}>
                            {item.stock_status}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="8" className={styles.emptyTableMessage}>No inventory data available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {currentInventory.length > 0 && (
                <div className={styles.paginationContainer}>
                  <button
                    onClick={() => setInventoryPage((prev) => Math.max(prev - 1, 1))}
                    disabled={inventoryPage === 1}
                    className={styles.paginationButton}
                  >
                    Previous
                  </button>
                  <span className={styles.paginationText}>Page {inventoryPage} of {totalInventoryPages}</span>
                  <button
                    onClick={() => setInventoryPage((prev) => Math.min(prev + 1, totalInventoryPages))}
                    disabled={inventoryPage === totalInventoryPages}
                    className={styles.paginationButton}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Stock Adjustments Tab */}
      {activeTab === 'adjustments' && (
        <div>
          <div className={styles.filterControls}>
            <label className={styles.filterLabel}>Filter by:</label>
            <select
              value={adjustmentFilterType}
              onChange={handleAdjustmentFilterTypeChange}
              className={styles.filterSelect}
            >
              <option value="date">Date</option>
              <option value="month">Month</option>
            </select>
            {adjustmentFilterType === 'date' && (
              <DatePicker
                selected={adjustmentSelectedPeriod}
                onChange={handleAdjustmentDateChange}
                dateFormat="yyyy-MM-dd"
                className={styles.filterInput}
                placeholderText="Select a date"
              />
            )}
            {adjustmentFilterType === 'month' && (
              <DatePicker
                selected={adjustmentSelectedPeriod}
                onChange={handleAdjustmentDateChange}
                dateFormat="yyyy-MM"
                showMonthYearPicker
                className={styles.filterInput}
                placeholderText="Select a month"
              />
            )}
            <button 
              className={styles.downloadButton}
              onClick={() => downloadCSV(adjustmentData, 'stock_adjustments_report')}
              disabled={adjustmentData.length === 0}
            >
              Download CSV
            </button>
          </div>
          {loadingData ? (
            <div className={styles.loadingIndicator}>Loading adjustment data...</div>
          ) : (
            <>
              <div className={styles.tableContainer}>
                <table className={styles.reportTable}>
                  <thead className={styles.tableHeader}>
                    <tr>
                      <th className={styles.tableHeaderCell}>Adjustment ID</th>
                      <th className={styles.tableHeaderCell}>Product</th>
                      <th className={styles.tableHeaderCell}>Quantity</th>
                      <th className={styles.tableHeaderCell}>Reason</th>
                      <th className={styles.tableHeaderCell}>Notes</th>
                      <th className={styles.tableHeaderCell}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentAdjustments.length > 0 ? (
                      currentAdjustments.map((adjustment) => (
                        <tr key={adjustment.id} className={styles.tableRow}>
                          <td className={styles.tableCell}>{adjustment.id}</td>
                          <td className={styles.tableCell}>{adjustment.product_name}</td>
                          <td className={styles.tableCell}>{adjustment.quantity}</td>
                          <td className={styles.tableCell}>{adjustment.reason}</td>
                          <td className={styles.tableCell}>{adjustment.notes}</td>
                          <td className={styles.tableCell}>{adjustment.date}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className={styles.emptyTableMessage}>No adjustment data available for the selected period.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {currentAdjustments.length > 0 && (
                <div className={styles.paginationContainer}>
                  <button
                    onClick={() => setAdjustmentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={adjustmentPage === 1}
                    className={styles.paginationButton}
                  >
                    Previous
                  </button>
                  <span className={styles.paginationText}>Page {adjustmentPage} of {totalAdjustmentPages}</span>
                  <button
                    onClick={() => setAdjustmentPage((prev) => Math.min(prev + 1, totalAdjustmentPages))}
                    disabled={adjustmentPage === totalAdjustmentPages}
                    className={styles.paginationButton}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Receipt Modal */}
      {receiptData && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <h3 className={styles.modalHeader}>Receipt Details</h3>
            <div className={styles.modalContent} ref={receiptRef}>
              <div className={styles.receiptHeader}>
                <h3 className={styles.receiptTitle}>Cocolumber Construction Supply</h3>
                <p className={styles.receiptSubtitle}>Sales Receipt</p>
              </div>
              <div className={styles.receiptInfo}>
                <p className={styles.receiptDetail}><strong>Transaction ID:</strong> {receiptData.ref}</p>
                <p className={styles.receiptDetail}><strong>Date:</strong> {receiptData.date}</p>
              </div>
              <div className={styles.receiptSummary}>
                <table className={styles.reportTable}>
                  <thead className={styles.tableHeader}>
                    <tr>
                      <th className={styles.tableHeaderCell}>Product</th>
                      <th className={styles.tableHeaderCell}>Quantity</th>
                      <th className={styles.tableHeaderCell}>Unit Price</th>
                      <th className={styles.tableHeaderCell}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptData.items.map((item) => (
                      <tr key={item.id} className={styles.tableRow}>
                        <td className={styles.tableCell}>{item.name}</td>
                        <td className={styles.tableCell}>{item.quantity}</td>
                        <td className={styles.tableCell}>₱{item.price.toLocaleString()}</td>
                        <td className={styles.tableCell}>₱{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.receiptTotals}>
                <p className={styles.receiptDetail}><strong>Subtotal:</strong> ₱{receiptData.subtotal.toLocaleString()}</p>
                <p className={styles.receiptDetail}><strong>Discount:</strong> {receiptData.discount}%</p>
                <p className={`${styles.receiptDetail} ${styles.receiptTotal}`}><strong>Total:</strong> ₱{receiptData.total.toLocaleString()}</p>
                <p className={styles.receiptDetail}><strong>Payment:</strong> ₱{receiptData.payment.toLocaleString()}</p>
                <p className={styles.receiptDetail}><strong>Change:</strong> ₱{receiptData.change.toLocaleString()}</p>
              </div>
            </div>
            <div className={styles.modalActions}>
              <button
                onClick={() => setReceiptData(null)}
                className={styles.closeButton}
              >
                Close
              </button>
              <button
                onClick={printReceipt}
                className={styles.printButton}
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Report;