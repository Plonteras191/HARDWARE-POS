import React, { useState, useEffect } from "react";
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";
import styles from "../styles/dash.module.css";

const API_URL = "http://localhost/HARD-POS/backend/api/dashboard.php";

const Dashboard = () => {
  // State for all dashboard data
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [salesSummary, setSalesSummary] = useState(null);
  const [dailySales, setDailySales] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [inventoryStatus, setInventoryStatus] = useState(null);
  const [categorySales, setCategorySales] = useState([]);

  // Colors for charts
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
  
  // Format a date string to a more readable format (MMM dd)
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const month = date.toLocaleString('default', { month: 'short' });
    const day = date.getDate();
    return `${month} ${day}`;
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch sales summary
        const summaryResponse = await fetch(`${API_URL}?action=sales-summary`);
        const summaryData = await summaryResponse.json();
        
        // Fetch daily sales (last 7 days)
        const dailyResponse = await fetch(`${API_URL}?action=daily-sales&days=7`);
        const dailyData = await dailyResponse.json();
        
        // Fetch top products
        const productsResponse = await fetch(`${API_URL}?action=top-products&limit=5`);
        const productsData = await productsResponse.json();
        
        // Fetch inventory status
        const inventoryResponse = await fetch(`${API_URL}?action=inventory-status`);
        const inventoryData = await inventoryResponse.json();
        
        // Fetch category sales
        const categoryResponse = await fetch(`${API_URL}?action=category-sales`);
        const categoryData = await categoryResponse.json();
        
        // Update state with fetched data
        setSalesSummary(summaryData);
        setDailySales(dailyData.dailySales.map(day => ({
          ...day,
          formattedDate: formatDate(day.date)
        })));
        setTopProducts(productsData.topProducts);
        setInventoryStatus(inventoryData);
        setCategorySales(categoryData.categorySales);
        
        setError(null);
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        setError("Failed to load dashboard data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>
          <div className={styles.loadingMessage}>Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorText}>
          <div className={styles.errorMessage}>{error}</div>
          <button 
            className={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      <h1 className={styles.dashboardTitle}>Admin Dashboard</h1>

      {/* Sales Summary Cards */}
      <div className={styles.cardsGrid}>
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Today's Sales</h2>
          <p className={`${styles.cardAmount} ${styles.todaySales}`}>
            {salesSummary && formatCurrency(salesSummary.today.total)}
          </p>
          <p className={styles.cardTransactions}>
            {salesSummary && salesSummary.today.count} transactions
          </p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Weekly Sales</h2>
          <p className={`${styles.cardAmount} ${styles.weeklySales}`}>
            {salesSummary && formatCurrency(salesSummary.week.total)}
          </p>
          <p className={styles.cardTransactions}>
            {salesSummary && salesSummary.week.count} transactions
          </p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Monthly Sales</h2>
          <p className={`${styles.cardAmount} ${styles.monthlySales}`}>
            {salesSummary && formatCurrency(salesSummary.month.total)}
          </p>
          <p className={styles.cardTransactions}>
            {salesSummary && salesSummary.month.count} transactions
          </p>
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>All Time Sales</h2>
          <p className={`${styles.cardAmount} ${styles.allTimeSales}`}>
            {salesSummary && formatCurrency(salesSummary.allTime.total)}
          </p>
          <p className={styles.cardTransactions}>
            {salesSummary && salesSummary.allTime.count} transactions
          </p>
        </div>
      </div>

      {/* Daily Sales Chart */}
      <div className={styles.chartContainer}>
        <h2 className={styles.chartTitle}>Daily Sales (Last 7 Days)</h2>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={dailySales}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="formattedDate" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip formatter={(value, name) => {
                if (name === "Total Sales") return formatCurrency(value);
                return value;
              }} />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="total"
                name="Total Sales"
                stroke="#8884d8"
                activeDot={{ r: 8 }}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="transactions"
                name="Transactions"
                stroke="#82ca9d"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Inventory Status and Top Products */}
      <div className={styles.twoColumnsGrid}>
        {/* Inventory Status */}
        <div className={styles.chartContainer}>
          <h2 className={styles.chartTitle}>Inventory Status</h2>
          {inventoryStatus && (
            <>
              <div className={styles.pieChartWrapper}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Well Stocked", value: inventoryStatus.wellStocked },
                        { name: "Low Stock", value: inventoryStatus.lowStock },
                        { name: "Out of Stock", value: inventoryStatus.outOfStock }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#ef4444" />
                    </Pie>
                    <Tooltip formatter={(value) => [value, "Items"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.inventoryStatsGrid}>
                <div className={`${styles.inventoryStat} ${styles.wellStocked}`}>
                  <p className={styles.statLabel}>Well Stocked</p>
                  <p className={styles.wellStockedValue}>{inventoryStatus.wellStocked}</p>
                </div>
                <div className={`${styles.inventoryStat} ${styles.lowStock}`}>
                  <p className={styles.statLabel}>Low Stock</p>
                  <p className={styles.lowStockValue}>{inventoryStatus.lowStock}</p>
                </div>
                <div className={`${styles.inventoryStat} ${styles.outOfStock}`}>
                  <p className={styles.statLabel}>Out of Stock</p>
                  <p className={styles.outOfStockValue}>{inventoryStatus.outOfStock}</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Top Products */}
        <div className={styles.chartContainer}>
          <h2 className={styles.chartTitle}>Top 5 Products</h2>
          <div className={styles.chartWrapper}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topProducts}
                margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45} 
                  textAnchor="end" 
                  height={70}
                  interval={0}
                />
                <YAxis />
                <Tooltip formatter={(value, name) => {
                  if (name === "Sales") return formatCurrency(value);
                  return value;
                }} />
                <Legend />
                <Bar dataKey="quantity" name="Quantity Sold" fill="#8884d8" />
                <Bar dataKey="sales" name="Sales" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Sales */}
      <div className={styles.chartContainer}>
        <h2 className={styles.chartTitle}>Sales by Category</h2>
        <div className={styles.chartWrapper}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categorySales}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={120} />
              <Tooltip formatter={(value, name) => {
                if (name === "Sales Amount") return formatCurrency(value);
                return value;
              }} />
              <Legend />
              <Bar dataKey="sales" name="Sales Amount" fill="#8884d8" />
              <Bar dataKey="quantity" name="Items Sold" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;