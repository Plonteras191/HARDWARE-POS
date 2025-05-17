<?php
require_once '../cors_handler.php';
require_once '../db_connection.php';

// Set appropriate content type for JSON responses
header('Content-Type: application/json');

// Get the HTTP request method
$method = $_SERVER['REQUEST_METHOD'];

// Only allow GET requests for dashboard
if ($method !== 'GET') {
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

// Process the requested action
$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'sales-summary':
        getSalesSummary($conn);
        break;
    case 'daily-sales':
        getDailySales($conn);
        break;
    case 'weekly-sales':
        getWeeklySales($conn);
        break;
    case 'monthly-sales':
        getMonthlySales($conn);
        break;
    case 'top-products':
        $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
        getTopProducts($conn, $limit);
        break;
    case 'inventory-status':
        getInventoryStatus($conn);
        break;
    case 'category-sales':
        getCategorySales($conn);
        break;
    default:
        echo json_encode(['error' => 'Invalid action']);
        break;
}

/**
 * Get overall sales summary (today, this week, this month, all time)
 */
function getSalesSummary($conn) {
    try {
        // Today's sales
        $stmt = $conn->prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total 
                              FROM transactions 
                              WHERE DATE(transaction_date) = CURDATE()");
        $stmt->execute();
        $todaySales = $stmt->get_result()->fetch_assoc();
        
        // This week's sales (starting Monday)
        $stmt = $conn->prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total 
                              FROM transactions 
                              WHERE YEARWEEK(transaction_date, 1) = YEARWEEK(CURDATE(), 1)");
        $stmt->execute();
        $weeklySales = $stmt->get_result()->fetch_assoc();
        
        // This month's sales
        $stmt = $conn->prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total 
                              FROM transactions 
                              WHERE YEAR(transaction_date) = YEAR(CURDATE()) 
                              AND MONTH(transaction_date) = MONTH(CURDATE())");
        $stmt->execute();
        $monthlySales = $stmt->get_result()->fetch_assoc();
        
        // All time sales
        $stmt = $conn->prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as total 
                              FROM transactions");
        $stmt->execute();
        $allTimeSales = $stmt->get_result()->fetch_assoc();
        
        // Low stock alerts
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM products 
                              WHERE current_stock <= min_stock AND is_active = 1");
        $stmt->execute();
        $lowStockCount = $stmt->get_result()->fetch_assoc()['count'];
        
        echo json_encode([
            'today' => [
                'count' => (int)$todaySales['count'],
                'total' => (float)$todaySales['total']
            ],
            'week' => [
                'count' => (int)$weeklySales['count'],
                'total' => (float)$weeklySales['total']
            ],
            'month' => [
                'count' => (int)$monthlySales['count'],
                'total' => (float)$monthlySales['total']
            ],
            'allTime' => [
                'count' => (int)$allTimeSales['count'],
                'total' => (float)$allTimeSales['total']
            ],
            'lowStock' => (int)$lowStockCount
        ]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Get daily sales for a chart (last 7 days by default)
 */
function getDailySales($conn) {
    try {
        $days = isset($_GET['days']) ? (int)$_GET['days'] : 7;
        
        // Limit to reasonable number
        if ($days > 31) $days = 31;
        
        $sql = "SELECT 
                DATE(transaction_date) as date,
                COUNT(*) as transactions,
                COALESCE(SUM(total_amount), 0) as total
                FROM transactions
                WHERE transaction_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                GROUP BY DATE(transaction_date)
                ORDER BY date ASC";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $days);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $data[] = [
                'date' => $row['date'],
                'transactions' => (int)$row['transactions'],
                'total' => (float)$row['total']
            ];
        }
        
        // Fill in missing days with zero values
        $filledData = fillMissingDates($data, $days);
        
        echo json_encode(['dailySales' => $filledData]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Get weekly sales data (last 12 weeks by default)
 */
function getWeeklySales($conn) {
    try {
        $weeks = isset($_GET['weeks']) ? (int)$_GET['weeks'] : 12;
        
        // Limit to reasonable number
        if ($weeks > 52) $weeks = 52;
        
        $sql = "SELECT 
                YEAR(transaction_date) as year,
                WEEK(transaction_date, 1) as week,
                MIN(DATE(transaction_date)) as start_date,
                COUNT(*) as transactions,
                COALESCE(SUM(total_amount), 0) as total
                FROM transactions
                WHERE transaction_date >= DATE_SUB(NOW(), INTERVAL ? WEEK)
                GROUP BY YEAR(transaction_date), WEEK(transaction_date, 1)
                ORDER BY year ASC, week ASC";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $weeks);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $data[] = [
                'year' => (int)$row['year'],
                'week' => (int)$row['week'],
                'startDate' => $row['start_date'],
                'transactions' => (int)$row['transactions'],
                'total' => (float)$row['total']
            ];
        }
        
        echo json_encode(['weeklySales' => $data]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Get monthly sales data (last 12 months by default)
 */
function getMonthlySales($conn) {
    try {
        $months = isset($_GET['months']) ? (int)$_GET['months'] : 12;
        
        // Limit to reasonable number
        if ($months > 60) $months = 60;
        
        $sql = "SELECT 
                YEAR(transaction_date) as year,
                MONTH(transaction_date) as month,
                DATE_FORMAT(transaction_date, '%Y-%m-01') as month_start,
                COUNT(*) as transactions,
                COALESCE(SUM(total_amount), 0) as total
                FROM transactions
                WHERE transaction_date >= DATE_SUB(NOW(), INTERVAL ? MONTH)
                GROUP BY YEAR(transaction_date), MONTH(transaction_date)
                ORDER BY year ASC, month ASC";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $months);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $monthName = date('F', strtotime($row['month_start']));
            
            $data[] = [
                'year' => (int)$row['year'],
                'month' => (int)$row['month'],
                'monthName' => $monthName,
                'transactions' => (int)$row['transactions'],
                'total' => (float)$row['total']
            ];
        }
        
        echo json_encode(['monthlySales' => $data]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Get top-selling products
 */
function getTopProducts($conn, $limit = 10) {
    try {
        $sql = "SELECT 
                p.product_id,
                p.name,
                p.unit,
                c.name as category,
                SUM(ti.quantity) as total_quantity,
                COALESCE(SUM(ti.line_total), 0) as total_sales
                FROM transaction_items ti
                JOIN products p ON ti.product_id = p.product_id
                JOIN categories c ON p.category_id = c.category_id
                GROUP BY p.product_id, p.name
                ORDER BY total_quantity DESC
                LIMIT ?";
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $data[] = [
                'id' => (int)$row['product_id'],
                'name' => $row['name'],
                'unit' => $row['unit'],
                'category' => $row['category'],
                'quantity' => (int)$row['total_quantity'],
                'sales' => (float)$row['total_sales']
            ];
        }
        
        echo json_encode(['topProducts' => $data]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Get inventory status summary (low stock, out of stock, etc.)
 */
function getInventoryStatus($conn) {
    try {
        // Low stock items (below min_stock)
        $stmt = $conn->prepare("SELECT 
                              COUNT(*) as count 
                              FROM products 
                              WHERE current_stock <= min_stock AND current_stock > 0 
                              AND is_active = 1");
        $stmt->execute();
        $lowStock = $stmt->get_result()->fetch_assoc()['count'];
        
        // Out of stock items
        $stmt = $conn->prepare("SELECT 
                              COUNT(*) as count 
                              FROM products 
                              WHERE current_stock = 0 AND is_active = 1");
        $stmt->execute();
        $outOfStock = $stmt->get_result()->fetch_assoc()['count'];
        
        // Well-stocked items
        $stmt = $conn->prepare("SELECT 
                              COUNT(*) as count 
                              FROM products 
                              WHERE current_stock > min_stock AND is_active = 1");
        $stmt->execute();
        $wellStocked = $stmt->get_result()->fetch_assoc()['count'];
        
        // Total active products
        $stmt = $conn->prepare("SELECT 
                              COUNT(*) as count 
                              FROM products 
                              WHERE is_active = 1");
        $stmt->execute();
        $totalActive = $stmt->get_result()->fetch_assoc()['count'];
        
        echo json_encode([
            'lowStock' => (int)$lowStock,
            'outOfStock' => (int)$outOfStock,
            'wellStocked' => (int)$wellStocked,
            'totalActive' => (int)$totalActive
        ]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Get sales breakdown by category
 */
function getCategorySales($conn) {
    try {
        $sql = "SELECT 
                c.category_id,
                c.name as category,
                COUNT(DISTINCT t.transaction_id) as transaction_count,
                SUM(ti.quantity) as items_sold,
                COALESCE(SUM(ti.line_total), 0) as total_sales
                FROM categories c
                JOIN products p ON c.category_id = p.category_id
                JOIN transaction_items ti ON p.product_id = ti.product_id
                JOIN transactions t ON ti.transaction_id = t.transaction_id
                GROUP BY c.category_id, c.name
                ORDER BY total_sales DESC";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $data = [];
        while ($row = $result->fetch_assoc()) {
            $data[] = [
                'id' => (int)$row['category_id'],
                'name' => $row['category'],
                'transactions' => (int)$row['transaction_count'],
                'quantity' => (int)$row['items_sold'],
                'sales' => (float)$row['total_sales']
            ];
        }
        
        echo json_encode(['categorySales' => $data]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

/**
 * Helper function to fill in missing dates with zero values
 */
function fillMissingDates($data, $days) {
    $filledData = [];
    $dateMap = [];
    
    // Create a map of existing dates
    foreach ($data as $item) {
        $dateMap[$item['date']] = $item;
    }
    
    // Generate all dates for the period
    $endDate = date('Y-m-d');
    $startDate = date('Y-m-d', strtotime("-" . ($days - 1) . " days"));
    
    $currentDate = $startDate;
    while (strtotime($currentDate) <= strtotime($endDate)) {
        if (isset($dateMap[$currentDate])) {
            $filledData[] = $dateMap[$currentDate];
        } else {
            $filledData[] = [
                'date' => $currentDate,
                'transactions' => 0,
                'total' => 0
            ];
        }
        
        $currentDate = date('Y-m-d', strtotime($currentDate . ' +1 day'));
    }
    
    return $filledData;
}
?>