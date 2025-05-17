import React, { useState, useEffect, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

const Report = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [salesData, setSalesData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [adjustmentData, setAdjustmentData] = useState([]);
  const [salesPage, setSalesPage] = useState(1);
  const [inventoryPage, setInventoryPage] = useState(1);
  const [adjustmentPage, setAdjustmentPage] = useState(1);
  const [salesStart, setSalesStart] = useState('');
  const [salesEnd, setSalesEnd] = useState('');
  const [adjustmentStart, setAdjustmentStart] = useState('');
  const [adjustmentEnd, setAdjustmentEnd] = useState('');
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
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">Reports - Cocolumber Construction Supply</h2>
      <div className="tabs flex space-x-4 mb-4">
        <button
          className={`px-4 py-2 ${activeTab === 'sales' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('sales')}
        >
          Sales
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'inventory' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory
        </button>
        <button
          className={`px-4 py-2 ${activeTab === 'adjustments' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('adjustments')}
        >
          Stock Adjustments
        </button>
      </div>

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div>
          <div className="mb-4">
            <label className="mr-2">Start Date:</label>
            <input
              type="date"
              value={salesStart}
              onChange={(e) => setSalesStart(e.target.value)}
              className="border p-1"
            />
            <label className="ml-4 mr-2">End Date:</label>
            <input
              type="date"
              value={salesEnd}
              onChange={(e) => setSalesEnd(e.target.value)}
              className="border p-1"
            />
            <button
              onClick={() => fetchSalesData(salesStart, salesEnd)}
              className="ml-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Apply Filter
            </button>
          </div>
          <BarChart width={600} height={300} data={monthlySales} className="mb-4">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total" fill="#8884d8" />
          </BarChart>
          <table className="min-w-full bg-white border border-gray-200 shadow rounded">
            <thead className="bg-green-100 text-left">
              <tr>
                <th className="py-2 px-4 border-b">Transaction ID</th>
                <th className="py-2 px-4 border-b">Date</th>
                <th className="py-2 px-4 border-b">Total (₱)</th>
                <th className="py-2 px-4 border-b">Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentSales.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{transaction.ref}</td>
                  <td className="py-2 px-4 border-b">{transaction.date}</td>
                  <td className="py-2 px-4 border-b">₱{transaction.total.toLocaleString()}</td>
                  <td className="py-2 px-4 border-b">
                    <button
                      onClick={() => handleViewReceipt(transaction.id)}
                      className="text-blue-500 hover:underline"
                    >
                      View Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setSalesPage((prev) => Math.max(prev - 1, 1))}
              disabled={salesPage === 1}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {salesPage} of {totalSalesPages}</span>
            <button
              onClick={() => setSalesPage((prev) => Math.min(prev + 1, totalSalesPages))}
              disabled={salesPage === totalSalesPages}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div>
          <table className="min-w-full bg-white border border-gray-200 shadow rounded">
            <thead className="bg-green-100 text-left">
              <tr>
                <th className="py-2 px-4 border-b">Product</th>
                <th className="py-2 px-4 border-b">Category</th>
                <th className="py-2 px-4 border-b">Supplier</th>
                <th className="py-2 px-4 border-b">Stock</th>
                <th className="py-2 px-4 border-b">Min Stock</th>
                <th className="py-2 px-4 border-b">Unit</th>
                <th className="py-2 px-4 border-b">Price (₱)</th>
                <th className="py-2 px-4 border-b">Status</th>
              </tr>
            </thead>
            <tbody>
              {currentInventory.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{item.name}</td>
                  <td className="py-2 px-4 border-b">{item.category}</td>
                  <td className="py-2 px-4 border-b">{item.supplier_name}</td>
                  <td className="py-2 px-4 border-b">{item.current_stock}</td>
                  <td className="py-2 px-4 border-b">{item.min_stock}</td>
                  <td className="py-2 px-4 border-b">{item.unit}</td>
                  <td className="py-2 px-4 border-b">₱{item.price.toLocaleString()}</td>
                  <td className="py-2 px-4 border-b">{item.stock_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setInventoryPage((prev) => Math.max(prev - 1, 1))}
              disabled={inventoryPage === 1}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {inventoryPage} of {totalInventoryPages}</span>
            <button
              onClick={() => setInventoryPage((prev) => Math.min(prev + 1, totalInventoryPages))}
              disabled={inventoryPage === totalInventoryPages}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Stock Adjustments Tab */}
      {activeTab === 'adjustments' && (
        <div>
          <div className="mb-4">
            <label className="mr-2">Start Date:</label>
            <input
              type="date"
              value={adjustmentStart}
              onChange={(e) => setAdjustmentStart(e.target.value)}
              className="border p-1"
            />
            <label className="ml-4 mr-2">End Date:</label>
            <input
              type="date"
              value={adjustmentEnd}
              onChange={(e) => setAdjustmentEnd(e.target.value)}
              className="border p-1"
            />
            <button
              onClick={() => fetchAdjustmentData(adjustmentStart, adjustmentEnd)}
              className="ml-4 px-4 py-2 bg-blue-500 text-white rounded"
            >
              Apply Filter
            </button>
          </div>
          <table className="min-w-full bg-white border border-gray-200 shadow rounded">
            <thead className="bg-green-100 text-left">
              <tr>
                <th className="py-2 px-4 border-b">Adjustment ID</th>
                <th className="py-2 px-4 border-b">Product</th>
                <th className="py-2 px-4 border-b">Quantity</th>
                <th className="py-2 px-4 border-b">Reason</th>
                <th className="py-2 px-4 border-b">Notes</th>
                <th className="py-2 px-4 border-b">Date</th>
              </tr>
            </thead>
            <tbody>
              {currentAdjustments.map((adjustment) => (
                <tr key={adjustment.id} className="hover:bg-gray-50">
                  <td className="py-2 px-4 border-b">{adjustment.id}</td>
                  <td className="py-2 px-4 border-b">{adjustment.product_name}</td>
                  <td className="py-2 px-4 border-b">{adjustment.quantity}</td>
                  <td className="py-2 px-4 border-b">{adjustment.reason}</td>
                  <td className="py-2 px-4 border-b">{adjustment.notes}</td>
                  <td className="py-2 px-4 border-b">{adjustment.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-4 flex justify-between">
            <button
              onClick={() => setAdjustmentPage((prev) => Math.max(prev - 1, 1))}
              disabled={adjustmentPage === 1}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span>Page {adjustmentPage} of {totalAdjustmentPages}</span>
            <button
              onClick={() => setAdjustmentPage((prev) => Math.min(prev + 1, totalAdjustmentPages))}
              disabled={adjustmentPage === totalAdjustmentPages}
              className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptData && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center">
          <div className="bg-white p-6 rounded shadow-lg max-w-lg w-full">
            <h3 className="text-xl font-bold mb-4">Receipt Details</h3>
            <p><strong>Transaction ID:</strong> {receiptData.ref}</p>
            <p><strong>Date:</strong> {receiptData.date}</p>
            <p><strong>Subtotal:</strong> ₱{receiptData.subtotal.toLocaleString()}</p>
            <p><strong>Discount:</strong> {receiptData.discount}%</p>
            <p><strong>Total:</strong> ₱{receiptData.total.toLocaleString()}</p>
            <p><strong>Payment:</strong> ₱{receiptData.payment.toLocaleString()}</p>
            <p><strong>Change:</strong> ₱{receiptData.change.toLocaleString()}</p>
            <h4 className="mt-4 font-bold">Products</h4>
            <table className="min-w-full bg-white border border-gray-200 mt-2">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b">Product</th>
                  <th className="py-2 px-4 border-b">Quantity</th>
                  <th className="py-2 px-4 border-b">Unit Price</th>
                  <th className="py-2 px-4 border-b">Total</th>
                </tr>
              </thead>
              <tbody>
                {receiptData.items.map((item) => (
                  <tr key={item.id}>
                    <td className="py-2 px-4 border-b">{item.name}</td>
                    <td className="py-2 px-4 border-b">{item.quantity}</td>
                    <td className="py-2 px-4 border-b">₱{item.price.toLocaleString()}</td>
                    <td className="py-2 px-4 border-b">₱{item.total.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 flex justify-end space-x-4">
              <button
                onClick={() => setReceiptData(null)}
                className="px-4 py-2 bg-red-500 text-white rounded"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-green-500 text-white rounded"
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