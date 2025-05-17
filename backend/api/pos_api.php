<?php
// Very important: This should be at the top of the file
// Disable displaying errors to prevent HTML in JSON output
ini_set('display_errors', 0);
error_reporting(E_ALL); // Still log errors, but don't display them

require_once '../cors_handler.php';

// pos_api.php - API endpoints for Point of Sale operations
require_once '../db_connection.php';

// Get the HTTP request method
$method = $_SERVER['REQUEST_METHOD'];

// Get request body for POST, PUT methods
$data = json_decode(file_get_contents('php://input'), true);

// Check if JSON parsing failed
if (json_last_error() !== JSON_ERROR_NONE && ($method === 'POST' || $method === 'PUT')) {
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]);
    exit;
}

// Add proper content type header for all responses
header('Content-Type: application/json');

// Endpoint router
switch ($method) {
    case 'GET':
        if (isset($_GET['action']) && $_GET['action'] === 'products') {
            // Get all active products for POS
            getPOSProducts($conn);
        } elseif (isset($_GET['action']) && $_GET['action'] === 'categories') {
            // Get categories for filter
            getCategories($conn);
        } elseif (isset($_GET['action']) && $_GET['action'] === 'transactions') {
            // Get transactions history (with optional date filters)
            $startDate = isset($_GET['start_date']) ? $_GET['start_date'] : null;
            $endDate = isset($_GET['end_date']) ? $_GET['end_date'] : null;
            getTransactions($conn, $startDate, $endDate);
        } elseif (isset($_GET['transaction_id'])) {
            // Get details of a specific transaction
            getTransactionDetails($conn, $_GET['transaction_id']);
        } else {
            echo json_encode(['error' => 'Invalid action']);
        }
        break;
    case 'POST':
        if (isset($_GET['action']) && $_GET['action'] === 'create-transaction') {
            // Create a new sales transaction
            createTransaction($conn, $data);
        } else {
            echo json_encode(['error' => 'Invalid action']);
        }
        break;
    default:
        echo json_encode(['error' => 'Method not allowed']);
        break;
}

// Function to get all active products for POS display
function getPOSProducts($conn) {
    try {
        $sql = "SELECT p.*, c.name as category_name 
                FROM products p
                JOIN categories c ON p.category_id = c.category_id
                WHERE p.is_active = 1
                ORDER BY p.name ASC";
        
        $stmt = $conn->prepare($sql);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $products = [];
        while ($row = $result->fetch_assoc()) {
            // Format product data
            $products[] = [
                'id' => (int)$row['product_id'],
                'name' => $row['name'],
                'category' => $row['category_name'],
                'price' => (float)$row['price'],
                'stock' => (int)$row['current_stock'],
                'unit' => $row['unit'],
                'supplier_name' => $row['supplier_name']
            ];
        }
        
        echo json_encode(['products' => $products]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to get all categories for filter
function getCategories($conn) {
    try {
        $stmt = $conn->prepare("SELECT category_id, name FROM categories ORDER BY name ASC");
        $stmt->execute();
        $result = $stmt->get_result();
        
        $categories = [];
        while ($row = $result->fetch_assoc()) {
            $categories[] = [
                'id' => (int)$row['category_id'],
                'name' => $row['name']
            ];
        }
        
        echo json_encode(['categories' => $categories]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to create a new transaction
function createTransaction($conn, $data) {
    // Validate required fields
    if (empty($data['transactionId']) || empty($data['items']) || !isset($data['subtotal']) || 
        !isset($data['total']) || !isset($data['cashReceived'])) {
        echo json_encode(['error' => 'Missing required transaction data']);
        return;
    }
    
    // Validate items
    if (!is_array($data['items']) || count($data['items']) === 0) {
        echo json_encode(['error' => 'Transaction must contain at least one item']);
        return;
    }
    
    try {
        // Begin transaction
        $conn->begin_transaction();
        
        // Check if transaction reference already exists
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM transactions WHERE transaction_ref = ?");
        $stmt->bind_param("s", $data['transactionId']);
        $stmt->execute();
        $result = $stmt->get_result();
        $transactionExists = $result->fetch_assoc()['count'] > 0;
        
        if ($transactionExists) {
            $conn->rollback();
            echo json_encode(['error' => 'Transaction reference already exists']);
            return;
        }
        
        // Calculate values
        $subtotal = (float)$data['subtotal'];
        $discount = isset($data['discount']) ? (float)$data['discount'] : 0;
        $total = (float)$data['total'];
        $cashReceived = (float)$data['cashReceived'];
        $change = $cashReceived - $total;
        
        // Insert transaction record
        $stmt = $conn->prepare("INSERT INTO transactions (transaction_ref, discount_percentage, subtotal, total_amount, payment_amount, change_amount, notes) 
                              VALUES (?, ?, ?, ?, ?, ?, ?)");
        $notes = isset($data['notes']) ? $data['notes'] : null;
        $stmt->bind_param("sddddds", 
            $data['transactionId'], 
            $discount,
            $subtotal,
            $total,
            $cashReceived,
            $change,
            $notes
        );
        $stmt->execute();
        
        $transactionId = $conn->insert_id;
        
        // Process each item
        foreach ($data['items'] as $item) {
            // Validate item data
            if (empty($item['id']) || empty($item['quantity']) || !isset($item['price'])) {
                $conn->rollback();
                echo json_encode(['error' => 'Invalid item data in transaction']);
                return;
            }
            
            $productId = (int)$item['id'];
            $quantity = (int)$item['quantity'];
            $unitPrice = (float)$item['price'];
            $lineTotal = $quantity * $unitPrice;
            
            // Check if product exists and has enough stock
            $stmt = $conn->prepare("SELECT name, current_stock FROM products WHERE product_id = ?");
            $stmt->bind_param("i", $productId);
            $stmt->execute();
            $result = $stmt->get_result();
            
            if ($result->num_rows === 0) {
                $conn->rollback();
                echo json_encode(['error' => 'Product not found: ID ' . $productId]);
                return;
            }
            
            $row = $result->fetch_assoc();
            $currentStock = (int)$row['current_stock'];
            $productName = $row['name'];
            
            if ($currentStock < $quantity) {
                $conn->rollback();
                echo json_encode([
                    'error' => "Insufficient stock for {$productName}. Available: {$currentStock}, Requested: {$quantity}"
                ]);
                return;
            }
            
            // Insert transaction item
            $stmt = $conn->prepare("INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, line_total) 
                                  VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("iiddd", 
                $transactionId, 
                $productId,
                $quantity,
                $unitPrice,
                $lineTotal
            );
            $stmt->execute();
            
            // Update product stock directly without creating a stock adjustment record
            $newStock = $currentStock - $quantity;
            $stmt = $conn->prepare("UPDATE products SET current_stock = ? WHERE product_id = ?");
            $stmt->bind_param("ii", $newStock, $productId);
            $stmt->execute();
            
            // Removed the stock_adjustments insert code as requested
        }
        
        // Commit transaction
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Transaction completed successfully',
            'transactionId' => $data['transactionId'],
            'dbTransactionId' => $transactionId
        ]);
        
    } catch (Exception $e) {
        // Rollback transaction on error
        $conn->rollback();
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to get list of transactions
function getTransactions($conn, $startDate = null, $endDate = null) {
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

// Function to get details of a specific transaction
function getTransactionDetails($conn, $transactionId) {
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
        
        // Get transaction items
        $stmt = $conn->prepare("SELECT ti.*, p.name, p.unit 
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
        
        echo json_encode(['transaction' => $response]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}
?>