<?php
require_once '../cors_handler.php';
// Very important: This should be at the top of the file
// Disable displaying errors to prevent HTML in JSON output
ini_set('display_errors', 0);
error_reporting(E_ALL); // Still log errors, but don't display them



// report.php - API endpoints for generating reports
require_once '../db_connection.php';

// Get the HTTP request method
$method = $_SERVER['REQUEST_METHOD'];

// Add proper content type header for all responses
header('Content-Type: application/json');

// Endpoint router
switch ($method) {
    case 'GET':
        if (isset($_GET['report'])) {
            switch ($_GET['report']) {
                case 'sales':
                    // Get sales report (list of transactions)
                    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
                    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
                    getSalesReport($conn, $startDate, $endDate);
                    break;
                case 'sales_detail':
                    // Get details for a specific sales transaction
                    if (isset($_GET['transaction_id'])) {
                        getSalesDetailReport($conn, $_GET['transaction_id']);
                    } else {
                        echo json_encode(['error' => 'Transaction ID is required for sales_detail report']);
                    }
                    break;
                case 'inventory':
                    // Get inventory status report
                    getInventoryReport($conn);
                    break;
                case 'low_stock':
                    // Get low stock inventory report
                    getLowStockReport($conn);
                    break;
                case 'stock_adjustments':
                    // Get stock adjustments report
                    $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
                    $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
                    getStockAdjustmentReport($conn, $startDate, $endDate);
                    break;
                default:
                    echo json_encode(['error' => 'Invalid report type']);
                    break;
            }
        } else {
            echo json_encode(['error' => 'Report parameter is required']);
        }
        break;
    default:
        echo json_encode(['error' => 'Method not allowed']);
        break;
}

// Function to get a list of sales transactions
function getSalesReport($conn, $startDate = null, $endDate = null) {
    try {
        $sql = "SELECT transaction_id, transaction_ref, discount_percentage, subtotal,
                total_amount, payment_amount, change_amount, transaction_date, notes
                FROM transactions";

        // Add date filters if provided
        $params = [];
        $types = "";
        $whereAdded = false;

        if ($startDate) {
            $sql .= " WHERE transaction_date >= ?";
            $params[] = $startDate . " 00:00:00";
            $types .= "s";
            $whereAdded = true;
        }

        if ($endDate) {
            $sql .= $whereAdded ? " AND transaction_date <= ?" : " WHERE transaction_date <= ?";
            $params[] = $endDate . " 23:59:59";
            $types .= "s";
        }

        $sql .= " ORDER BY transaction_date DESC";

        $stmt = $conn->prepare($sql);

        // Bind parameters if any
        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }

        $stmt->execute();
        $result = $stmt->get_result();

        $transactions = [];
        while ($row = $result->fetch_assoc()) {
            $transactions[] = [
                'id' => (int)$row['transaction_id'],
                'ref' => $row['transaction_ref'],
                'discount' => (float)$row['discount_percentage'],
                'subtotal' => (float)$row['subtotal'],
                'total' => (float)$row['total_amount'],
                'received' => (float)$row['payment_amount'],
                'change' => (float)$row['change_amount'],
                'date' => $row['transaction_date'],
                'notes' => $row['notes']
            ];
        }

        echo json_encode(['transactions' => $transactions]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to get details of a specific sales transaction with products
function getSalesDetailReport($conn, $transactionId) {
    try {
        // Get transaction header
        $stmt = $conn->prepare("SELECT * FROM transactions WHERE transaction_id = ? OR transaction_ref = ?");
        $stmt->bind_param("is", $transactionId, $transactionId);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows === 0) {
            echo json_encode(['error' => 'Transaction not found']);
            return;
        }

        $transaction = $result->fetch_assoc();

        // Get transaction items with product details
        $stmt = $conn->prepare("SELECT ti.*, p.name, p.unit, p.supplier_name
                                FROM transaction_items ti
                                JOIN products p ON ti.product_id = p.product_id
                                WHERE ti.transaction_id = ?");
        $dbTransactionId = $transaction['transaction_id'];
        $stmt->bind_param("i", $dbTransactionId);
        $stmt->execute();
        $result = $stmt->get_result();

        $items = [];
        while ($row = $result->fetch_assoc()) {
            $items[] = [
                'id' => (int)$row['product_id'],
                'name' => $row['name'],
                'supplier_name' => $row['supplier_name'],
                'quantity' => (int)$row['quantity'],
                'unit' => $row['unit'],
                'price' => (float)$row['unit_price'],
                'total' => (float)$row['line_total']
            ];
        }

        // Format response
        $response = [
            'id' => (int)$transaction['transaction_id'],
            'ref' => $transaction['transaction_ref'],
            'date' => $transaction['transaction_date'],
            'discount' => (float)$transaction['discount_percentage'],
            'subtotal' => (float)$transaction['subtotal'],
            'total' => (float)$transaction['total_amount'],
            'payment' => (float)$transaction['payment_amount'],
            'change' => (float)$transaction['change_amount'],
            'notes' => $transaction['notes'],
            'items' => $items
        ];

        echo json_encode(['transaction_detail' => $response]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to get current inventory status report
function getInventoryReport($conn) {
    try {
        $sql = "SELECT p.product_id, p.name, c.name as category_name, p.supplier_name, 
                       p.current_stock, p.min_stock, p.unit, p.price, p.is_active
                FROM products p
                JOIN categories c ON p.category_id = c.category_id
                ORDER BY p.name ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $result = $stmt->get_result();

        $inventory = [];
        while ($row = $result->fetch_assoc()) {
            $inventory[] = [
                'id' => (int)$row['product_id'],
                'name' => $row['name'],
                'category' => $row['category_name'],
                'supplier_name' => $row['supplier_name'],
                'current_stock' => (int)$row['current_stock'],
                'min_stock' => (int)$row['min_stock'],
                'unit' => $row['unit'],
                'price' => (float)$row['price'],
                'is_active' => (bool)$row['is_active'],
                'stock_status' => ((int)$row['current_stock'] <= (int)$row['min_stock'] && (int)$row['current_stock'] > 0) ? 'Low Stock' : (((int)$row['current_stock'] == 0) ? 'Out of Stock' : 'In Stock')
            ];
        }

        echo json_encode(['inventory' => $inventory]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to get low stock inventory report
function getLowStockReport($conn) {
    try {
        $sql = "SELECT p.product_id, p.name, c.name as category_name, p.supplier_name, 
                       p.current_stock, p.min_stock, p.unit, p.price
                FROM products p
                JOIN categories c ON p.category_id = c.category_id
                WHERE p.current_stock <= p.min_stock AND p.is_active = 1
                ORDER BY p.current_stock ASC";

        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $result = $stmt->get_result();

        $lowStockItems = [];
        while ($row = $result->fetch_assoc()) {
            $lowStockItems[] = [
                'id' => (int)$row['product_id'],
                'name' => $row['name'],
                'category' => $row['category_name'],
                'supplier_name' => $row['supplier_name'],
                'current_stock' => (int)$row['current_stock'],
                'min_stock' => (int)$row['min_stock'],
                'unit' => $row['unit'],
                'price' => (float)$row['price']
            ];
        }

        echo json_encode(['low_stock_items' => $lowStockItems]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}


// Function to get stock adjustments report
function getStockAdjustmentReport($conn, $startDate = null, $endDate = null) {
    try {
        $sql = "SELECT sa.adjustment_id, sa.product_id, p.name as product_name, 
                       sa.quantity, sa.reason, sa.notes, sa.adjustment_date
                FROM stock_adjustments sa
                JOIN products p ON sa.product_id = p.product_id";
        
        // Add date filters if provided
        $params = [];
        $types = "";
        $whereAdded = false;

        if ($startDate) {
            $sql .= " WHERE sa.adjustment_date >= ?";
            $params[] = $startDate . " 00:00:00";
            $types .= "s";
            $whereAdded = true;
        }

        if ($endDate) {
            $sql .= $whereAdded ? " AND sa.adjustment_date <= ?" : " WHERE sa.adjustment_date <= ?";
            $params[] = $endDate . " 23:59:59";
            $types .= "s";
        }

        $sql .= " ORDER BY sa.adjustment_date DESC";

        $stmt = $conn->prepare($sql);
        
         // Bind parameters if any
        if (count($params) > 0) {
            $stmt->bind_param($types, ...$params);
        }

        $stmt->execute();
        $result = $stmt->get_result();

        $adjustments = [];
        while ($row = $result->fetch_assoc()) {
            $adjustments[] = [
                'id' => (int)$row['adjustment_id'],
                'product_id' => (int)$row['product_id'],
                'product_name' => $row['product_name'],
                'quantity' => (int)$row['quantity'], // Positive for additions, negative for removals
                'reason' => $row['reason'],
                'notes' => $row['notes'],
                'date' => $row['adjustment_date']
            ];
        }

        echo json_encode(['stock_adjustments' => $adjustments]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}
?>