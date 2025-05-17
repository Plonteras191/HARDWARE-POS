<?php
require_once '../cors_handler.php';

// inventory_management.php - API endpoints for inventory management
require_once '../db_connection.php';


// Get the HTTP request method
$method = $_SERVER['REQUEST_METHOD'];

// Get request body for POST, PUT methods
$data = json_decode(file_get_contents('php://input'), true);

// Endpoint router
switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            // Get a specific product
            getProduct($conn, $_GET['id']);
        } else {
            // Get all products with optional search term and filter for active/inactive
            $searchTerm = isset($_GET['search']) ? $_GET['search'] : '';
            $activeOnly = isset($_GET['active']) ? $_GET['active'] === 'true' : true;
            getProducts($conn, $searchTerm, $activeOnly);
        }
        break;
    case 'POST':
        // Add a new product
        addProduct($conn, $data);
        break;
    case 'PUT':
        // Update a product
        if (isset($_GET['id'])) {
            updateProduct($conn, $_GET['id'], $data);
        } else {
            echo json_encode(['error' => 'Product ID is required']);
        }
        break;
    case 'PATCH':
        // Handle stock adjustments
        if (isset($_GET['action'])) {
            if ($_GET['action'] === 'adjust-stock' && isset($_GET['id'])) {
                adjustStock($conn, $_GET['id'], $data);
            } elseif ($_GET['action'] === 'toggle-status' && isset($_GET['id'])) {
                toggleProductStatus($conn, $_GET['id']);
            } else {
                echo json_encode(['error' => 'Invalid action or missing product ID']);
            }
        } else {
            echo json_encode(['error' => 'Action parameter is required']);
        }
        break;
    case 'DELETE':
        // Delete a product (Not recommended, use toggle status instead)
        if (isset($_GET['id'])) {
            deleteProduct($conn, $_GET['id']);
        } else {
            echo json_encode(['error' => 'Product ID is required']);
        }
        break;
    default:
        echo json_encode(['error' => 'Method not allowed']);
        break;
}

// Function to get all products with optional search and filter
function getProducts($conn, $searchTerm = '', $activeOnly = true) {
    $sql = "SELECT p.*, c.name as category_name 
            FROM products p
            JOIN categories c ON p.category_id = c.category_id
            WHERE 1=1";
    
    // Add search condition if provided
    if (!empty($searchTerm)) {
        $searchTerm = "%$searchTerm%";
        $sql .= " AND (p.name LIKE ? OR c.name LIKE ? OR p.supplier_name LIKE ?)";
    }
    
    // Add active filter condition if requested
    if ($activeOnly) {
        $sql .= " AND p.is_active = 1";
    }
    
    $sql .= " ORDER BY p.name ASC";
    
    try {
        $stmt = $conn->prepare($sql);
        
        // Bind parameters if search term is provided
        if (!empty($searchTerm)) {
            $stmt->bind_param("sss", $searchTerm, $searchTerm, $searchTerm);
        }
        
        $stmt->execute();
        $result = $stmt->get_result();
        
        $products = [];
        while ($row = $result->fetch_assoc()) {
            // Format product data
            $products[] = [
                'id' => (int)$row['product_id'],
                'name' => $row['name'],
                'supplier_name' => $row['supplier_name'],
                'category' => $row['category_name'],
                'category_id' => (int)$row['category_id'],
                'quantity' => (int)$row['current_stock'],
                'unit' => $row['unit'],
                'price' => (float)$row['price'],
                'minStock' => (int)$row['min_stock'],
                'isRemoved' => $row['is_active'] ? false : true
            ];
        }
        
        echo json_encode(['products' => $products]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to get a specific product
function getProduct($conn, $id) {
    try {
        $stmt = $conn->prepare("SELECT p.*, c.name as category_name 
                              FROM products p 
                              JOIN categories c ON p.category_id = c.category_id 
                              WHERE p.product_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        $row = $result->fetch_assoc();
        
        $product = [
            'id' => (int)$row['product_id'],
            'name' => $row['name'],
            'supplier_name' => $row['supplier_name'],
            'category' => $row['category_name'],
            'category_id' => (int)$row['category_id'],
            'quantity' => (int)$row['current_stock'],
            'unit' => $row['unit'],
            'price' => (float)$row['price'],
            'minStock' => (int)$row['min_stock'],
            'isRemoved' => $row['is_active'] ? false : true
        ];
        
        echo json_encode(['product' => $product]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to add a new product
function addProduct($conn, $data) {
    // Validate required fields
    if (empty($data['name']) || empty($data['category']) || !isset($data['quantity']) || 
        empty($data['unit']) || !isset($data['price']) || !isset($data['minStock']) ||
        empty($data['supplier_name'])) {
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }
    
    try {
        // Begin transaction
        $conn->begin_transaction();
        
        // Check if a product with the same name and supplier already exists
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM products WHERE name = ? AND supplier_name = ?");
        $stmt->bind_param("ss", $data['name'], $data['supplier_name']);
        $stmt->execute();
        $result = $stmt->get_result();
        $productExists = $result->fetch_assoc()['count'] > 0;
        
        if ($productExists) {
            $conn->rollback();
            echo json_encode(['error' => 'A product with this name and supplier already exists']);
            return;
        }
        
        // Check if category exists, if not create it
        $categoryId = getCategoryId($conn, $data['category']);
        
        // Insert product
        $stmt = $conn->prepare("INSERT INTO products (name, category_id, supplier_name, price, unit, min_stock, current_stock) 
                              VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->bind_param("sisdsis", 
            $data['name'], 
            $categoryId,
            $data['supplier_name'],
            $data['price'], 
            $data['unit'], 
            $data['minStock'], 
            $data['quantity']
        );
        $stmt->execute();
        
        $productId = $conn->insert_id;
        
        // Add initial stock adjustment record
        if ($data['quantity'] > 0) {
            $reason = 'initial';
            $notes = 'Initial inventory setup';
            
            $stmt = $conn->prepare("INSERT INTO stock_adjustments (product_id, quantity, reason, notes) 
                                  VALUES (?, ?, ?, ?)");
            $stmt->bind_param("iiss", $productId, $data['quantity'], $reason, $notes);
            $stmt->execute();
        }
        
        // Commit transaction
        $conn->commit();
        
        // Return the new product
        getProduct($conn, $productId);
        
    } catch (Exception $e) {
        // Rollback transaction on error
        $conn->rollback();
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to update a product
function updateProduct($conn, $id, $data) {
    // Validate required fields
    if (empty($data['name']) || empty($data['category']) || 
        empty($data['unit']) || !isset($data['price']) || !isset($data['minStock']) ||
        empty($data['supplier_name'])) {
        echo json_encode(['error' => 'Missing required fields']);
        return;
    }
    
    try {
        // Begin transaction
        $conn->begin_transaction();
        
        // Check if another product with the same name and supplier exists (excluding current product)
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM products WHERE name = ? AND supplier_name = ? AND product_id != ?");
        $stmt->bind_param("ssi", $data['name'], $data['supplier_name'], $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $duplicateExists = $result->fetch_assoc()['count'] > 0;
        
        if ($duplicateExists) {
            $conn->rollback();
            echo json_encode(['error' => 'Another product with this name and supplier already exists']);
            return;
        }
        
        // Check if category exists, if not create it
        $categoryId = getCategoryId($conn, $data['category']);
        
        // Get current stock to check if it changed
        $stmt = $conn->prepare("SELECT current_stock FROM products WHERE product_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            $conn->rollback();
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        $currentStock = $result->fetch_assoc()['current_stock'];
        
        // Update product
        $stmt = $conn->prepare("UPDATE products 
                              SET name = ?, category_id = ?, supplier_name = ?, price = ?, unit = ?, min_stock = ? 
                              WHERE product_id = ?");
       $stmt->bind_param(
  "sisdsii",           // ← CORRECT: 7 letters
  $data['name'],       // s
  $categoryId,         // i
  $data['supplier_name'], // s
  $data['price'],      // d
  $data['unit'],       // s
  $data['minStock'],   // i
  $id                  // i
);

        $stmt->execute();
        
        // If stock quantity was included in the update and changed, add an adjustment record
        if (isset($data['quantity']) && $data['quantity'] != $currentStock) {
            // Calculate difference
            $difference = $data['quantity'] - $currentStock;
            $reason = 'correction';
            $notes = 'Stock correction from product update';
            
            // Add stock adjustment record
            $stmt = $conn->prepare("INSERT INTO stock_adjustments (product_id, quantity, reason, notes) 
                                  VALUES (?, ?, ?, ?)");
            $stmt->bind_param("iiss", $id, $difference, $reason, $notes);
            $stmt->execute();
            
            // Update current stock
            $stmt = $conn->prepare("UPDATE products SET current_stock = ? WHERE product_id = ?");
            $stmt->bind_param("ii", $data['quantity'], $id);
            $stmt->execute();
        }
        
        // Commit transaction
        $conn->commit();
        
        // Return the updated product
        getProduct($conn, $id);
        
    } catch (Exception $e) {
        // Rollback transaction on error
        $conn->rollback();
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to adjust stock (add or remove)
function adjustStock($conn, $id, $data) {
    // Validate required fields
    if (!isset($data['amount']) || !isset($data['adjustmentType'])) {
        echo json_encode(['error' => 'Missing amount or adjustment type']);
        return;
    }
    
    $amount = (int)$data['amount'];
    $adjustmentType = $data['adjustmentType'];
    
    if ($amount <= 0) {
        echo json_encode(['error' => 'Amount must be a positive number']);
        return;
    }
    
    try {
        // Begin transaction
        $conn->begin_transaction();
        
        // Get current product stock
        $stmt = $conn->prepare("SELECT name, current_stock FROM products WHERE product_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            $conn->rollback();
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        $row = $result->fetch_assoc();
        $currentStock = (int)$row['current_stock'];
        $productName = $row['name'];
        
        // Calculate new quantity based on adjustment type
        $adjustmentValue = $adjustmentType === 'add' ? $amount : -$amount;
        $newQuantity = $currentStock + $adjustmentValue;
        
        // Check if removing more than available
        if ($newQuantity < 0) {
            $conn->rollback();
            echo json_encode([
                'error' => "Cannot reduce stock for {$productName} below 0. Current stock: {$currentStock}."
            ]);
            return;
        }
        
        // Update stock
        $stmt = $conn->prepare("UPDATE products SET current_stock = ? WHERE product_id = ?");
        $stmt->bind_param("ii", $newQuantity, $id);
        $stmt->execute();
        
        // Add stock adjustment record
        $reason = $adjustmentType === 'add' ? 'purchase' : 'correction';
        $notes = $adjustmentType === 'add' ? 'Stock added' : 'Stock removed';
        
        $stmt = $conn->prepare("INSERT INTO stock_adjustments (product_id, quantity, reason, notes) 
                              VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiss", $id, $adjustmentValue, $reason, $notes);
        $stmt->execute();
        
        // Commit transaction
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => "Stock for {$productName} " . 
                         ($adjustmentType === 'add' ? 'increased' : 'decreased') . 
                         " by {$amount}. New quantity: {$newQuantity}.",
            'product' => [
                'id' => (int)$id,
                'quantity' => $newQuantity
            ]
        ]);
        
    } catch (Exception $e) {
        // Rollback transaction on error
        $conn->rollback();
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to toggle product active status (remove/restore)
function toggleProductStatus($conn, $id) {
    try {
        // Get current status
        $stmt = $conn->prepare("SELECT name, is_active FROM products WHERE product_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        $row = $result->fetch_assoc();
        $currentStatus = (int)$row['is_active'];
        $productName = $row['name'];
        
        // Toggle status
        $newStatus = $currentStatus ? 0 : 1;
        
        $stmt = $conn->prepare("UPDATE products SET is_active = ? WHERE product_id = ?");
        $stmt->bind_param("ii", $newStatus, $id);
        $stmt->execute();
        
        echo json_encode([
            'success' => true,
            'message' => "\"{$productName}\" has been " . ($newStatus ? "restored to Active Items" : "moved to Removed Items"),
            'product' => [
                'id' => (int)$id,
                'isRemoved' => !$newStatus
            ]
        ]);
        
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Function to delete a product (not recommended, use toggle status instead)
function deleteProduct($conn, $id) {
    try {
        // Check if there are related records
        $stmt = $conn->prepare("SELECT COUNT(*) as count FROM stock_adjustments WHERE product_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        $hasRelatedRecords = $result->fetch_assoc()['count'] > 0;
        
        if ($hasRelatedRecords) {
            echo json_encode([
                'error' => 'Cannot delete product with related stock records. Use toggle status instead.'
            ]);
            return;
        }
        
        // Get product name for response message
        $stmt = $conn->prepare("SELECT name FROM products WHERE product_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();
        
        if ($result->num_rows === 0) {
            echo json_encode(['error' => 'Product not found']);
            return;
        }
        
        $productName = $result->fetch_assoc()['name'];
        
        // Delete product
        $stmt = $conn->prepare("DELETE FROM products WHERE product_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        
        echo json_encode([
            'success' => true,
            'message' => "Product \"{$productName}\" has been permanently deleted."
        ]);
        
    } catch (Exception $e) {
        echo json_encode(['error' => 'Database error: ' . $e->getMessage()]);
    }
}

// Helper function to get or create category ID
function getCategoryId($conn, $categoryName) {
    // First check if category exists
    $stmt = $conn->prepare("SELECT category_id FROM categories WHERE name = ?");
    $stmt->bind_param("s", $categoryName);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        // Category exists, return its ID
        return $result->fetch_assoc()['category_id'];
    } else {
        // Category doesn't exist, create it
        $stmt = $conn->prepare("INSERT INTO categories (name) VALUES (?)");
        $stmt->bind_param("s", $categoryName);
        $stmt->execute();
        return $conn->insert_id;
    }
}
?>