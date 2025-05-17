<?php
// db_connection.php - Database connection configuration

$host = "localhost";
$username = "root";
$password = "";
$database = "hardware_pos";

// Create connection
$conn = new mysqli($host, $username, $password, $database);

// Check connection
if ($conn->connect_error) {
    die(json_encode(["error" => "Connection failed: " . $conn->connect_error]));
}

// Note: CORS headers are now handled by cors_handler.php
?>