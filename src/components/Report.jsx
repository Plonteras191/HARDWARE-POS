import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
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
  const [salesSelectedPeriod, setSalesSelectedPeriod] = useState(null);
  const [adjustmentFilterType, setAdjustmentFilterType] = useState('date');
  const [adjustmentSelectedPeriod, setAdjustmentSelectedPeriod] = useState(null);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [receiptData, setReceiptData] = useState(null);
  const itemsPerPage = 10;

  // Fetch data functions
  const fetchSalesData = async (start, end) => {
    if (!start || !end) return;
    const url = `http://localhost/HARD-POS/backend/api/report.php?report=sales&start_date=${start}&end_date=${end}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      setSalesData(data.transactions || []);
    } catch (error) {
      console.error('Error fetching sales data:', error);
    }
  };

  const fetchInventoryData = async () => {
    const url = `http://localhost/HARD-POS/backend/api/report.php?report=inventory`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      setInventoryData(data.inventory || []);
    } catch (error) {
      console.error('Error fetching inventory data:', error);
    }
  };

  const fetchAdjustmentData = async (start, end) => {
    if (!start || !end) return;
    const url = `http://localhost/HARD-POS/backend/api/report.php?report=stock_adjustments&start_date=${start}&end_date=${end}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      setAdjustmentData(data.stock_adjustments || []);
    } catch (error) {
      console.error('Error fetching adjustment data:', error);
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

  // Fetch inventory data when tab is selected
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
  const totalSalesPages = Math.ceil(salesData.length / itemsPerPage);
  const totalInventoryPages = Math.ceil(inventoryData.length / itemsPerPage);
  const totalAdjustmentPages = Math.ceil(adjustmentData.length / itemsPerPage);

  // Handle receipt view
  const handleViewReceipt = (transactionId) => {
    setSelectedTransaction(transactionId);
    fetchReceiptDetails(transactionId);
  };

  return (
    <div className={styles.reportContainer}>
      <div className={styles.reportHeader}>
        <h2 className={styles.reportTitle}>Reports - Cocolumber Construction Supply</h2>
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
              onChange={(e) => setSalesFilterType(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="date">Date</option>
              <option value="month">Month</option>
            </select>
            {salesFilterType === 'date' && (
              <DatePicker
                selected={salesSelectedPeriod}
                onChange={(date) => {
                  setSalesSelectedPeriod(date);
                  if (date) {
                    const start = format(date, 'yyyy-MM-dd');
                    const end = start;
                    fetchSalesData(start, end);
                  }
                }}
                dateFormat="yyyy-MM-dd"
                className={styles.filterInput}
                placeholderText="Select a date"
              />
            )}
            {salesFilterType === 'month' && (
              <DatePicker
                selected={salesSelectedPeriod}
                onChange={(date) => {
                  setSalesSelectedPeriod(date);
                  if (date) {
                    const start = format(startOfMonth(date), 'yyyy-MM-dd');
                    const end = format(endOfMonth(date), 'yyyy-MM-dd');
                    fetchSalesData(start, end);
                  }
                }}
                dateFormat="yyyy-MM"
                showMonthYearPicker
                className={styles.filterInput}
                placeholderText="Select a month"
              />
            )}
          </div>
          {salesSelectedPeriod ? (
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
                    {currentSales.map((transaction) => (
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
                    ))}
                  </tbody>
                </table>
              </div>
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
            </>
          ) : (
            <p>Please select a date or month to view the sales data.</p>
          )}
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div>
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
                {currentInventory.map((item) => (
                  <tr key={item.id} className={styles.tableRow}>
                    <td className={styles.tableCell}>{item.name}</td>
                    <td className={styles.tableCell}>{item.category}</td>
                    <td className={styles.tableCell}>{item.supplier_name}</td>
                    <td className={styles.tableCell}>{item.current_stock}</td>
                    <td className={styles.tableCell}>{item.min_stock}</td>
                    <td className={styles.tableCell}>{item.unit}</td>
                    <td className={styles.tableCell}>₱{item.price.toLocaleString()}</td>
                    <td className={styles.tableCell}>{item.stock_status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        </div>
      )}

      {/* Stock Adjustments Tab */}
      {activeTab === 'adjustments' && (
        <div>
          <div className={styles.filterControls}>
            <label className={styles.filterLabel}>Filter by:</label>
            <select
              value={adjustmentFilterType}
              onChange={(e) => setAdjustmentFilterType(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="date">Date</option>
              <option value="month">Month</option>
            </select>
            {adjustmentFilterType === 'date' && (
              <DatePicker
                selected={adjustmentSelectedPeriod}
                onChange={(date) => {
                  setAdjustmentSelectedPeriod(date);
                  if (date) {
                    const start = format(date, 'yyyy-MM-dd');
                    const end = start;
                    fetchAdjustmentData(start, end);
                  }
                }}
                dateFormat="yyyy-MM-dd"
                className={styles.filterInput}
                placeholderText="Select a date"
              />
            )}
            {adjustmentFilterType === 'month' && (
              <DatePicker
                selected={adjustmentSelectedPeriod}
                onChange={(date) => {
                  setAdjustmentSelectedPeriod(date);
                  if (date) {
                    const start = format(startOfMonth(date), 'yyyy-MM-dd');
                    const end = format(endOfMonth(date), 'yyyy-MM-dd');
                    fetchAdjustmentData(start, end);
                  }
                }}
                dateFormat="yyyy-MM"
                showMonthYearPicker
                className={styles.filterInput}
                placeholderText="Select a month"
              />
            )}
          </div>
          {adjustmentSelectedPeriod ? (
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
                    {currentAdjustments.map((adjustment) => (
                      <tr key={adjustment.id} className={styles.tableRow}>
                        <td className={styles.tableCell}>{adjustment.id}</td>
                        <td className={styles.tableCell}>{adjustment.product_name}</td>
                        <td className={styles.tableCell}>{adjustment.quantity}</td>
                        <td className={styles.tableCell}>{adjustment.reason}</td>
                        <td className={styles.tableCell}>{adjustment.notes}</td>
                        <td className={styles.tableCell}>{adjustment.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
            </>
          ) : (
            <p>Please select a date or month to view the stock adjustments data.</p>
          )}
        </div>
      )}

      {/* Receipt Modal */}
      {receiptData && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <h3 className={styles.modalHeader}>Receipt Details</h3>
            <div className={styles.modalContent}>
              <p className={styles.receiptDetail}><strong>Transaction ID:</strong> {receiptData.ref}</p>
              <p className={styles.receiptDetail}><strong>Date:</strong> {receiptData.date}</p>
              <p className={styles.receiptDetail}><strong>Subtotal:</strong> ₱{receiptData.subtotal.toLocaleString()}</p>
              <p className={styles.receiptDetail}><strong>Discount:</strong> {receiptData.discount}%</p>
              <p className={styles.receiptDetail}><strong>Total:</strong> ₱{receiptData.total.toLocaleString()}</p>
              <p className={styles.receiptDetail}><strong>Payment:</strong> ₱{receiptData.payment.toLocaleString()}</p>
              <p className={styles.receiptDetail}><strong>Change:</strong> ₱{receiptData.change.toLocaleString()}</p>
              <h4 className={styles.receiptItemsTitle}>Products</h4>
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
            <div className={styles.modalActions}>
              <button
                onClick={() => setReceiptData(null)}
                className={styles.closeButton}
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
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