/**
 * API Service for inventory management
 * Handles all API calls to the backend
 */

const API_BASE_URL = 'http://localhost/HARD-POS/backend/api';

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      error: `HTTP error! Status: ${response.status}`
    }));
    throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
  }
  return response.json();
};

const InventoryAPI = {
  // Get all inventory items
  getInventory: async (status = 'active', searchTerm = '', page = 0, limit = 10) => {
    const url = new URL(API_BASE_URL);
    url.searchParams.append('status', status);
    if (searchTerm) url.searchParams.append('search', searchTerm);
    url.searchParams.append('page', page.toString());
    url.searchParams.append('limit', limit.toString());
    
    const response = await fetch(url);
    return handleResponse(response);
  },

  // Add a new inventory item
  addItem: async (itemData) => {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemData),
    });
    return handleResponse(response);
  },

  // Update an existing inventory item
  updateItem: async (id, itemData) => {
    const response = await fetch(`${API_BASE_URL}?id=${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(itemData),
    });
    return handleResponse(response);
  },

  // Remove or restore an inventory item
  changeItemStatus: async (id, action) => {
    const response = await fetch(`${API_BASE_URL}?id=${id}&action=${action}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return handleResponse(response);
  },

  // Adjust stock quantity
  adjustStock: async (adjustmentData) => {
    const response = await fetch(`${API_BASE_URL}?action=adjust_stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product_id: adjustmentData.id,
        amount: adjustmentData.amount,
        adjustmentType: adjustmentData.adjustmentType
      }),
    });
    return handleResponse(response);
  }
};

export default InventoryAPI;