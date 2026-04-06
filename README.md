# 🌌 NebulaOps

> **NebulaOps** is an real-time 3D infrastructure explorer that transforms fractionalized container dashboards into a navigable, interactive galaxy.

![NebulaOps Galaxy View](docs/assets/galaxy-view.png) *(Placeholder for Galaxy View)*

Traditional observability tools overwhelm engineers with flat metrics and fragmented logs. NebulaOps solves this by projecting your entire Docker infrastructure into a spatial environment—turning containers into stars, networks into constellations, and anomalies into black holes. Get a visual mental model of your cluster, instantly understand service topology, and interactively debug infrastructure issues directly from a high-fidelity 3D HUD.

---

## ✨ Key Features

### 🔭 3D Galaxy Visualization
- **Live Infrastructure Mapping:** Watch your system orbit in real time. Discovery is automatic via the Docker Engine API.
- **Dynamic Visual Language:**
  | Infrastructure Element | 3D Visualization | Dynamic Attribute |
  | :--- | :--- | :--- |
  | **Container** | 🌟 Star | Size = Memory, Brightness = CPU |
  | **Service / Network** | 🌌 Constellation | Glowing connection lines grouping related services |
  | **Incident / Anomaly** | 🕳️ Black Hole | Gravitational distortion, red glow, particle attraction |
  | **Event (Crash/Kill)** | 💥 Explosion | Instant visual feedback on container failure |

### 🛠️ Interactive Command & Control
- **Tactical HUD Controls:** Click on any star to invoke a tactical menu. Directly Start, Stop, Kill, Restart, Pause, and Unpause containers without leaving the 3D environment.
- **Sensor Suite:** Detailed per-container inspection panel streaming live CPU/Memory telemetry, active network activity, Docker inspect metadata, volumes, and trailing logs.
- **Remote Bridge Shell:** Open a fully styled, embedded `xterm.js` terminal connecting directly (`bash`/`sh`) into the container via WebSocket for immediate real-time debugging.

![Remote Bridge Platform](docs/assets/remote-bridge.png) *(Placeholder for Remote Bridge Shell)*

### 🧠 AI-Powered "Neural" Intelligence
- **AI Constellation Mapper:** Automatically groups containers into logical service clusters (constellations) based on shared networks and communication patterns.
- **Incident Detection & Analysis:** Actively monitors for CPU/Memory spikes, presenting anomalies visually as black holes and analyzing them for root cause hints.
- **AI DevOps Copilot:** A floating spatial AI drone object you can interact with. Ask questions like *"Why is my API latency spiking?"* and it will scan live metrics, logs, and relationships to provide contextual answers.
- **Log Summarization:** Instantly parse thousands of trailing log lines into a plain-English situation report via AI.

![AI Intelligence](docs/assets/ai-intelligence.png) *(Placeholder for AI Copilot / Intelligence)*

---

## 🎮 Demo Mode (Zero-Config)

NebulaOps includes a **Transparent Demo Mode** for users who want to explore the interface without a running Docker daemon.

- **Automatic Fallback:** If the backend cannot connect to a `/var/run/docker.sock`, it automatically initializes a high-fidelity mock infrastructure (simulating varied loads and services).
- **Zero Configuration:** Simply run the containers, and if no host socket is detected, the demo galaxy is born.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18+) and **Python** (3.9+)
- **Windows Users:** You MUST have **Docker Desktop** installed and running. Ensure "Use the WSL 2 based engine" is enabled for best performance.
- **AI Features:** An **OpenAI API Key** or a **GitHub Token** (optional).

### Installation

1. **Clone & Enter:**
   ```bash
   git clone https://github.com/yourusername/nebulaops.git
   cd nebulaops
   ```

2. **AI Setup (Optional):**
   Create `backend/.env` to enable the Copilot and Log Summarization:
   ```env
   OPENAI_API_KEY=your_openai_key_here
   ```

3. **Start the Backend:**
   Open a new terminal and run:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **Start the Frontend:**
   Open another terminal and run:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. **Explore:**
   - **HUD Interface:** [http://localhost:5173](http://localhost:5173) *(Default Vite port)*
   - **Backend API:** [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🏗️ System Architecture

NebulaOps is built on a high-concurrency "Neural" stack designed to process telemetry efficiently:
- **Frontend:** React + Three.js (`@react-three/fiber`) + Framer Motion. Renders at a smooth 60 FPS while managing complex 3D scenes.
- **Backend:** FastAPI + Python `docker` SDK + WebSockets. Engineered for ~1ms telemetry loops processing container states and system stats.
- **Intelligence:** Modular AI agents via LLM integrations.

![System Architecture](docs/assets/architecture.png) *(Placeholder for Architecture Diagram)*

---

## 🗺️ Roadmap & Future Features

While NebulaOps already provides a robust visual DevOps experience, the following features are actively planned for future milestones:
- **⏱️ AI Time Warp (Infrastructure Replay):** A spatial timeline slider that replays past incidents (container drops, resource spikes) like a DVR for your infrastructure.
- **☸️ Kubernetes Integration:** Expanding orchestration support to map Namespaces, Deployments, Pods, and Services natively in 3D.
- **🥽 VR / WebXR Mode:** Native immersive headset exploration of your clusters for the ultimate spatial computing DevOps experience.

---

## 🛠️ Troubleshooting

- **"Docker not available" Error (AI features / Metrics won't load):** 
  - Ensure Docker Desktop is running.
  - Check your volume mounts in `docker-compose.yml`. You must mount the system boundary `/var/run/docker.sock` to the backend.
  - If you encounter permission errors on Linux, ensure your user is in the `docker` group, or provide specific ACLs to the mounted socket.
- **AI Link Offline / "Summarization Failed":** Ensure your `.env` file is located precisely in the `backend/` folder and the API key is active/funded.

## 🛡️ Security

NebulaOps requires **highly privileged access** (`docker.sock`) for real-time monitoring and terminal access. 
⚠️ **NEVER expose the NebulaOps port (3000/8000) to the public internet** without a rigorous reverse proxy, VPN, and robust authentication layer. Read-only capability scaling is under development.

## 📜 License
MIT License - See [LICENSE](LICENSE) for details.
