<?php
// Set CORS headers to allow cross-origin requests from your React app
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Content-Type: application/json");

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Check if the request is a POST request for login
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_GET['action']) && $_GET['action'] === 'login') {
    // Get the request body
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Check if username and password are provided
    if (!isset($data['username']) || !isset($data['password'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password are required']);
        exit;
    }
    
    // Fixed credentials - in a real app, you'd validate against a database
    $validUsername = 'cjsupply@admin';
    $validPassword = 'admincjsupply';
    
    // Check credentials
    if ($data['username'] === $validUsername && $data['password'] === $validPassword) {
        // Create a simple user object to return
        $user = [
            'name' => 'Admin User',
            'username' => $validUsername,
            'role' => 'admin'
        ];
        
        // In a real app, you would generate a proper JWT token
        $token = bin2hex(random_bytes(16)); // Simple token generation
        
        // Return success response
        echo json_encode([
            'success' => true,
            'user' => $user,
            'token' => $token
        ]);
    } else {
        // Return error for invalid credentials
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'error' => 'Invalid username or password'
        ]);
    }
    exit;
}

// Default response for other requests
http_response_code(404);
echo json_encode(['error' => 'Endpoint not found']);
?>