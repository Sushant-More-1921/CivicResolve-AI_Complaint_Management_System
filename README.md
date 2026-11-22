<p align="center">
  <img src="docs/images/banner.svg" alt="CivicResolve Banner" width="100%" />
</p>

<p align="center">
  <a href="#key-features"><img src="https://img.shields.io/badge/Platform-CivicResolve-blue?style=for-the-badge&logo=civic" alt="Platform" /></a>
  <a href="#technology-stack"><img src="https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js" alt="Next.js" /></a>
  <a href="#technology-stack"><img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react" alt="React" /></a>
  <a href="#technology-stack"><img src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js" alt="Node.js" /></a>
  <a href="#technology-stack"><img src="https://img.shields.io/badge/PostgreSQL-Prisma-4169E1?style=for-the-badge&logo=postgresql" alt="PostgreSQL" /></a>
  <a href="#technology-stack"><img src="https://img.shields.io/badge/FastAPI-Python-009688?style=for-the-badge&logo=fastapi" alt="FastAPI" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/License-ISC-green?style=for-the-badge" alt="License" /></a>
</p>

---

## 📌 Executive Summary

**CivicResolve** is a next-generation civic grievance redressal and municipal operations platform designed to bridge the gap between citizens and local urban administration.

Built for modern municipalities, CivicResolve provides transparent, end-to-end management of civic complaints—from instant multi-lingual citizen submission, location pinning, and automated evidence validation, to real-time administrative dispatch, geospatial hotspot tracking, and field officer resolution.

<p align="center">
  <img src="docs/images/citizen-portal-preview.png" alt="CivicResolve Portal Preview" width="85%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15);" />
</p>

---

## 🌟 Key Features

### 👤 Citizen Portal
- **Fast Complaint Submission**: Clean, frictionless grievance reporting form with automatic department detection.
- **Accurate Geospatial Pinning**: Interactive **Mappls SDK** integration with automatic GPS location detection, place search, and fallback geocoding.
- **Evidence Verification**: Real-time image validation that inspects uploaded photos for authentic civic issues (potholes, garbage dumps, broken streetlights, water pipeline leaks).
- **Multilingual Accessibility**: Native multi-lingual interface supporting **English**, **Hindi (हिंदी)**, **Marathi (मराठी)**, and **Gujarati (ગુજરાતી)**.
- **Voice-Assisted Input**: Built-in speech-to-text dictation supporting mixed and native dialects for citizens who prefer voice over typing.
- **Transparent Real-Time Tracking**: Unique tracking ID for every issue with a live progress timeline (**Submitted → Under Review → Assigned → In Progress → Resolved**).

### 🏛️ Municipal Administration & Department Dashboard
- **Live Event Engine**: Instant dashboard updates via **Socket.io WebSockets** with zero manual page refreshing.
- **Interactive Hotspot Intelligence**: Real-time municipal map visualizing complaint clusters, ward zones, and semi-transparent hotspot rings with live complaint counts.
- **Intelligent Dispatch & Workflow**: Assign tasks directly to registered field workers with equipment instructions and resolution timelines.
- **Role-Based Access Control (RBAC)**: Distinct permissions for **Citizens**, **Department Officers**, **Department Administrators**, and **Super Admins**.

### 👷 Field Officer Workspace
- **Mobile-Responsive Task List**: Field workers access designated tasks with location coordinates and citizen notes.
- **Resolution Evidence**: Direct before-and-after photo upload and resolution notes submission directly from the field.

---

## 🏗️ System Architecture

CivicResolve employs a decoupled, multi-tier microservices architecture combining a responsive Next.js frontend, an Express/PostgreSQL transactional API gateway, and a high-performance Python FastAPI intelligence engine.

<p align="center">
  <img src="docs/images/architecture.svg" alt="CivicResolve Architecture Diagram" width="100%" />
</p>

---

## 💻 Technology Stack

| Layer | Technologies | Description |
| :--- | :--- | :--- |
| **Frontend Framework** | **Next.js 16** (App Router), **React 19** | High-performance React framework with server and client components |
| **Language & Typing** | **TypeScript 5.x** | End-to-end type safety across client and server |
| **Styling & UI** | **Tailwind CSS v4**, **Lucide Icons** | Ultra-responsive, clean design system with accessible components |
| **Mapping & GIS** | **Mappls Web SDK v3.0**, **OpenStreetMap** | Interactive mapping, reverse geocoding, ward overlays & hotspot rings |
| **Backend API** | **Node.js**, **Express 5**, **TypeScript** | RESTful routing, authentication middlewares, and business logic |
| **Realtime Sockets** | **Socket.io** | Bidirectional real-time event distribution for live dashboard synchronization |
| **Database & ORM** | **PostgreSQL**, **Prisma ORM 5**, **Supabase** | Relational data persistence, schema migrations, and relational integrity |
| **Auth & Security** | **JWT**, **Bcrypt.js**, **Zod** | Secure token-based session management and runtime schema validation |
| **AI & Vision Service**| **Python 3.10+**, **FastAPI**, **PyTorch** | Vision classification (MobileNetV2), category inference & data pipeline |
| **Speech Processing** | **Whisper STT** | Speech-to-text processing for multilingual citizen voice dictation |

---

## 📂 Project Structure

```bash
Mega-Project/
├── frontend/               # Next.js 16 Web Application
│   ├── app/                # App Router (Citizen, Admin, Super Admin, Officer)
│   ├── components/         # Reusable UI, Map, Voice, and Table components
│   ├── lib/                # API client, internationalization (i18n), utilities
│   └── public/             # Static assets, logos, and vector graphics
│
├── backend/                # Express & TypeScript Backend API
│   ├── prisma/             # Prisma schema, migrations, and database seeders
│   ├── src/
│   │   ├── modules/        # Modular domain services (Complaints, Users, Maps, AI)
│   │   ├── middleware/     # Auth guards, role checks, and error handlers
│   │   └── app.ts          # Express server and Socket.io server bootstrap
│   └── uploads/            # Complaint evidence photo storage
│
├── ai-service/             # FastAPI & Machine Learning Microservice
│   ├── app/                # FastAPI application routes and handlers
│   ├── models/             # Trained neural network weights and checkpoints
│   ├── training/           # Model training, dataset preparation, and evaluation
│   └── requirements.txt    # Python machine learning dependencies
│
└── docs/                   # Documentation and architectural assets
    └── images/             # Visual banners, architecture SVGs, and previews
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your development machine:
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Python**: `3.10` or higher
- **PostgreSQL**: Local instance or remote database (e.g. Supabase)

---

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/civicresolve.git
cd civicresolve
```

---

### Step 2: Environment Configuration

Create `.env` files in the root, `backend/`, and `frontend/` folders using the provided examples:

#### Backend (`backend/.env`):
```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/civicresolve?schema=public"
JWT_SECRET="your-super-secret-jwt-key"
MAPPLS_REST_KEY="your-mappls-rest-key"
AI_SERVICE_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://localhost:3000"
```

#### Frontend (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL="http://localhost:5000/api"
NEXT_PUBLIC_SOCKET_URL="http://localhost:5000"
NEXT_PUBLIC_MAPPLS_MAP_KEY="your-mappls-map-key"
```

---

### Step 3: Install Dependencies

Install root, backend, and frontend packages:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Setup Python environment for AI service (optional for ML inference)
cd ../ai-service
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
pip install -r requirements.txt
cd ..
```

---

### Step 4: Database Setup & Seeding

Initialize the database schema and populate initial municipal departments and demo accounts:

```bash
cd backend
npx prisma db push
npm run db:seed
cd ..
```

---

### Step 5: Run the Development Servers

From the root directory, you can launch all tiers:

```bash
# Terminal 1: Backend API (runs on port 5000)
npm run backend

# Terminal 2: Frontend Web App (runs on port 3000)
npm run frontend

# Terminal 3 (Optional): AI & Vision Service (runs on port 8000)
npm run ai
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser to access the portal.

---

## 👥 User Roles & Access Matrix

| Role | Capabilities | Default Landing Route |
| :--- | :--- | :--- |
| **Citizen** | Register grievances, attach geo-pins, voice-dictate, and track real-time progress | `/citizen/dashboard` |
| **Department Admin** | Monitor department queues, analyze ward hotspots, dispatch field workers | `/admin/departments` |
| **Field Officer** | View assigned civic repairs, update progress, upload proof of resolution | `/officer/workspace` |
| **Super Admin** | City-wide oversight, department configuration, cross-ward analytics | `/admin/dashboard` |

---

## 🗺️ Geospatial & Hotspot Mapping

CivicResolve integrates **Mappls Interactive Maps** with localized coordinates and automatic fallback mechanisms:
- **Interactive Location Pinning**: Automatically centers on the citizen's current locality with instant reverse geocoding.
- **Ward Boundary Outlines**: Outlines municipal zones for accurate administrative routing.
- **Hotspot Heat Rings**: Highlights recurring trouble spots with transparent status rings and incident count indicators.

---

## 🛡️ Production Build & Verification

To verify and produce production-ready builds:

```bash
# Verify backend compilation
npm --prefix backend run build

# Verify frontend Next.js production build
npm --prefix frontend run build
```

---

## 📄 License

This project is licensed under the **ISC License**. See the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Developed for modern municipal administration and empowered citizens.
</p>
