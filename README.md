# DLVery - Intelligent Logistics Management System

A comprehensive web-based logistics management platform designed for DLVery's expansion from Tier 1 to Tier 2 cities across India. The system provides end-to-end inventory and delivery management with real-time tracking and customer verification capabilities.

## 🚀 Features

### 📦 Inventory Management
- Real-time inventory tracking and categorization
- Bulk CSV import/export functionality
- Product classification (Category, Perishable, Damaged, Expiry)
- Smart filtering and search capabilities
- Delivery assignment to agents

### 🚚 Delivery Management
- Role-based delivery agent interface
- Priority-based delivery queue (Perishable → Damaged → Normal)
- Customer signature capture for delivery verification
- Status tracking (Pending → In Transit → Delivered/Returned)
- Exception handling (Door Lock, Damaged, Returns)

### 🔐 Authentication & Security
- Multi-role access (Inventory Team, Delivery Agents)
- Google and GitHub OAuth integration
- Role-based permissions and access control
- Secure data transmission and validation

### 📊 Reporting & Analytics
- Delivery reports by date range
- Damage analysis and tracking
- Agent performance metrics
- Inventory movement analytics

## 🛠️ Technology Stack

### Frontend
- **React 19.1.0** - Modern UI framework
- **React Router DOM 7.6.2** - Client-side routing
- **Firebase 11.9.1** - Authentication and real-time database
- **React Signature Canvas** - Digital signature capture

### Backend
- **Java 17** - High-performance middleware
- **Maven** - Dependency management
- **Firebase Admin SDK** - Server-side operations
- **HTTP Server** - REST API endpoints

### Database
- **Firebase Firestore** - NoSQL cloud database
- **Firebase Realtime Database** - Real-time synchronization

## 📁 Project Structure

```
dlvery/
├── src/                          # React frontend
│   ├── App.js                   # Main application
│   ├── Login.js                 # Authentication
│   ├── SignUp.js                # User registration
│   ├── InventoryDashboard.js    # Inventory management
│   ├── DeliveryDashboard.js     # Delivery agent interface
│   ├── Deliveries.js            # Delivery tracking
│   ├── About.js                 # Project information
│   └── firebase.js              # Firebase configuration
├── java-middleware/             # Java backend
│   ├── src/main/java/com/team26/
│   │   ├── App.java             # Main entry point
│   │   └── FirebaseMiddleware.java  # REST API server
│   └── pom.xml                  # Maven dependencies
└── README.md                    # This file
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Java 17 or higher
- Maven 3.6 or higher
- Firebase project with Firestore enabled

### Frontend Setup
```bash
npm install
npm start
```

### Backend Setup
```bash
cd java-middleware
mvn clean compile
mvn exec:java -Dexec.mainClass="com.team26.FirebaseMiddleware"
```

### Firebase Configuration
1. Create Firebase project
2. Enable Authentication and Firestore
3. Update `src/firebase.js` with your configuration
4. Add service account key to `java-middleware/`

## 👥 User Roles

### Inventory Team (InvTeam)
- Manage warehouse inventory
- Assign deliveries to agents
- Track delivery status
- Generate reports

### Delivery Agent (DLTeam)
- View assigned deliveries
- Update delivery status
- Capture customer signatures
- Handle delivery exceptions


## �� Key Features

- **Real-time Updates**: Live synchronization across all users
- **Mobile Responsive**: Optimized for delivery agent field operations
- **Priority Management**: Intelligent delivery prioritization
- **Customer Verification**: Digital signature capture
- **Exception Handling**: Comprehensive delivery status management
- **Bulk Operations**: CSV import/export for inventory management

## 🔒 Security

- Firebase Authentication with OAuth
- Role-based access control
- Input validation and sanitization
- Secure API endpoints with CORS
- Service account authentication

## 📱 Responsive Design

The application is fully responsive and optimized for:
- Desktop computers (warehouse operations)
- Tablets (delivery management)
- Mobile phones (field delivery agents)

## 🚀 Deployment

### Frontend
```bash
npm run build
# Deploy build folder to hosting service
```

### Backend
```bash
mvn clean package
# Deploy JAR file to Java hosting service
```

