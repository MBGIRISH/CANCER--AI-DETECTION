# 🧬 ONCOSIGHT AI Platform

> **An advanced, privacy-preserving AI platform for multi-modal cancer detection and federated medical learning.**

![ONCOSIGHT Banner](./assets/banner.png)

## 📌 Problem Statement
Medical imaging generates vast amounts of data, yet hospital networks struggle to share knowledge due to stringent privacy regulations (HIPAA/GDPR). This creates data silos that severely bottleneck AI advancements in oncology. **ONCOSIGHT AI** solves this by leveraging **Federated Learning**—allowing decentralized clinical institutions to collaboratively train highly accurate cancer detection models *without ever sharing raw patient data*.

---

## 🌟 What is ONCOSIGHT AI?
ONCOSIGHT AI is an end-to-end medical intelligence platform designed for oncologists and radiologists. It fuses state-of-the-art Deep Learning models with a decentralized training architecture. It provides an intuitive clinical dashboard where doctors can upload medical scans, receive instant diagnostic predictions with visual explainability, and track patient reporting—all while operating in a secure, microservices-driven ecosystem.

## 🚀 Core Capabilities
* **🧠 Multi-Model Diagnostics:** Supports specialized detection for Lung Opacity, Pneumonia, Brain Tumors, and localized lesion segmentation.
* **🛡️ Federated Learning Pipeline:** Simulates hospital nodes (`Alpha`, `Beta`, `Gamma`) that collaboratively train global models. Nodes compute gradients locally and share only weight updates with the central coordinator.
* **🔍 Explainable AI (Grad-CAM):** Black-box models are dangerous in healthcare. We generate live Grad-CAM (Gradient-weighted Class Activation Mapping) heatmaps overlaying medical scans, showing doctors *exactly* where the model is looking.
* **🔐 Secure Role-Based Access:** Encrypted doctor portals using secure JWT authentication.
* **📊 Clinical Dashboard:** Real-time metrics, live hospital node health-checks (`FederatedNodes.tsx`), and comprehensive patient scan reporting (`Reports.tsx`).
* **☁️ Enterprise-Grade DevOps:** Fully containerized with Docker, highly available via NGINX, and orchestration-ready with Kubernetes (`HPA`, `Deployments`, `ConfigMaps`).

---

## 🏗️ System Architecture

ONCOSIGHT operates on a heavily distributed microservices architecture tailored for scalability and low latency.

```mermaid
graph TD
    Client[Web Client - React UI] --> NGINX[NGINX API Gateway]
    NGINX --> Frontend[Frontend Service :80]
    NGINX --> Backend[FastAPI Core :8000]
    Backend --> AI_Inference[PyTorch AI Service]
    Backend --> DB[(MongoDB / Redis)]
    
    subgraph Federated Learning Network
    Coordinator[Federated Coordinator :8004] --> HospitalA[Node Alpha :8001]
    Coordinator --> HospitalB[Node Beta :8002]
    Coordinator --> HospitalC[Node Gamma :8003]
    end
    
    HospitalA -. "Local Gradients" .-> Coordinator
    HospitalB -. "Local Gradients" .-> Coordinator
    HospitalC -. "Local Gradients" .-> Coordinator
```

---

## 📂 Project Structure

```text
CANCER-DETECTION/
├── ai-services/         # PyTorch inference wrappers, Grad-CAM utilities
├── backend/             # FastAPI backend (Auth, Predictions, Reports, Storage)
├── docker/              # Dockerfiles for all microservices
├── federated-learning/  # FL Coordinator and Hospital Node scripts
├── frontend/            # React 19 + Vite frontend application
├── k8s/                 # Kubernetes manifests (Deployments, HPA, Ingress)
├── model/               # Raw training scripts for PyTorch models
├── monitoring/          # Prometheus & Grafana configurations
├── nginx/               # NGINX reverse proxy configs
└── docker-compose.yml   # Local orchestration
```

---

## 🛠️ Technology Stack

| Domain | Technologies Used |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts |
| **Backend** | Python 3.11, FastAPI, Uvicorn, PyJWT, Passlib |
| **AI / ML** | PyTorch, Torchvision, OpenCV, NumPy, Scikit-learn |
| **Database** | MongoDB Atlas, Redis (Caching / Queueing) |
| **DevOps** | Docker, Kubernetes (K8s), NGINX, GitHub Actions (CI/CD) |

---

## 💻 Getting Started (Local Development)

### Prerequisites
* Docker & Docker Compose
* Node.js (v18+) & Python (v3.10+)

### Option 1: Full Docker Stack (Recommended)
Boot up the entire distributed system, including the NGINX gateway, backend, AI inference engine, database, and 3 federated hospital nodes.
```bash
docker-compose up --build
```
*Access the web application at `http://localhost`.*

### Option 2: Manual Development Setup
**1. Start the Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # (or .\venv\Scripts\activate on Windows)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**2. Start the Frontend:**
```bash
cd frontend
npm install
npm run dev
```

**3. Run Federated Learning Simulation (Standalone):**
```bash
cd federated-learning
pip install -r requirements.txt
python coordinator.py &
python client_node.py --id Alpha --port 8001 &
python client_node.py --id Beta --port 8002 &
```

---

## 🚢 Kubernetes (K8s) Deployment

The platform is designed to scale horizontally in production clusters. All manifests are located in the `k8s/` directory.

```bash
# 1. Apply Secrets & ConfigMaps
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmaps.yaml

# 2. Deploy Services & Databases
kubectl apply -f k8s/mongodb-deployment.yaml
kubectl apply -f k8s/services.yaml

# 3. Deploy Application Microservices
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/ai-inference-deployment.yaml
kubectl apply -f k8s/federated-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# 4. Enable Autoscaling & Ingress
kubectl apply -f k8s/hpa.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## 🔗 Core API Endpoints

* `POST /api/auth/login` - Authenticate doctor and receive JWT.
* `POST /api/predict` - Upload image for inference. Returns prediction, confidence, and Base64 Grad-CAM heatmap.
* `GET /api/reports` - Fetch saved scan reports and diagnostic history.
* `POST /api/reports` - Generate and save a new diagnostic report.

---

*Developed for the future of decentralized medical intelligence. Empowering doctors with AI, while protecting patient privacy.*
