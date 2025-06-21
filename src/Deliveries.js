import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "./firebase";
import {
  collection,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc as firestoreDoc,
  query,
  orderBy,
  addDoc,
  getDocs
} from "firebase/firestore";

function Deliveries() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [skuFilter, setSkuFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, "deliveries"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          sku: data.sku || "",
          name: data.name || "",
          agent: String(data.agent || ""), // Force string
          quantity: typeof data.quantity === "number" ? data.quantity : 0,
          status: data.status || "pending",
          type: data.type || "normal",
          perishable: Boolean(data.perishable),
          damaged: Boolean(data.damaged),
          createdAt: data.createdAt || new Date().toISOString(),
          deliveryDate: data.deliveryDate || "",
          deliveredQuantity: data.deliveredQuantity || 0,
          deliveredAt: data.deliveredAt || "",
        };
      });
      setDeliveries(docs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleStatusChange = async (id, status) => {
    try {
      const delivery = deliveries.find(d => d.id === id);
      if (!delivery) {
        console.error("Delivery not found:", id);
        return;
      }

      if (status === "delivered") {
        await deleteDoc(firestoreDoc(db, "deliveries", id));
      } else if (status === "returned") {
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
        await deleteDoc(firestoreDoc(db, "deliveries", id));
      } else {
        await updateDoc(firestoreDoc(db, "deliveries", id), { status });
      }
    } catch (err) {
      console.error("Error updating delivery status:", err);
    }
  };

  const handleTypeChange = async (deliveryId, newType) => {
    try {
      const delivery = deliveries.find(d => d.id === deliveryId);
      if (!delivery) {
        console.error("Delivery not found:", deliveryId);
        return;
      }

      // Update delivery type and corresponding boolean flags
      const updateData = { 
        type: newType,
        // Update boolean flags that delivery agent view uses
        perishable: newType === "perishable",
        damaged: newType === "damaged"
      };

      await updateDoc(firestoreDoc(db, "deliveries", deliveryId), updateData);

      // Update related inventory items if they exist
      const inventoryQuery = query(collection(db, "inventory"));
      const inventorySnapshot = await getDocs(inventoryQuery);
      const updatePromises = [];

      inventorySnapshot.docs.forEach(doc => {
        const inventoryItem = doc.data();
        if (inventoryItem.sku === delivery.sku) {
          updatePromises.push(updateDoc(doc.ref, {
            perishable: updateData.perishable,
            damaged: updateData.damaged,
            updatedAt: new Date().toISOString()
          }));
        }
      });

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    } catch (err) {
      console.error("Error updating delivery type:", err);
    }
  };

  const filteredDeliveries = deliveries.filter((del) => {
    if (!del || typeof del !== "object" || !del.id) {
      console.warn("Invalid delivery found:", del);
      return false;
    }

    const skuMatch = skuFilter
      ? del.sku?.toString().toLowerCase().includes(skuFilter.toLowerCase())
      : true;

    const agentKey =
      typeof del.agent === "string" ? del.agent.trim().toLowerCase() : "";
    const agentMatch = agentFilter
      ? agentKey.includes(agentFilter.trim().toLowerCase())
      : true;

    return skuMatch && agentMatch;
  });

  return (
    <div className="page-wrapper">
      <nav className="navbar">
        <div className="navbar-content">
          <div className="navbar-brand">📋 All Deliveries</div>
          <div className="navbar-actions">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => navigate("/inventory")}
            >
              Back to Inventory
            </button>
          </div>
        </div>
      </nav>

      <div className="container" style={{ paddingTop: "100px" }}>
        <div className="card mb-8">
          <div className="card-header">
            <h3 className="text-xl font-semibold text-gray-800">Filters</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Filter by SKU</label>
                <input
                  className="form-input"
                  placeholder="Enter SKU to filter"
                  value={skuFilter}
                  onChange={(e) => setSkuFilter(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Filter by Agent</label>
                <input
                  className="form-input"
                  placeholder="Enter agent email to filter"
                  value={agentFilter}
                  onChange={(e) => setAgentFilter(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2 className="text-2xl font-bold text-primary">All Deliveries</h2>
            <p className="text-gray-600 mt-2">
              View and manage all delivery records
            </p>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="loading-container">
                <div className="loading"></div>
                <span className="ml-3">Loading deliveries...</span>
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-4">📦</div>
                <p className="text-lg">No deliveries found.</p>
                <p className="text-sm">
                  Try adjusting your filters or create new deliveries from
                  inventory.
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Name</th>
                      <th>Agent</th>
                      <th>Quantity</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Delivery Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDeliveries.map((del) => {
                      if (!del || typeof del !== "object") {
                        console.warn("Invalid delivery in render:", del);
                        return null;
                      }

                      const skuValue =
                        typeof del.sku === "object"
                          ? del.sku.code || JSON.stringify(del.sku)
                          : del.sku || "";

                      const deliveryDateDisplay = del.deliveryDate
                        ? new Date(del.deliveryDate).toLocaleDateString()
                        : "Not set";

                      const itemType = del.type || 
                        (Boolean(del.perishable) ? "perishable" : 
                         Boolean(del.damaged) ? "damaged" : "normal");

                      return (
                        <tr key={del.id}>
                          <td className="font-mono font-medium">{skuValue}</td>
                          <td>{del.name || ""}</td>
                          <td className="text-sm">{del.agent || ""}</td>
                          <td>
                            <span className="font-semibold">
                              {del.quantity || 0}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                itemType === "perishable"
                                  ? "badge-warning"
                                  : itemType === "damaged"
                                  ? "badge-danger"
                                  : "badge-outline"
                              }`}
                            >
                              {itemType}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                del.status === "pending"
                                  ? "badge-outline"
                                  : del.status === "in_transit"
                                  ? "badge-primary"
                                  : del.status === "delivered"
                                  ? "badge-success"
                                  : del.status === "returned"
                                  ? "badge-warning"
                                  : "badge-danger"
                              }`}
                            >
                              {(del.status || "").replace("_", " ")}
                            </span>
                          </td>
                          <td className="text-sm">{deliveryDateDisplay}</td>
                          <td>
                            <div className="flex gap-2">
                              <select
                                className="form-select"
                                style={{ width: "auto", minWidth: "120px" }}
                                value={del.status || "pending"}
                                onChange={(e) =>
                                  handleStatusChange(del.id, e.target.value)
                                }
                              >
                                <option value="pending">Pending</option>
                                <option value="in_transit">In Transit</option>
                                <option value="delivered">Delivered</option>
                                <option value="returned">Returned</option>
                                <option value="door_lock">Door Lock</option>
                              </select>

                              <select
                                className="form-select"
                                style={{ width: "auto", minWidth: "100px" }}
                                value={
                                  del.type ||
                                  (Boolean(del.perishable)
                                    ? "perishable"
                                    : Boolean(del.damaged)
                                    ? "damaged"
                                    : "normal")
                                }
                                onChange={async (e) => {
                                  const newType = e.target.value;
                                  await handleTypeChange(del.id, newType);
                                }}
                              >
                                <option value="normal">Normal</option>
                                <option value="perishable">Perishable</option>
                                <option value="damaged">Damaged</option>
                              </select>
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
    </div>
  );
}

export default Deliveries;
