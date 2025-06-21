import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "./firebase";
import { signOut } from "firebase/auth";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  doc as firestoreDoc,
  getDocs,
  where
} from "firebase/firestore";

function SendForDeliveryModal({ item, onClose, onSend }) {
  const [agent, setAgent] = useState("");
  const [qty, setQty] = useState(1);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [error, setError] = useState("");
  const [agents, setAgents] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Fetch delivery agents from Firestore
    const fetchAgents = async () => {
      try {
        console.log("Fetching delivery agents...");
      const q = query(collection(db, "users"));
      const unsub = onSnapshot(q, (snap) => {
        const agentList = snap.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user => user.role === "DLTeam" && user.email);
        console.log("Found delivery agents:", agentList);
        setAgents(agentList);
        }, (error) => {
          console.error("Error fetching agents:", error);
          setError("Failed to load delivery agents");
      });
      return unsub;
      } catch (err) {
        console.error("Error setting up agents listener:", err);
        setError("Failed to load delivery agents");
      }
    };
    fetchAgents();
  }, []);

  const handleSubmit = async () => {
    if (!agent) return setError("Agent required");
    if (qty < 1 || qty > item.quantity) return setError("Invalid quantity");
    if (!deliveryDate) return setError("Delivery date required");
    
    setError("");
    setIsSubmitting(true);
    
    try {
      await onSend(agent, qty, deliveryDate);
    } catch (err) {
      setError("Failed to create delivery. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h3 className="text-xl font-bold text-primary">Send for Delivery</h3>
        </div>
        <div className="modal-body">
          <div className="mb-4">
            <span className="text-gray-600">SKU: </span>
            <span className="font-semibold">{item.sku}</span>
          </div>
          
          <div className="form-group">
            <label className="form-label">Delivery Agent</label>
        <select
              className="form-select"
          value={agent}
          onChange={e => setAgent(e.target.value)}
              disabled={isSubmitting}
          required
        >
          <option value="">Select Delivery Agent (Email)</option>
              {agents.length > 0 ? (
                agents.map(a => (
            <option key={a.id} value={a.email}>{a.email}</option>
                ))
              ) : (
                <option value="" disabled>No delivery agents found</option>
              )}
        </select>
            {agents.length === 0 && (
              <div className="text-sm text-warning mt-1">
                ⚠️ No delivery agents found. Please ensure delivery agents are registered with "DLTeam" role.
              </div>
            )}
          </div>
          
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input 
              className="form-input" 
              type="number" 
              min={1} 
              max={item.quantity} 
              placeholder="Quantity" 
              value={qty} 
              onChange={e => setQty(Number(e.target.value))} 
              disabled={isSubmitting}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Delivery Date</label>
            <input 
              className="form-input" 
              type="date" 
              value={deliveryDate} 
              onChange={e => setDeliveryDate(e.target.value)} 
              disabled={isSubmitting}
              required 
            />
          </div>
          
          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button 
            className="btn btn-ghost" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                <span className="ml-2">Creating...</span>
              </>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function InventoryDashboard() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataFetched, setDataFetched] = useState(false);
  const [form, setForm] = useState({
    sku: "",
    category: "",
    quantity: 1,
    perishable: false,
    expiry: "",
    damaged: false
  });
  const [filter, setFilter] = useState({
    category: "",
    perishable: "",
    damaged: "",
    expiry: ""
  });
  const [editId, setEditId] = useState(null);
  const [toast, setToast] = useState("");
  const [deliveryModal, setDeliveryModal] = useState({ open: false, item: null });
  const [itemsWithDeliveries, setItemsWithDeliveries] = useState(new Set());
  const [csvUploadModal, setCsvUploadModal] = useState({ open: false, data: null, preview: [] });
  const [uploadLoading, setUploadLoading] = useState(false);
  const navigate = useNavigate();

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const showSyncToast = (msg, type = "success") => {
    const toastClass = type === "success" ? "alert-success" : "alert-warning";
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ 
      ...f, 
      [name]: type === "checkbox" ? checked : 
              type === "number" ? (value === "" ? "" : Number(value)) : 
              value 
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const trimmedSku = form.sku.trim();
    const trimmedCategory = form.category.trim();
    
    // Validate all required fields
    if (!trimmedSku || !trimmedCategory || !form.quantity || isNaN(form.quantity) || Number(form.quantity) < 1) {
      showToast("Please fill all required fields: SKU, Category, and Quantity (minimum 1)");
      return;
    }
    
    try {
      const itemData = {
        ...form,
        sku: trimmedSku,
        category: trimmedCategory,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      if (editId) {
        await updateDoc(firestoreDoc(db, "inventory", editId), { 
          ...itemData,
          updatedAt: new Date().toISOString()
        });
        showToast("Item updated");
        setEditId(null);
      } else {
        await addDoc(collection(db, "inventory"), itemData);
        showToast("Item added");
      }
      setForm({
        sku: "", category: "", quantity: 1,
        perishable: false, expiry: "", damaged: false
      });
    } catch (err) {
      showToast("Error: " + err.message);
    }
  };

  const handleEdit = item => {
    setForm({
      sku: item.sku || "",
      category: item.category || "",
      quantity: item.quantity || 1,
      perishable: item.perishable || false,
      expiry: item.expiry || "",
      damaged: item.damaged || false
    });
    setEditId(item.id);
  };

  const handleDelete = async id => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
    await deleteDoc(firestoreDoc(db, "inventory", id));
    showToast("Item deleted");
      } catch (err) {
        showToast("Error: " + err.message);
      }
    }
  };

  const handleTogglePerishable = async (item) => {
    try {
      const newPerishable = !item.perishable;
      await updateDoc(firestoreDoc(db, "inventory", item.id), {
        perishable: newPerishable,
        updatedAt: new Date().toISOString()
      });
      
      // Update related deliveries
      const deliveriesQuery = query(collection(db, "deliveries"));
      const deliveriesSnapshot = await getDocs(deliveriesQuery);
      const updatePromises = [];
      
      deliveriesSnapshot.docs.forEach(doc => {
        const delivery = doc.data();
        if (delivery.sku === item.sku) {
          updatePromises.push(updateDoc(doc.ref, {
            perishable: newPerishable,
            type: newPerishable ? "perishable" : 
                  delivery.damaged ? "damaged" : "normal"
          }));
        }
      });
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        showSyncToast(`Updated ${updatePromises.length} related deliveries`);
      }
      
      showToast(`Item marked as ${newPerishable ? 'perishable' : 'non-perishable'}`);
    } catch (err) {
      showToast("Error: " + err.message);
    }
  };

  const handleToggleDamaged = async (item) => {
    try {
      const newDamaged = !item.damaged;
      await updateDoc(firestoreDoc(db, "inventory", item.id), {
        damaged: newDamaged,
        updatedAt: new Date().toISOString()
      });
      
      // Update related deliveries
      const deliveriesQuery = query(collection(db, "deliveries"));
      const deliveriesSnapshot = await getDocs(deliveriesQuery);
      const updatePromises = [];
      
      deliveriesSnapshot.docs.forEach(doc => {
        const delivery = doc.data();
        if (delivery.sku === item.sku) {
          updatePromises.push(updateDoc(doc.ref, {
            damaged: newDamaged,
            type: newDamaged ? "damaged" : 
                  delivery.perishable ? "perishable" : "normal"
          }));
        }
      });
      
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        showSyncToast(`Updated ${updatePromises.length} related deliveries`);
      }
      
      showToast(`Item marked as ${newDamaged ? 'damaged' : 'not damaged'}`);
    } catch (err) {
      showToast("Error: " + err.message);
    }
  };

  const handleLogout = async () => {
    try {
    await signOut(auth);
    navigate("/");
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const handleFetchInventory = () => {
    setLoading(true);
    setDataFetched(true);
    // Use a more robust query that doesn't fail if some items don't have createdAt
    const q = query(collection(db, "inventory"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        // Ensure all required fields exist and are properly typed
        return {
          id: doc.id,
          sku: data.sku || "",
          category: data.category || "",
          quantity: typeof data.quantity === 'number' ? data.quantity : 0,
          perishable: Boolean(data.perishable),
          damaged: Boolean(data.damaged),
          expiry: data.expiry || "",
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString()
        };
      });
      // Sort by createdAt in JavaScript to handle missing dates
      docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      console.log("Fetched items:", docs);
      setItems(docs);
      setLoading(false);
      
      // Check for related deliveries
      checkRelatedDeliveries(docs);
    });
    return () => unsub();
  };

  const checkRelatedDeliveries = async (inventoryItems) => {
    try {
      const deliveriesQuery = query(collection(db, "deliveries"));
      const deliveriesSnapshot = await getDocs(deliveriesQuery);
      const deliverySkus = new Set();
      
      deliveriesSnapshot.docs.forEach(doc => {
        const delivery = doc.data();
        if (delivery.sku) {
          deliverySkus.add(delivery.sku);
        }
      });
      
      setItemsWithDeliveries(deliverySkus);
    } catch (err) {
      console.error("Error checking related deliveries:", err);
    }
  };

  const handleSendForDelivery = async (item, agent, qty, deliveryDate) => {
    console.log("Starting delivery process:", { item, agent, qty, deliveryDate });
    
    try {
      // Validate inputs
      if (!item || !agent || !qty || !deliveryDate) {
        showToast("Error: All fields are required");
        return;
      }

      if (qty <= 0 || qty > item.quantity) {
        showToast("Error: Invalid quantity");
        return;
      }

      console.log("Creating delivery record...");
      
    // Create delivery record
      const deliveryData = {
      sku: item.sku,
        name: item.category,
      agent,
      quantity: qty,
        deliveryDate,
      status: "pending",
        createdAt: new Date().toISOString(),
        perishable: item.perishable,
        damaged: item.damaged,
        // Set type based on perishable/damaged status for consistency
        type: item.perishable ? "perishable" : 
              item.damaged ? "damaged" : "normal"
      };

      const deliveryRef = await addDoc(collection(db, "deliveries"), deliveryData);
      console.log("Delivery created with ID:", deliveryRef.id);
      
      console.log("Removing item from inventory...");
      
      // Always remove the item from inventory when sending for delivery
      await deleteDoc(firestoreDoc(db, "inventory", item.id));
      
      console.log("Item removed from inventory");
      
      showToast(`Delivery created successfully! ${qty} units sent to ${agent}`);
    setDeliveryModal({ open: false, item: null });
      
      // Force refresh to ensure UI updates
      setTimeout(() => {
        console.log("Refreshing inventory...");
        handleFetchInventory();
      }, 500);
    } catch (err) {
      console.error("Error creating delivery:", err);
      showToast("Error: " + err.message);
    }
  };

  // Enhanced filter/search functionality
  const filteredItems = items.filter(item => {
    // Safety check: ensure item is a valid object with required properties
    if (!item || typeof item !== 'object' || !item.id) {
      console.warn("Invalid item found:", item);
      return false;
    }
    
    // Search functionality - search in SKU and category
    const searchTerm = filter.category?.toLowerCase() || "";
    const skuMatch = !searchTerm || (item.sku && item.sku.toLowerCase().includes(searchTerm));
    const categoryMatch = !searchTerm || (item.category && item.category.toLowerCase().includes(searchTerm));
    const searchMatch = skuMatch || categoryMatch;
    
    // Filter by perishable status
    const perishableMatch = filter.perishable === "" || 
                           (filter.perishable === "true" && Boolean(item.perishable)) ||
                           (filter.perishable === "false" && !Boolean(item.perishable));
    
    // Filter by damaged status
    const damagedMatch = filter.damaged === "" || 
                        (filter.damaged === "true" && Boolean(item.damaged)) ||
                        (filter.damaged === "false" && !Boolean(item.damaged));
    
    // Filter by expiry date
    const expiryMatch = !filter.expiry || 
                       (item.expiry && new Date(item.expiry) <= new Date(filter.expiry));
    
    return searchMatch && perishableMatch && damagedMatch && expiryMatch;
  });

  useEffect(() => {
    if (!dataFetched) {
      handleFetchInventory();
    }
  }, [dataFetched]);

  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      showToast("Please select a valid CSV file", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target.result;
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        
        // Show available columns for debugging
        console.log("Available columns:", headers);
        
        // Map possible column variations to standard names
        const columnMapping = {
          // SKU variations
          'sku': 'sku',
          'stock keeping unit': 'sku',
          'product code': 'sku',
          'item code': 'sku',
          'product id': 'sku',
          'item id': 'sku',
          
          // Category variations
          'category': 'category',
          'name': 'category',
          'product name': 'category',
          'item name': 'category',
          'description': 'category',
          'type': 'category',
          
          // Quantity variations
          'quantity': 'quantity',
          'qty': 'quantity',
          'amount': 'quantity',
          'stock': 'quantity',
          'inventory': 'quantity',
          'count': 'quantity',
          
          // Perishable variations
          'perishable': 'perishable',
          'perish': 'perishable',
          'expires': 'perishable',
          'fresh': 'perishable',
          'shelf life': 'perishable',
          
          // Damaged variations
          'damaged': 'damaged',
          'damage': 'damaged',
          'defective': 'damaged',
          'broken': 'damaged',
          'faulty': 'damaged',
          
          // Expiry variations
          'expiry': 'expiry',
          'expiry date': 'expiry',
          'expiration': 'expiry',
          'expiration date': 'expiry',
          'best before': 'expiry',
          'use by': 'expiry',
          'date': 'expiry'
        };

        // Map headers to standard names
        const mappedHeaders = headers.map(header => {
          const cleanHeader = header.replace(/[^a-zA-Z0-9\s]/g, '').trim().toLowerCase();
          return columnMapping[cleanHeader] || header;
        });

        console.log("Mapped headers:", mappedHeaders);

        const data = [];
        for (let i = 1; i < lines.length; i++) {
          if (lines[i].trim()) {
            const values = lines[i].split(',').map(v => v.trim().replace(/^["']|["']$/g, '')); // Remove quotes
            const row = {};
            
            // Create row object with mapped headers
            headers.forEach((header, index) => {
              const mappedHeader = mappedHeaders[index];
              row[mappedHeader] = values[index] || '';
            });
            
            // Validate and process the row
            if (row.sku && row.category && row.quantity !== undefined) {
              const processedRow = {
                sku: row.sku.toString().trim(),
                category: row.category.toString().trim(),
                quantity: parseInt(row.quantity) || 0,
                perishable: parseBoolean(row.perishable),
                damaged: parseBoolean(row.damaged),
                expiry: row.expiry ? row.expiry.toString().trim() : ''
              };
              
              // Only add if quantity is valid
              if (processedRow.quantity > 0) {
                data.push(processedRow);
              }
            }
          }
        }

        if (data.length === 0) {
          showToast("No valid data found in CSV file. Please check the format.", "error");
          return;
        }

        setCsvUploadModal({ 
          open: true, 
          data: data, 
          preview: data.slice(0, 5) // Show first 5 rows as preview
        });
        
        showToast(`CSV parsed successfully! Found ${data.length} valid items.`, "success");
      } catch (error) {
        console.error("CSV parsing error:", error);
        showToast("Error processing CSV file: " + error.message, "error");
      }
    };
    reader.readAsText(file);
  };

  // Helper function to parse boolean values
  const parseBoolean = (value) => {
    if (!value) return false;
    const str = value.toString().toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'yes' || str === 'y' || str === 'on';
  };

  const handleCsvImport = async () => {
    if (!csvUploadModal.data) return;
    
    setUploadLoading(true);
    try {
      let updatedCount = 0;
      let addedCount = 0;
      let errorCount = 0;

      for (const item of csvUploadModal.data) {
        try {
          // Check if item exists by SKU
          const existingQuery = query(collection(db, "inventory"), where("sku", "==", item.sku));
          const existingSnapshot = await getDocs(existingQuery);
          
          if (!existingSnapshot.empty) {
            // Update existing item
            const existingDoc = existingSnapshot.docs[0];
            await updateDoc(existingDoc.ref, {
              ...item,
              updatedAt: new Date().toISOString()
            });
            updatedCount++;
          } else {
            // Add new item
            await addDoc(collection(db, "inventory"), {
              ...item,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            addedCount++;
          }
        } catch (error) {
          console.error(`Error processing item ${item.sku}:`, error);
          errorCount++;
        }
      }

      setCsvUploadModal({ open: false, data: null, preview: [] });
      
      if (errorCount > 0) {
        showToast(`Import completed with ${errorCount} errors. ${updatedCount} updated, ${addedCount} added.`, "warning");
      } else {
        showToast(`Import successful! ${updatedCount} items updated, ${addedCount} items added.`, "success");
      }
    } catch (error) {
      showToast("Error during import: " + error.message, "error");
    } finally {
      setUploadLoading(false);
    }
  };

  const downloadCsvTemplate = () => {
    const template = `sku,category,quantity,perishable,damaged,expiry
SKU001,Electronics,50,false,false,2024-12-31
SKU002,Fresh Produce,25,true,false,2024-01-15
SKU003,Clothing,100,false,false,
SKU004,Food Items,30,true,false,2024-02-28
SKU005,Electronics,15,false,true,2024-06-30

# Alternative column names that work:
# SKU: sku, stock keeping unit, product code, item code, product id, item id
# Category: category, name, product name, item name, description, type
# Quantity: quantity, qty, amount, stock, inventory, count
# Perishable: perishable, perish, expires, fresh, shelf life
# Damaged: damaged, damage, defective, broken, faulty
# Expiry: expiry, expiry date, expiration, expiration date, best before, use by, date`;
    
    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="page-wrapper">
      {/* Navigation */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">📦 Inventory Dashboard</div>
          <div className="navbar-actions">
            <button 
              className="btn btn-outline btn-sm" 
              onClick={handleFetchInventory}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="loading" style={{ width: '14px', height: '14px' }}></div>
                  <span className="ml-2">Loading...</span>
                </>
              ) : (
                <>
                  🔄 Refresh
                </>
              )}
            </button>
            <label className="btn btn-outline btn-sm cursor-pointer">
              📁 Import CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                style={{ display: 'none' }}
              />
            </label>
            <button className="btn btn-outline btn-sm" onClick={() => navigate("/deliveries")}>
              View Deliveries
            </button>
            <button className="btn btn-danger btn-sm" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: '100px' }}>
        {/* Toast Notification */}
      {toast && (
          <div className="alert alert-success mb-6">
          {toast}
        </div>
      )}

        {/* Add/Edit Item Form */}
        <div className="card mb-8">
          <div className="card-header">
            <h2 className="text-2xl font-bold text-primary">
              {editId ? "Edit Item" : "Add New Item"}
            </h2>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <input
                    className="form-input"
                    type="text"
                    name="sku"
                    value={form.sku}
                    onChange={handleChange}
                    placeholder="Enter SKU"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <input
                    className="form-input"
                    type="text"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    placeholder="Enter category"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input
                    className="form-input"
                    type="number"
                    name="quantity"
                    value={form.quantity}
                    onChange={handleChange}
                    min="1"
                    placeholder="Enter quantity"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Expiry Date</label>
                  <input
                    className="form-input"
                    type="date"
                    name="expiry"
                    value={form.expiry}
                    onChange={handleChange}
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="perishable"
                    checked={form.perishable}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-sm">Perishable</span>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="damaged"
                    checked={form.damaged}
                    onChange={handleChange}
                    className="mr-2"
                  />
                  <span className="text-sm">Damaged</span>
          </label>
              </div>
              
              <div className="flex gap-3">
                <button type="submit" className="btn btn-primary">
                  {editId ? "Update Item" : "Add Item"}
                </button>
          {editId && (
            <button
              type="button"
                    className="btn btn-ghost"
              onClick={() => {
                setEditId(null);
                      setForm({
                        sku: "", category: "", quantity: 1,
                        perishable: false, expiry: "", damaged: false
                      });
                    }}
                  >
                    Cancel Edit
            </button>
          )}
              </div>
        </form>
      </div>
        </div>

        {/* Filters */}
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="text-xl font-semibold text-gray-800">Search & Filters</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="form-group">
                <label className="form-label">Search (SKU or Category)</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Search by SKU or category..."
                  value={filter.category}
                  onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Perishable</label>
                <select
                  className="form-select"
                  value={filter.perishable}
                  onChange={e => setFilter(f => ({ ...f, perishable: e.target.value }))}
                >
            <option value="">All</option>
            <option value="true">Perishable</option>
                  <option value="false">Non-perishable</option>
          </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Damaged</label>
                <select
                  className="form-select"
                  value={filter.damaged}
                  onChange={e => setFilter(f => ({ ...f, damaged: e.target.value }))}
                >
            <option value="">All</option>
            <option value="true">Damaged</option>
                  <option value="false">Not damaged</option>
          </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Expiry Before</label>
                <input
                  className="form-input"
                  type="date"
                  value={filter.expiry}
                  onChange={e => setFilter(f => ({ ...f, expiry: e.target.value }))}
                />
              </div>
            </div>
            
            {/* Clear Filters Button */}
            <div className="mt-4 flex justify-end">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setFilter({
                  category: "",
                  perishable: "",
                  damaged: "",
                  expiry: ""
                })}
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>

        {/* Inventory Table */}
        <div className="card">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-semibold text-gray-800">Inventory Items</h3>
              <div className="text-sm text-gray-600">
                Showing {filteredItems.length} of {items.length} items
                {filteredItems.length !== items.length && (
                  <span className="ml-2 text-primary">(filtered)</span>
                )}
              </div>
            </div>
          </div>
          <div className="card-body">
        {loading ? (
              <div className="loading-container">
                <div className="loading"></div>
                <span className="ml-3">Loading inventory...</span>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">📦</div>
                <p className="text-lg">No items in inventory yet.</p>
                <p className="text-sm">Add your first item using the form above.</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-lg">No items match your search criteria.</p>
                <p className="text-sm">Try adjusting your filters or search terms.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
              <thead>
                    <tr>
                  <th>SKU</th>
                  <th>Category</th>
                      <th>Quantity</th>
                  <th>Perishable</th>
                  <th>Expiry</th>
                  <th>Damaged</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                    {filteredItems.map(item => {
                      // Additional safety check before rendering
                      if (!item || typeof item !== 'object') {
                        console.warn("Invalid item in render:", item);
                        return null;
                      }
                      
                      return (
                        <tr key={item.id}>
                          <td className="font-mono font-medium">
                            {item.sku || ""}
                            {itemsWithDeliveries.has(item.sku) && (
                              <span 
                                className="ml-2 text-xs text-primary cursor-help" 
                                title="This item has related deliveries - status changes will sync automatically"
                              >
                                🔄
                              </span>
                            )}
                          </td>
                          <td>{item.category || ""}</td>
                          <td>
                            <span className={`font-semibold ${(item.quantity || 0) < 10 ? 'text-danger' : (item.quantity || 0) < 50 ? 'text-warning' : 'text-success'}`}>
                              {item.quantity || 0}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => handleTogglePerishable(item)}
                              className={`badge cursor-pointer ${Boolean(item.perishable) ? 'badge-warning' : 'badge-outline'}`}
                              title={`Click to mark as ${Boolean(item.perishable) ? 'non-perishable' : 'perishable'}${itemsWithDeliveries.has(item.sku) ? ' (will sync with deliveries)' : ''}`}
                            >
                              {Boolean(item.perishable) ? "Yes" : "No"}
                            </button>
                          </td>
                          <td>
                            {item.expiry ? (
                              <span className={new Date(item.expiry) <= new Date() ? 'text-danger font-semibold' : ''}>
                                {new Date(item.expiry).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td>
                            <button
                              onClick={() => handleToggleDamaged(item)}
                              className={`badge cursor-pointer ${Boolean(item.damaged) ? 'badge-danger' : 'badge-outline'}`}
                              title={`Click to mark as ${Boolean(item.damaged) ? 'not damaged' : 'damaged'}${itemsWithDeliveries.has(item.sku) ? ' (will sync with deliveries)' : ''}`}
                            >
                              {Boolean(item.damaged) ? "Yes" : "No"}
                            </button>
                          </td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-sm btn-outline"
                                onClick={() => handleEdit(item)}
                              >
                                Edit
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => setDeliveryModal({ open: true, item })}
                                disabled={(item.quantity || 0) <= 0}
                              >
                                Send
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDelete(item.id)}
                              >
                                Delete
                              </button>
                            </div>
                    </td>
                  </tr>
                      );
                    })}
              </tbody>
            </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delivery Modal */}
      {deliveryModal.open && (
        <SendForDeliveryModal
          item={deliveryModal.item}
          onClose={() => setDeliveryModal({ open: false, item: null })}
          onSend={(agent, qty, deliveryDate) => handleSendForDelivery(deliveryModal.item, agent, qty, deliveryDate)}
        />
      )}

      {/* CSV Upload Modal */}
      {csvUploadModal.open && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3 className="text-xl font-bold text-primary">📁 Import CSV Data</h3>
              <button 
                className="btn btn-outline btn-sm" 
                onClick={downloadCsvTemplate}
                type="button"
              >
                📥 Download Template
              </button>
            </div>
            <div className="modal-body">
              <div className="mb-4">
                <p className="text-gray-600 mb-2">
                  Preview of data to be imported ({csvUploadModal.data?.length || 0} items):
                </p>
                <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Category</th>
                        <th>Quantity</th>
                        <th>Perishable</th>
                        <th>Damaged</th>
                        <th>Expiry</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvUploadModal.preview.map((item, index) => (
                        <tr key={index}>
                          <td className="font-mono text-sm">{item.sku}</td>
                          <td className="text-sm">{item.category}</td>
                          <td className="text-sm font-semibold">{item.quantity}</td>
                          <td>
                            <span className={`badge badge-sm ${item.perishable ? 'badge-warning' : 'badge-outline'}`}>
                              {item.perishable ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td>
                            <span className={`badge badge-sm ${item.damaged ? 'badge-danger' : 'badge-outline'}`}>
                              {item.damaged ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="text-sm">{item.expiry || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvUploadModal.data && csvUploadModal.data.length > 5 && (
                    <p className="text-sm text-gray-500 mt-2">
                      ... and {csvUploadModal.data.length - 5} more items
                    </p>
                  )}
                </div>
              </div>
              
              <div className="alert alert-info">
                <div className="text-sm">
                  <strong>Note:</strong> 
                  <ul className="mt-1 ml-4">
                    <li>• Items with existing SKUs will be updated</li>
                    <li>• New SKUs will be added as new items</li>
                    <li>• You can then manually send items for delivery</li>
                    <li>• Column order doesn't matter - system auto-detects columns</li>
                  </ul>
                </div>
              </div>
              
              <div className="alert alert-success">
                <div className="text-sm">
                  <strong>Supported Column Names:</strong>
                  <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
                    <div>
                      <strong>SKU:</strong> sku, product code, item code, product id, item id
                    </div>
                    <div>
                      <strong>Category:</strong> category, name, product name, item name, description, type
                    </div>
                    <div>
                      <strong>Quantity:</strong> quantity, qty, amount, stock, inventory, count
                    </div>
                    <div>
                      <strong>Perishable:</strong> perishable, perish, expires, fresh, shelf life
                    </div>
                    <div>
                      <strong>Damaged:</strong> damaged, damage, defective, broken, faulty
                    </div>
                    <div>
                      <strong>Expiry:</strong> expiry, expiry date, expiration, best before, use by, date
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-ghost" 
                onClick={() => setCsvUploadModal({ open: false, data: null, preview: [] })}
                disabled={uploadLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCsvImport}
                disabled={uploadLoading}
              >
                {uploadLoading ? (
                  <>
                    <div className="loading" style={{ width: '16px', height: '16px' }}></div>
                    <span className="ml-2">Importing...</span>
                  </>
                ) : (
                  `Import ${csvUploadModal.data?.length || 0} Items`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryDashboard;
