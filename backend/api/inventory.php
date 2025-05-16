<?php
require_once 'db_connection.php'; // Includes DB connection, sets headers, handles OPTIONS

// Helper function to get or create category_id
function getOrCreateCategoryId($conn, $categoryName) {
    if (empty($categoryName)) {
        // Or handle as an error, but for now, let's assume a default/unknown category if needed
        // For a robust system, category name should be required.
        // Returning NULL and letting the DB constraint (NOT NULL) on products.category_id catch it might be better.
        // For now, let's assume a valid category name is always passed or handled by frontend validation.
        // If you want to enforce, throw an exception or return an error indicator.
        // For now, let's try to find it. If empty, it will likely fail product insertion if category_id is NOT NULL.
        // Let's return null and allow the calling function to handle the error if category_id is mandatory.
        if (empty(trim($categoryName))) return null;
    }

    $stmt = $conn->prepare("SELECT category_id FROM categories WHERE name = ?");
    if (!$stmt) {
        error_log("Prepare failed (SELECT category_id): " . $conn->error);
        return null;
    }
    $stmt->bind_param("s", $categoryName);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($row = $result->fetch_assoc()) {
        $stmt->close();
        return $row['category_id'];
    } else {
        $stmt->close();
        // Category not found, create it
        $stmt_insert = $conn->prepare("INSERT INTO categories (name) VALUES (?)");
        if (!$stmt_insert) {
            error_log("Prepare failed (INSERT category): " . $conn->error);
            return null;
        }
        $stmt_insert->bind_param("s", $categoryName);
        if ($stmt_insert->execute()) {
            $new_category_id = $stmt_insert->insert_id;
            $stmt_insert->close();
            return $new_category_id;
        } else {
            error_log("Execute failed (INSERT category): " . $stmt_insert->error);
            $stmt_insert->close();
            // Check for unique constraint violation (race condition if two requests try to insert same category)
            if ($conn->errno == 1062) { // Error number for duplicate entry
                 $stmt_retry = $conn->prepare("SELECT category_id FROM categories WHERE name = ?");
                 $stmt_retry->bind_param("s", $categoryName);
                 $stmt_retry->execute();
                 $result_retry = $stmt_retry->get_result();
                 if ($row_retry = $result_retry->fetch_assoc()) {
                    $stmt_retry->close();
                    return $row_retry['category_id'];
                 }
                 $stmt_retry->close();
            }
            return null;
        }
    }
}

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);

// Sanitize input function (basic example)
function sanitize($conn, $data) {
    if (is_array($data)) {
        foreach ($data as $key => $value) {
            $data[$key] = sanitize($conn, $value);
        }
        return $data;
    }
    return $conn->real_escape_string(trim(htmlspecialchars($data)));
}
// Sanitize $_GET and $input if needed. For $input, sanitize specific fields before use.


switch ($method) {
    case 'GET':
        try {
            $status = isset($_GET['status']) ? sanitize($conn, $_GET['status']) : 'active'; // 'active' or 'removed'
            $searchTerm = isset($_GET['search']) ? sanitize($conn, $_GET['search']) : '';
            $page = isset($_GET['page']) ? intval($_GET['page']) : 0; // 0-indexed page
            $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 10; // rowsPerPage
            $offset = $page * $limit;

            $is_active_filter = ($status === 'active') ? 1 : 0;

            $count_sql = "SELECT COUNT(p.product_id) as total
                          FROM products p
                          LEFT JOIN categories c ON p.category_id = c.category_id
                          WHERE p.is_active = ?";
            $params_count = [$is_active_filter];
            $types_count = "i";

            $sql = "SELECT p.product_id, p.name, c.name as category_name, p.current_stock, p.unit, p.price, p.min_stock, p.is_active
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.category_id
                    WHERE p.is_active = ?";
            $params_data = [$is_active_filter];
            $types_data = "i";

            if (!empty($searchTerm)) {
                $search_like = "%" . $searchTerm . "%";
                $count_sql .= " AND (p.name LIKE ? OR c.name LIKE ?)";
                $sql .= " AND (p.name LIKE ? OR c.name LIKE ?)";
                array_push($params_count, $search_like, $search_like);
                array_push($params_data, $search_like, $search_like);
                $types_count .= "ss";
                $types_data .= "ss";
            }

            $sql .= " ORDER BY p.name ASC LIMIT ? OFFSET ?";
            array_push($params_data, $limit, $offset);
            $types_data .= "ii";

            // Get total count
            $stmt_count = $conn->prepare($count_sql);
            if (!$stmt_count) throw new Exception("Count prepare failed: " . $conn->error);
            $stmt_count->bind_param($types_count, ...$params_count);
            $stmt_count->execute();
            $count_result = $stmt_count->get_result()->fetch_assoc();
            $total_items = $count_result['total'];
            $stmt_count->close();

            // Get paginated data
            $stmt_data = $conn->prepare($sql);
            if (!$stmt_data) throw new Exception("Data prepare failed: " . $conn->error);
            $stmt_data->bind_param($types_data, ...$params_data);
            $stmt_data->execute();
            $result_data = $stmt_data->get_result();
            $products = [];
            while ($row = $result_data->fetch_assoc()) {
                $products[] = [
                    'id' => $row['product_id'], // map product_id to id for frontend
                    'name' => $row['name'],
                    'category' => $row['category_name'],
                    'quantity' => $row['current_stock'], // map current_stock to quantity
                    'unit' => $row['unit'],
                    'price' => floatval($row['price']),
                    'minStock' => intval($row['min_stock']),
                    'isRemoved' => !$row['is_active'] // map is_active to isRemoved
                ];
            }
            $stmt_data->close();

            echo json_encode(["products" => $products, "total" => $total_items]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(["error" => "Failed to fetch products: " . $e->getMessage()]);
            error_log("GET products error: " . $e->getMessage());
        }
        break;

    case 'POST':
        if (isset($_GET['action']) && $_GET['action'] == 'adjust_stock') {
            // Adjust stock
            try {
                $product_id = isset($input['product_id']) ? intval($input['product_id']) : null;
                $adjustment_amount = isset($input['amount']) ? intval($input['amount']) : 0;
                $adjustment_type = isset($input['adjustmentType']) ? sanitize($conn, $input['adjustmentType']) : null; // 'add' or 'remove'

                if (!$product_id || $adjustment_amount <= 0 || !$adjustment_type) {
                    throw new Exception("Invalid input for stock adjustment.");
                }

                $conn->begin_transaction();

                $stmt_product = $conn->prepare("SELECT current_stock, name FROM products WHERE product_id = ?");
                if (!$stmt_product) throw new Exception("Prepare failed (SELECT product): " . $conn->error);
                $stmt_product->bind_param("i", $product_id);
                $stmt_product->execute();
                $product_result = $stmt_product->get_result();
                if (!($product_data = $product_result->fetch_assoc())) {
                    $stmt_product->close();
                    throw new Exception("Product not found.");
                }
                $current_stock_val = $product_data['current_stock'];
                $product_name = $product_data['name'];
                $stmt_product->close();

                $stock_change_quantity = 0;
                $reason = 'correction'; // Default reason for manual adjustment

                if ($adjustment_type === 'add') {
                    $new_stock = $current_stock_val + $adjustment_amount;
                    $stock_change_quantity = $adjustment_amount;
                     // Optionally, you could allow a specific reason from frontend, e.g. 'purchase'
                } elseif ($adjustment_type === 'remove') {
                    if ($current_stock_val - $adjustment_amount < 0) {
                        throw new Exception("Cannot reduce stock for " . $product_name . " below 0.");
                    }
                    $new_stock = $current_stock_val - $adjustment_amount;
                    $stock_change_quantity = -$adjustment_amount;
                    // Optionally, 'damaged' or other reasons
                } else {
                    throw new Exception("Invalid adjustment type.");
                }

                $stmt_update = $conn->prepare("UPDATE products SET current_stock = ? WHERE product_id = ?");
                if (!$stmt_update) throw new Exception("Prepare failed (UPDATE products): " . $conn->error);
                $stmt_update->bind_param("ii", $new_stock, $product_id);
                if (!$stmt_update->execute()) {
                    throw new Exception("Failed to update product stock: " . $stmt_update->error);
                }
                $stmt_update->close();

                $stmt_adj = $conn->prepare("INSERT INTO stock_adjustments (product_id, quantity, reason, notes) VALUES (?, ?, ?, ?)");
                if (!$stmt_adj) throw new Exception("Prepare failed (INSERT stock_adjustments): " . $conn->error);
                $notes = "Manual stock adjustment: " . $adjustment_type . " " . abs($adjustment_amount);
                $stmt_adj->bind_param("iiss", $product_id, $stock_change_quantity, $reason, $notes);
                if (!$stmt_adj->execute()) {
                    throw new Exception("Failed to record stock adjustment: " . $stmt_adj->error);
                }
                $stmt_adj->close();

                $conn->commit();
                echo json_encode([
                    "success" => true,
                    "message" => "Stock for product ID " . $product_id . " adjusted.",
                    "new_quantity" => $new_stock
                ]);

            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(400); // Bad Request or 500 Internal Server Error
                echo json_encode(["error" => $e->getMessage()]);
                error_log("POST adjust_stock error: " . $e->getMessage());
            }

        } else {
            // Add new product
            try {
                $name = isset($input['name']) ? sanitize($conn, $input['name']) : null;
                $category_name = isset($input['category']) ? sanitize($conn, $input['category']) : null;
                $quantity = isset($input['quantity']) ? intval($input['quantity']) : 0;
                $unit = isset($input['unit']) ? sanitize($conn, $input['unit']) : null;
                $price = isset($input['price']) ? floatval($input['price']) : 0.0;
                $min_stock = isset($input['minStock']) ? intval($input['minStock']) : 0;

                if (empty($name) || empty($category_name) || empty($unit) || $price < 0 || $quantity < 0 || $min_stock < 0) {
                     throw new Exception("Invalid product data. All fields are required and must be valid.");
                }

                $category_id = getOrCreateCategoryId($conn, $category_name);
                if ($category_id === null) {
                    throw new Exception("Failed to get or create category ID for: " . $category_name);
                }

                $conn->begin_transaction();

                $stmt_insert_product = $conn->prepare("INSERT INTO products (name, category_id, price, unit, min_stock, current_stock, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)");
                if (!$stmt_insert_product) throw new Exception("Prepare failed (INSERT product): " . $conn->error);
                $stmt_insert_product->bind_param("ssdssi", $name, $category_id, $price, $unit, $min_stock, $quantity);

                if ($stmt_insert_product->execute()) {
                    $product_id = $stmt_insert_product->insert_id;
                    $stmt_insert_product->close();

                    // Add initial stock adjustment
                    if ($quantity > 0) {
                        $reason_initial = 'initial';
                        $notes_initial = 'Initial stock for new product.';
                        $stmt_adj_initial = $conn->prepare("INSERT INTO stock_adjustments (product_id, quantity, reason, notes) VALUES (?, ?, ?, ?)");
                        if (!$stmt_adj_initial) throw new Exception("Prepare failed (INSERT initial stock_adjustment): " . $conn->error);
                        $stmt_adj_initial->bind_param("iiss", $product_id, $quantity, $reason_initial, $notes_initial);
                        if (!$stmt_adj_initial->execute()) {
                             throw new Exception("Failed to record initial stock adjustment: " . $stmt_adj_initial->error);
                        }
                        $stmt_adj_initial->close();
                    }

                    $conn->commit();
                    http_response_code(201); // Created
                    echo json_encode([
                        "id" => $product_id,
                        "name" => $name,
                        "category" => $category_name,
                        "quantity" => $quantity,
                        "unit" => $unit,
                        "price" => $price,
                        "minStock" => $min_stock,
                        "isRemoved" => false
                    ]);
                } else {
                    throw new Exception("Failed to add product: " . $stmt_insert_product->error);
                }
            } catch (Exception $e) {
                $conn->rollback();
                http_response_code(400); // Bad Request
                echo json_encode(["error" => $e->getMessage()]);
                error_log("POST add product error: " . $e->getMessage());
            }
        }
        break;

    case 'PUT':
        // Update product
        try {
            $product_id = isset($_GET['id']) ? intval($_GET['id']) : null;
            if (!$product_id) {
                throw new Exception("Product ID is required for update.");
            }

            $name = isset($input['name']) ? sanitize($conn, $input['name']) : null;
            $category_name = isset($input['category']) ? sanitize($conn, $input['category']) : null;
            // Quantity (current_stock) is usually updated via stock adjustments, but if the form allows direct edit:
            $quantity = isset($input['quantity']) ? intval($input['quantity']) : null; // Be cautious allowing direct current_stock edit here
            $unit = isset($input['unit']) ? sanitize($conn, $input['unit']) : null;
            $price = isset($input['price']) ? floatval($input['price']) : null;
            $min_stock = isset($input['minStock']) ? intval($input['minStock']) : null;


            if (empty($name) || empty($category_name) || empty($unit) || $price === null || $price < 0 || $min_stock === null || $min_stock < 0 || $quantity === null || $quantity < 0) {
                 throw new Exception("Invalid product data for update. All fields are required.");
            }

            $category_id = getOrCreateCategoryId($conn, $category_name);
            if ($category_id === null) {
                throw new Exception("Failed to get or create category ID for update.");
            }

            // If quantity is part of the update form, decide how to handle stock_adjustments.
            // For simplicity, this example updates current_stock directly.
            // A more robust system might require stock changes through the adjustment dialog.
            // If you allow direct quantity edit, you might want to log a 'correction' in stock_adjustments.
            // For now, let's assume the frontend sends the *new* quantity.
            // We will log a 'correction' if the quantity changes.

            $conn->begin_transaction();

            // Get current stock to see if it changed, to log an adjustment
            $stmt_old_stock = $conn->prepare("SELECT current_stock FROM products WHERE product_id = ?");
            if (!$stmt_old_stock) throw new Exception("Prepare failed (SELECT old stock): " . $conn->error);
            $stmt_old_stock->bind_param("i", $product_id);
            $stmt_old_stock->execute();
            $old_stock_result = $stmt_old_stock->get_result();
            $old_product_data = $old_stock_result->fetch_assoc();
            $stmt_old_stock->close();

            if (!$old_product_data) {
                throw new Exception("Product not found for update.");
            }
            $old_quantity = $old_product_data['current_stock'];


            $stmt_update = $conn->prepare("UPDATE products SET name = ?, category_id = ?, price = ?, unit = ?, min_stock = ?, current_stock = ? WHERE product_id = ?");
            if (!$stmt_update) throw new Exception("Prepare failed (UPDATE product): " . $conn->error);
            $stmt_update->bind_param("ssdssii", $name, $category_id, $price, $unit, $min_stock, $quantity, $product_id);

            if ($stmt_update->execute()) {
                $stmt_update->close();

                // Log stock adjustment if quantity changed
                if ($quantity != $old_quantity) {
                    $stock_diff = $quantity - $old_quantity;
                    $reason_correction = 'correction';
                    $notes_correction = 'Product details updated, stock value changed.';
                    $stmt_adj_corr = $conn->prepare("INSERT INTO stock_adjustments (product_id, quantity, reason, notes) VALUES (?, ?, ?, ?)");
                    if (!$stmt_adj_corr) throw new Exception("Prepare failed (INSERT stock_adjustment for update): " . $conn->error);
                    $stmt_adj_corr->bind_param("iiss", $product_id, $stock_diff, $reason_correction, $notes_correction);
                    if (!$stmt_adj_corr->execute()) {
                         throw new Exception("Failed to record stock adjustment for update: " . $stmt_adj_corr->error);
                    }
                    $stmt_adj_corr->close();
                }

                $conn->commit();
                echo json_encode([
                    "id" => $product_id,
                    "name" => $name,
                    "category" => $category_name,
                    "quantity" => $quantity,
                    "unit" => $unit,
                    "price" => $price,
                    "minStock" => $min_stock,
                    "isRemoved" => false // Assuming update keeps it active unless specifically handled
                ]);
            } else {
                throw new Exception("Failed to update product: " . $stmt_update->error);
            }
        } catch (Exception $e) {
            $conn->rollback();
            http_response_code(400); // Bad Request
            echo json_encode(["error" => $e->getMessage()]);
            error_log("PUT update product error: " . $e->getMessage());
        }
        break;

    case 'PATCH':
        // Soft delete/restore product
        try {
            $product_id = isset($_GET['id']) ? intval($_GET['id']) : null;
            $action = isset($_GET['action']) ? sanitize($conn, $_GET['action']) : null; // 'remove' or 'restore'

            if (!$product_id || !in_array($action, ['remove', 'restore'])) {
                throw new Exception("Product ID and valid action (remove/restore) are required.");
            }

            $is_active = ($action === 'restore') ? 1 : 0;

            $stmt = $conn->prepare("UPDATE products SET is_active = ? WHERE product_id = ?");
            if (!$stmt) throw new Exception("Prepare failed (PATCH product): " . $conn->error);
            $stmt->bind_param("ii", $is_active, $product_id);

            if ($stmt->execute()) {
                if ($stmt->affected_rows > 0) {
                    echo json_encode(["success" => true, "message" => "Product " . ($action === 'restore' ? "restored." : "removed.")]);
                } else {
                    throw new Exception("Product not found or no change made.");
                }
            } else {
                throw new Exception("Failed to " . $action . " product: " . $stmt->error);
            }
            $stmt->close();
        } catch (Exception $e) {
            http_response_code(400); // Bad Request
            echo json_encode(["error" => $e->getMessage()]);
            error_log("PATCH product error: " . $e->getMessage());
        }
        break;

    default:
        http_response_code(405); // Method Not Allowed
        echo json_encode(["error" => "Method not allowed"]);
        break;
}

if (isset($conn)) { // Check if $conn was initialized (it should be from db_connection.php)
    $conn->close();
}
?>