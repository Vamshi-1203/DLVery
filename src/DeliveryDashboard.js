import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  addDoc
} from "firebase/firestore";
import SignatureCanvas from 'react-signature-canvas';

const getPriority = (delivery) => {
  if (delivery.perishable) return "Perishable";
  if (delivery.damaged) return "Damaged";
  return "Normal";
};

function VerificationModal({ open, onClose, onConfirm, deliveryId, agent }) {
  const [customerName, setCustomerName] = React.useState("");
  const sigCanvas = useRef(null);
  const [error, setError] = React.useState("");

  // Reset form when modal opens/closes
  React.useEffect(() => {
    if (open) {
      setCustomerName("");
      setError("");
      if (sigCanvas.current) {
        sigCanvas.current.clear();
      }
    }
  }, [open]);

  const handleClear = () => {
    sigCanvas.current.clear();
    setError("");
  };

  const handleConfirm = () => {
    if (!customerName.trim()) {
      setError("Customer name required");
      return;
    }
    if (sigCanvas.current.isEmpty()) {
      setError("Signature required");
      return;
    }
    setError("");
    const signature = sigCanvas.current.toDataURL();
    onConfirm({ customerName, signature });
  };
  
  if (!open) return null;
  
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h3 className="text-xl font-bold text-primary">Customer Verification</h3>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Customer Name</label>
            <input 
              className="form-input" 
              placeholder="Customer Name" 
              value={customerName} 
              onChange={e => setCustomerName(e.target.value)} 
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Customer Signature</label>
            <div className="border border-gray-300 rounded-lg p-2">
              <SignatureCanvas 
                ref={sigCanvas} 
                penColor="purple" 
                canvasProps={{ 
                  width: 350, 
                  height: 120, 
                  className: 'sigCanvas', 
                  style: { border: '1px solid #ddd', borderRadius: '8px' } 
                }} 
              />
            </div>
          </div>
          
          {error && (
            <div className="alert alert-danger">
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={handleClear}>Clear</button>
          <button className="btn btn-primary" onClick={handleConfirm}>Confirm</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const [agentEmailInput, setAgentEmailInput] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [verificationModal, setVerificationModal] = useState({ open: false, delivery: null });
  const [toast, setToast] = useState("");

  const showToast = (msg, type = "success") => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    const stored = localStorage.getItem("delivery_agent");
    if (stored) setAgentEmail(stored);
  }, []);

  useEffect(() => {
    if (!agentEmail) return;
    setLoading(true);
    const q = query(
      collection(db, "deliveries"),
      where("agent", "==", agentEmail),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Check for condition updates
      docs.forEach(delivery => {
        const existingDelivery = deliveries.find(d => d.id === delivery.id);
        
        if (existingDelivery) {
          // Check if condition was updated
          if (existingDelivery.type !== delivery.type || 
              existingDelivery.perishable !== delivery.perishable ||
              existingDelivery.damaged !== delivery.damaged) {
            showToast(`Condition updated for ${delivery.sku}: ${delivery.type || 'normal'}`);
          }
        }
      });
      
      setDeliveries(docs);
      setLoading(false);
    });
    return () => unsub();
  }, [agentEmail, deliveries]);

  const handleLogout = () => {
    localStorage.removeItem("delivery_agent");
    setAgentEmail("");
    setAgentEmailInput("");
    navigate("/");
  };

  const handleStatusChange = async (deliveryId, newStatus, delivery) => {
    if (newStatus === "delivered") {
      setVerificationModal({ open: true, delivery: { id: deliveryId, ...delivery } });
      return;
    }
    try {
      setActionLoading(true);
      
      if (newStatus === "returned") {
        // When item is returned, add it back to inventory and remove the delivery completely
        const inventoryData = {
          sku: delivery.sku,
          category: delivery.name,
          quantity: delivery.quantity,
          perishable: delivery.perishable,
          damaged: delivery.damaged,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        await addDoc(collection(db, "inventory"), inventoryData);
        await deleteDoc(doc(db, "deliveries", deliveryId));
        showToast("Item returned and added back to inventory");
      } else {
        const docRef = doc(db, "deliveries", deliveryId);
        await updateDoc(docRef, { status: newStatus });
        showToast("Delivery status updated successfully!");
      }
    } catch (err) {
      console.error("Error updating status:", err);
      showToast("Failed to update delivery status. Please try again later.", "danger");
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerificationConfirm = async ({ customerName, signature }) => {
    const { id, agent } = verificationModal.delivery;
    try {
      setActionLoading(true);
      // Save verification
      await addDoc(collection(db, "verifications"), {
        deliveryId: id,
        agent,
        customerName,
        signature,
        verifiedAt: new Date().toISOString()
      });
      // Remove delivery
      await deleteDoc(doc(db, "deliveries", id));
      setVerificationModal({ open: false, delivery: null });
      showToast("Delivery verified and removed successfully!");
    } catch (err) {
      console.error("Error confirming delivery:", err);
      showToast("Failed to verify and remove delivery. Please try again later.", "danger");
    } finally {
      setActionLoading(false);
    }
  };

  // Get priority score for sorting (lower number = higher priority)
  const getPriorityScore = (delivery) => {
    // Check both boolean flags and type field for maximum compatibility
    const isPerishable = delivery.perishable || delivery.type === "perishable";
    const isDamaged = delivery.damaged || delivery.type === "damaged";
    
    if (isPerishable) return 1; // Highest priority
    if (isDamaged) return 2;     // Second priority
    return 3;                    // Normal priority
  };

  // Get priority text for display
  const getPriorityText = (delivery) => {
    if (delivery.perishable || delivery.type === "perishable") return 'Perishable';
    if (delivery.damaged || delivery.type === "damaged") return 'Damaged';
    return 'Normal';
  };

  // Group deliveries by date and sort by priority
  const groupDeliveriesByDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const groups = {
      past: [],
      today: [],
      upcoming: []
    };

    deliveries.forEach(delivery => {
      if (!delivery.deliveryDate) {
        // If no delivery date, put in today's group
        groups.today.push(delivery);
        return;
      }

      const deliveryDate = new Date(delivery.deliveryDate);
      deliveryDate.setHours(0, 0, 0, 0);

      if (deliveryDate < today) {
        groups.past.push(delivery);
      } else if (deliveryDate.getTime() === today.getTime()) {
        groups.today.push(delivery);
      } else {
        groups.upcoming.push(delivery);
      }
    });

    // Sort each group by priority and then by delivery date
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const priorityDiff = getPriorityScore(a) - getPriorityScore(b);
        if (priorityDiff !== 0) return priorityDiff;
        
        // If same priority, sort by delivery date (earlier first)
        if (a.deliveryDate && b.deliveryDate) {
          return new Date(a.deliveryDate) - new Date(b.deliveryDate);
        }
        return 0;
      });
    });

    return groups;
  };

  const handleAgentLogin = () => {
    if (agentEmailInput.trim()) {
      setAgentEmail(agentEmailInput.trim());
      localStorage.setItem("delivery_agent", agentEmailInput.trim());
    }
  };

  if (!agentEmail) {
    return (
      <div className="page-wrapper bg-pattern">
        <div className="container">
          <div className="flex items-center justify-center min-h-screen">
            <div className="card glass" style={{ maxWidth: '400px', width: '100%' }}>
              <div className="card-body">
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold mb-2" style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                    Delivery Agent Login
                  </h2>
                  <p className="text-sm text-gray-500">Enter your email to continue</p>
        </div>
                
                <div className="form-group">
          <input
                    className="form-input"
                    type="email"
                    placeholder="Enter your email"
            value={agentEmailInput}
                    onChange={e => setAgentEmailInput(e.target.value)}
                    onKeyPress={e => e.key === 'Enter' && handleAgentLogin()}
          />
                </div>
                
          <button
                  className="btn btn-primary btn-full"
                  onClick={handleAgentLogin}
                  disabled={!agentEmailInput.trim()}
          >
            Continue
          </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const groupedDeliveries = groupDeliveriesByDate();
  const today = new Date().toLocaleDateString();

  return (
    <div className="page-wrapper">
      {/* Navigation */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">🚚 Delivery Dashboard</div>
          <div className="navbar-actions">
            <span className="text-sm text-gray-600">Agent: {agentEmail}</span>
            <span className="text-sm text-gray-500">Today: {today}</span>
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
        
        {loading ? (
          <div className="loading-container">
            <div className="loading"></div>
            <span className="ml-3">Loading deliveries...</span>
          </div>
        ) : deliveries.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-4">📦</div>
            <p className="text-lg">No deliveries assigned yet.</p>
            <p className="text-sm">Check back later for new assignments.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Today's Deliveries */}
            {groupedDeliveries.today.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h2 className="text-xl font-bold text-primary">📅 Today's Deliveries ({groupedDeliveries.today.length})</h2>
                  <p className="text-gray-600">Priority: Perishable → Damaged → Normal</p>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="badge badge-warning badge-sm">
                      Perishable: {groupedDeliveries.today.filter(d => getPriorityScore(d) === 1).length}
                    </span>
                    <span className="badge badge-danger badge-sm">
                      Damaged: {groupedDeliveries.today.filter(d => getPriorityScore(d) === 2).length}
                    </span>
                    <span className="badge badge-primary badge-sm">
                      Normal: {groupedDeliveries.today.filter(d => getPriorityScore(d) === 3).length}
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  <div className="space-y-4">
                    {groupedDeliveries.today.map((delivery, index) => (
                      <div key={delivery.id} className="relative">
                        {/* Priority indicator */}
                        <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full" 
                             style={{
                               backgroundColor: getPriorityScore(delivery) === 1 ? 'var(--warning)' : 
                                               getPriorityScore(delivery) === 2 ? 'var(--danger)' : 'var(--primary)'
                             }}
                             title={`Priority ${getPriorityScore(delivery)}: ${getPriorityText(delivery)}`}
                        />
                        <DeliveryCard 
                          delivery={delivery} 
                          onStatusChange={handleStatusChange}
                          actionLoading={actionLoading}
                          getPriorityText={getPriorityText}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Upcoming Deliveries */}
            {groupedDeliveries.upcoming.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h2 className="text-xl font-bold text-primary">⏰ Upcoming Deliveries ({groupedDeliveries.upcoming.length})</h2>
                  <p className="text-gray-600">Future scheduled deliveries</p>
                </div>
                <div className="card-body">
                  <div className="space-y-4">
                    {groupedDeliveries.upcoming.map((delivery, index) => (
                      <div key={delivery.id} className="relative">
                        {/* Priority indicator */}
                        <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full" 
                             style={{
                               backgroundColor: getPriorityScore(delivery) === 1 ? 'var(--warning)' : 
                                               getPriorityScore(delivery) === 2 ? 'var(--danger)' : 'var(--primary)'
                             }}
                             title={`Priority ${getPriorityScore(delivery)}: ${getPriorityText(delivery)}`}
                        />
                        <DeliveryCard 
                          delivery={delivery} 
                          onStatusChange={handleStatusChange}
                          actionLoading={actionLoading}
                          getPriorityText={getPriorityText}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Past Deliveries */}
            {groupedDeliveries.past.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h2 className="text-xl font-bold text-primary">📋 Past Pending Deliveries ({groupedDeliveries.past.length})</h2>
                  <p className="text-gray-600">Overdue deliveries that need attention</p>
                </div>
                <div className="card-body">
                  <div className="space-y-4">
                    {groupedDeliveries.past.map((delivery, index) => (
                      <div key={delivery.id} className="relative">
                        {/* Priority indicator */}
                        <div className="absolute -left-2 top-1/2 transform -translate-y-1/2 w-2 h-2 rounded-full" 
                             style={{
                               backgroundColor: getPriorityScore(delivery) === 1 ? 'var(--warning)' : 
                                               getPriorityScore(delivery) === 2 ? 'var(--danger)' : 'var(--primary)'
                             }}
                             title={`Priority ${getPriorityScore(delivery)}: ${getPriorityText(delivery)}`}
                        />
                        <DeliveryCard 
                          delivery={delivery} 
                          onStatusChange={handleStatusChange}
                          actionLoading={actionLoading}
                          getPriorityText={getPriorityText}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Verification Modal */}
      <VerificationModal
        open={verificationModal.open}
        onClose={() => setVerificationModal({ open: false, delivery: null })}
        onConfirm={handleVerificationConfirm}
        deliveryId={verificationModal.delivery?.id}
        agent={verificationModal.delivery?.agent}
      />
    </div>
  );
}

// Separate component for delivery card
function DeliveryCard({ delivery, onStatusChange, actionLoading, getPriorityText }) {
  const getPriorityColor = (delivery) => {
    if (delivery.perishable) return 'var(--warning)';
    if (delivery.damaged) return 'var(--danger)';
    return 'var(--primary)';
  };

  const getPriorityBadgeClass = (delivery) => {
    if (delivery.perishable) return 'badge-warning';
    if (delivery.damaged) return 'badge-danger';
    return 'badge-primary';
  };

  return (
    <div className="card border-l-4" style={{ 
      borderLeftColor: getPriorityColor(delivery)
    }}>
      <div className="card-body">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">
                {delivery.sku} - {delivery.name}
              </h3>
              <span className={`badge ${getPriorityBadgeClass(delivery)}`}>
                {getPriorityText(delivery)}
              </span>
              <span className={`badge ${
                delivery.status === 'pending' ? 'badge-outline' :
                delivery.status === 'in_transit' ? 'badge-primary' :
                delivery.status === 'delivered' ? 'badge-success' :
                'badge-danger'
              }`}>
                {delivery.status.replace('_', ' ')}
              </span>
              {/* Show condition update indicator if type field exists */}
              {delivery.type && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Condition: {delivery.type}
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">Quantity:</span> {delivery.quantity}
              </div>
              <div>
                <span className="font-medium">Delivery Date:</span> {delivery.deliveryDate ? new Date(delivery.deliveryDate).toLocaleDateString() : 'Not specified'}
              </div>
              <div>
                <span className="font-medium">Created:</span> {delivery.createdAt ? new Date(delivery.createdAt).toLocaleDateString() : 'Unknown'}
              </div>
              <div>
                <span className="font-medium">Agent:</span> {delivery.agent}
              </div>
            </div>
            
            {/* Show condition details */}
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm">
                <span className="font-medium">Item Condition:</span>
                <div className="flex gap-2 mt-1">
                  <span className={`badge badge-sm ${delivery.perishable ? 'badge-warning' : 'badge-outline'}`}>
                    {delivery.perishable ? 'Perishable' : 'Non-perishable'}
                  </span>
                  <span className={`badge badge-sm ${delivery.damaged ? 'badge-danger' : 'badge-outline'}`}>
                    {delivery.damaged ? 'Damaged' : 'Not damaged'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col gap-2 ml-4">
            {delivery.status === 'pending' && (
              <>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => onStatusChange(delivery.id, 'in_transit', delivery)}
                  disabled={actionLoading}
                >
                  Start Delivery
                </button>
                <button
                  className="btn btn-sm btn-warning"
                  onClick={() => onStatusChange(delivery.id, 'returned', delivery)}
                  disabled={actionLoading}
                >
                  Return
                </button>
              </>
            )}
            
            {delivery.status === 'in_transit' && (
              <>
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => onStatusChange(delivery.id, 'delivered', delivery)}
                  disabled={actionLoading}
                >
                  Mark Delivered
                </button>
                <button
                  className="btn btn-sm btn-warning"
                  onClick={() => onStatusChange(delivery.id, 'returned', delivery)}
                  disabled={actionLoading}
                >
                  Return
                </button>
              </>
            )}
            
            {actionLoading && (
              <div className="loading"></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}