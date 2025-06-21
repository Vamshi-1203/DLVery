import React, { useState } from "react";
import { auth } from "./firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { BrowserRouter as Router, Route, Routes, useNavigate } from "react-router-dom";
import { db } from "./firebase";
import { doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy } from "firebase/firestore";
import Login from "./Login";
import SignUp from "./SignUp";
import InventoryDashboard from "./InventoryDashboard";
import DeliveryDashboard from "./DeliveryDashboard";
import Deliveries from "./Deliveries";

const cozyStyle = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f7f6f3",
  fontFamily: "'Segoe UI', sans-serif"
};
const cardStyle = {
  background: "#fff",
  padding: "2rem 2.5rem",
  borderRadius: "18px",
  boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
  minWidth: 340,
  maxWidth: 380
};
const inputStyle = {
  width: "100%",
  padding: "0.7rem",
  margin: "0.5rem 0 1rem 0",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "1rem"
};
const buttonStyle = {
  width: "100%",
  padding: "0.8rem",
  background: "#6c63ff",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontWeight: 600,
  fontSize: "1.1rem",
  cursor: "pointer",
  marginTop: "0.5rem"
};
const errorStyle = {
  color: "#d7263d",
  background: "#fff0f3",
  padding: "0.5rem 1rem",
  borderRadius: "6px",
  marginBottom: "1rem",
  fontSize: "0.97rem"
};
const radioGroupStyle = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: "1rem"
};

function RoleLanding() {
  const navigate = useNavigate();
  return (
    <div className="page-wrapper bg-pattern">
      <div className="container">
        <div className="flex items-center justify-center min-h-screen">
          <div className="card glass" style={{ maxWidth: '400px', width: '100%' }}>
            <div className="card-body text-center">
              <h2 className="text-3xl font-bold mb-6" style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                Welcome to DLVery
              </h2>
              <p className="text-gray-600 mb-8 text-lg">Who are you?</p>
              <div className="flex flex-col gap-4">
                <button 
                  className="btn btn-primary btn-lg"
                  onClick={() => navigate("/login/InvTeam")}
                >
                  📦 Inventory Team
                </button>
                <button 
                  className="btn btn-secondary btn-lg"
                  onClick={() => navigate("/login/DLTeam")}
                >
                  🚚 Delivery Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoleLanding />} />
        <Route path="/login/:role" element={<Login />} />
        <Route path="/signup/:role" element={<SignUp />} />
        <Route path="/inventory" element={<InventoryDashboard />} />
        <Route path="/delivery" element={<DeliveryDashboard />} />
        <Route path="/deliveries" element={<Deliveries />} />
      </Routes>
    </Router>
  );
}

export default App;
