<?php
require_once 'db_connection.php'; // Includes DB connection, sets headers, handles OPTIONS

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : null;

// Basic input sanitization helper
function sanitize_input($conn, $data) {
    if (is_array($data)) {
        return array_map(function($item) use ($conn) {
            return sanitize_input($conn, $item);
        }, $data);
    }
    return $conn->real_escape_string(trim(htmlspecialchars($data)));
}


if ($method === 'GET') {
    if ($action === 'products') {
        try {
            $searchTerm = isset($_GET['search']) ? sanitize_input($conn, $_GET['search']) : '';
            $categoryFilter = isset($_GET['category']) ? sanitize_input($conn, $_GET['category']) : 'All';

            $sql = "SELECT p.product_id, p.name, c.name as category_name, p.price, p.current_stock
                    FROM products p
                    JOIN categories c ON p.category_id = c.category_id
                    WHERE p.is_active = 1";

            $params = [];
            $types = "";

            if (!empty($searchTerm)) {
                $sql .= " AND (p.name LIKE ? OR c.name LIKE ?)";
                $search_like = "%" . $searchTerm . "%";
                array_push($params, $search_like, $search_like);
                $types .= "ss";
            }

            if ($categoryFilter !== 'All' && !empty($categoryFilter)) {
                $sql .= " AND c.name = ?";
                array_push($params, $categoryFilter);
                $types .= "s";
            }
            $sql .= " ORDER BY p.name ASC";

            $stmt = $conn->prepare($sql);
            if (!$stmt) {
                throw new Exception("Prepare statement failed (products): " . $conn->error);
            }

            if (!empty($types)) {
                $stmt->bind_param($types, ...$params);
            }

            $stmt->execute();
            $result = $stmt->get_result();
            $products = [];
            while ($row = $result->fetch_assoc()) {
                $products[] = [
                    'id' => $row['product_id'],
                    'name' => $row['name'],
                    'category' => $row['category_name'],
                    'price' => floatval($row['price']),
                    'stock' => intval($row['current_stock'])
                ];
            }
            $stmt->close();
            echo json_encode($products);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "Failed to fetch products: " . $e->getMessage()]);
            error_log("GET products (POS) error: " . $e->getMessage());
        }

    } elseif ($action === 'categories') {
        try {
            $sql = "SELECT DISTINCT c.name 
                    FROM categories c 
                    JOIN products p ON c.category_id = p.category_id 
                    WHERE p.is_active = 1 
                    ORDER BY c.name ASC";
            $result = $conn->query($sql);
            if (!$result) {
                 throw new Exception("Query failed (categories): " . $conn->error);
            }
            $categories = [];
            while ($row = $result->fetch_assoc()) {
                $categories[] = $row['name'];
            }
            echo json_encode($categories);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "Failed to fetch categories: " . $e->getMessage()]);
            error_log("GET categories (POS) error: " . $e->getMessage());
        }
    } else {
        http_response_code(400);
        echo json_encode(["error" => "Invalid GET action for POS API."]);
    }

} elseif ($method === 'POST') {
    if ($action === 'checkout') {
        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid JSON input."]);
            exit;
        }

        // --- Sanitize and Validate Input ---
        $transaction_ref = isset($input['transaction_ref']) ? sanitize_input($conn, $input['transaction_ref']) : null;
        $cart = isset($input['cart']) && is_array($input['cart']) ? $input['cart'] : [];
        $discount_percentage = isset($input['discount_percentage']) ? floatval($input['discount_percentage']) : 0;
        $subtotal = isset($input['subtotal']) ? floatval($input['subtotal']) : 0;
        $total_amount = isset($input['total_amount']) ? floatval($input['total_amount']) : 0;
        $payment_amount = isset($input['payment_amount']) ? floatval($input['payment_amount']) : 0;
        $change_amount = isset($input['change_amount']) ? floatval($input['change_amount']) : 0;
        $notes = isset($input['notes']) ? sanitize_input($conn, $input['notes']) : null;


        if (empty($transaction_ref) || empty($cart) || $payment_amount < $total_amount) {
            http_response_code(400);
            echo json_encode(["error" => "Missing or invalid transaction data. Ensure cart is not empty and payment is sufficient."]);
            exit;
        }
        if ($discount_percentage < 0 || $discount_percentage > 100) {
            http_response_code(400);
            echo json_encode(["error" => "Discount percentage must be between 0 and 100."]);
            exit;
        }


        $conn->begin_transaction();

        try {
            // 1. Validate stock for all cart items
            foreach ($cart as $item) {
                $product_id = intval($item['id']);
                $quantity_to_sell = intval($item['quantity']);

                if ($quantity_to_sell <= 0) {
                     throw new Exception("Invalid quantity for product ID " . $product_id . ".");
                }

                $stmt_stock_check = $conn->prepare("SELECT current_stock, name FROM products WHERE product_id = ? AND is_active = 1");
                if (!$stmt_stock_check) throw new Exception("Stock check prepare failed: " . $conn->error);
                $stmt_stock_check->bind_param("i", $product_id);
                $stmt_stock_check->execute();
                $product_data = $stmt_stock_check->get_result()->fetch_assoc();
                $stmt_stock_check->close();

                if (!$product_data) {
                    throw new Exception("Product ID " . $product_id . " not found or is inactive.");
                }
                if ($product_data['current_stock'] < $quantity_to_sell) {
                    throw new Exception("Insufficient stock for product: " . $product_data['name'] . ". Available: " . $product_data['current_stock'] . ", Requested: " . $quantity_to_sell);
                }
            }

            // 2. Insert into transactions table
            $stmt_transaction = $conn->prepare("INSERT INTO transactions (transaction_ref, discount_percentage, subtotal, total_amount, payment_amount, change_amount, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
            if (!$stmt_transaction) throw new Exception("Transaction prepare failed: " . $conn->error);
            $stmt_transaction->bind_param("sddddds", $transaction_ref, $discount_percentage, $subtotal, $total_amount, $payment_amount, $change_amount, $notes);
            if (!$stmt_transaction->execute()) {
                 // Check for duplicate transaction_ref
                if ($conn->errno == 1062) { // MySQL error code for duplicate entry
                    throw new Exception("Transaction reference " . $transaction_ref . " already exists. Please generate a new one.");
                }
                throw new Exception("Failed to create transaction record: " . $stmt_transaction->error);
            }
            $transaction_id = $stmt_transaction->insert_id;
            $stmt_transaction->close();

            // 3. Process each cart item
            foreach ($cart as $item) {
                $product_id = intval($item['id']);
                $quantity_sold = intval($item['quantity']);
                $unit_price = floatval($item['price']); // Price per unit at the time of sale
                $line_total = $unit_price * $quantity_sold; // Recalculate or trust frontend? Best to recalculate or ensure consistency

                // 3a. Insert into transaction_items
                $stmt_item = $conn->prepare("INSERT INTO transaction_items (transaction_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)");
                if (!$stmt_item) throw new Exception("Transaction item prepare failed: " . $conn->error);
                $stmt_item->bind_param("iiidd", $transaction_id, $product_id, $quantity_sold, $unit_price, $line_total);
                if (!$stmt_item->execute()) {
                    throw new Exception("Failed to add item (ID: " . $product_id . ") to transaction: " . $stmt_item->error);
                }
                $stmt_item->close();

                // 3b. Update product stock
                $stmt_update_stock = $conn->prepare("UPDATE products SET current_stock = current_stock - ? WHERE product_id = ?");
                if (!$stmt_update_stock) throw new Exception("Update stock prepare failed: " . $conn->error);
                $stmt_update_stock->bind_param("ii", $quantity_sold, $product_id);
                if (!$stmt_update_stock->execute()) {
                    throw new Exception("Failed to update stock for product ID " . $product_id . ": " . $stmt_update_stock->error);
                }
                $stmt_update_stock->close();

                // 3c. Insert into stock_adjustments
                $stock_adjustment_quantity = -$quantity_sold;
                $reason_sale = 'sale';
                $stmt_stock_adj = $conn->prepare("INSERT INTO stock_adjustments (product_id, quantity, reason, reference_id, notes) VALUES (?, ?, ?, ?, ?)");
                if (!$stmt_stock_adj) throw new Exception("Stock adjustment prepare failed: " . $conn->error);
                $adjustment_notes = "Sale via transaction: " . $transaction_ref;
                $stmt_stock_adj->bind_param("iisds", $product_id, $stock_adjustment_quantity, $reason_sale, $transaction_id, $adjustment_notes);
                if (!$stmt_stock_adj->execute()) {
                    throw new Exception("Failed to record stock adjustment for product ID " . $product_id . ": " . $stmt_stock_adj->error);
                }
                $stmt_stock_adj->close();
            }

            $conn->commit();
            http_response_code(201); // Created
            echo json_encode([
                "success" => true,
                "message" => "Transaction completed successfully.",
                "transaction_id" => $transaction_id,
                "transaction_ref" => $transaction_ref
            ]);

        } catch (Exception $e) {
            $conn->rollback();
            http_response_code(400); // Or 500 if it's an internal server error
            echo json_encode(["error" => $e->getMessage()]);
            error_log("POST checkout error: " . $e->getMessage() . " Input: " . json_encode($input));
        }
    } else {
        http_response_code(400);
        echo json_encode(["error" => "Invalid POST action for POS API."]);
    }
} else {
    http_response_code(405); // Method Not Allowed
    echo json_encode(["error" => "Method not allowed for POS API."]);
}

if (isset($conn)) {
    $conn->close();
}
?>