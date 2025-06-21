import React, { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { auth, db } from "./firebase";
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { role } = useParams();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const userData = {
        email,
        role
      };
      await setDoc(doc(db, "users", userCredential.user.uid), userData);
      if (role === "InvTeam") {
        navigate("/inventory");
      } else if (role === "DLTeam") {
        navigate("/deliveryagent");
      } else {
        navigate("/delivery");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGoogleSignIn = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const userRef = doc(db, "users", result.user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: result.user.email,
          role
        });
      }
      const userDoc = await getDoc(userRef);
      const userRole = userDoc.exists() ? userDoc.data().role : role;
      if (userRole === "InvTeam") {
        navigate("/inventory");
      } else {
        navigate("/delivery");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const getRoleDisplay = () => {
    if (role === 'InvTeam') return 'Inventory Team';
    if (role === 'DLTeam') return 'Delivery Agent';
    return 'Delivery';
  };

  return (
    <div className="page-wrapper bg-pattern">
      <div className="container">
        <div className="flex items-center justify-center min-h-screen">
          <div className="card glass" style={{ maxWidth: '400px', width: '100%' }}>
            <div className="card-body">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold mb-2" style={{ background: 'var(--primary-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  DLVery Sign Up
                </h2>
                <p className="text-sm text-gray-500">{getRoleDisplay()}</p>
              </div>
              
              {error && (
                <div className="alert alert-danger mb-6">
                  {error}
                </div>
              )}
              
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="form-group">
                  <input
                    className="form-input"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <button className="btn btn-primary btn-full" type="submit">
                  Sign Up
                </button>
              </form>
              
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="btn btn-outline btn-full"
                >
                  <img 
                    src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png" 
                    alt="Google" 
                    className="w-5 h-5 mr-2" 
                  />
                  Sign up with Google
                </button>
              </div>
              
              <div className="text-center mt-6">
                <span className="text-gray-600">Already have an account? </span>
                <Link 
                  to={`/login/${role}`} 
                  className="text-primary font-medium hover:underline"
                >
                  Login
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignUp; 