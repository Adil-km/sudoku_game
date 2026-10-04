# Sudoku AI 🧩

A modern, high-performance Sudoku web application built with **React 19**, **TypeScript**, and **Vite**, featuring real-time AI auto-solving powered by the **Laya Local Decision Engine**.

---

## ✨ Features

- **Multiple Grid Formats**: Play classic **9x9**, compact **6x6**, or mini **4x4** boards.
- **Dynamic Difficulty Levels**: Easy, Medium, Hard, and Expert puzzle generation.
- **Smart Validation & Visual Feedback**:
  - Highlights rows, boxes, and conflicting columns with a distinctive red accent.
  - Number counter and candidate validation.
  - Interactive timer that starts automatically on your first move.
  - History tracking and move undo/reset.
- **Laya Local AI Co-Pilot & Auto-Player**:
  - Direct integration with Laya's local decision server (`python_server/server.py`).
  - **Zero-Delay Auto-Play**: Parallel pipelining prefetches upcoming decisions concurrently while placing numbers on the board for blazing-fast solving.
  - **Live Decision Diagnostics**: Real-time display of selected cell, recommended candidate, confidence score, and network/model inference latency.
  - **Smart Cell Tracking**: Keeps track of AI moves and intelligently corrects unfilled or incorrectly placed user cells.
- **Modern Glassmorphic Dark UI**: Custom responsive layout tailored for both desktop and mobile viewports.

---

## 🛠️ Prerequisites

- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher
- **Python**: `3.10+` *(required for hosting the local Laya Decision API server)*

---

## 🚀 Quick Start & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/Adil-km/sudoku_game.git
cd sudoku_game
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Environment Configuration

Copy the example environment file to create your local `.env`:

```bash
cp .env.example .env
```

*(On Windows Command Prompt / PowerShell: `copy .env.example .env`)*

#### Available Environment Variables:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `VITE_LAYA_API_URL` | `http://127.0.0.1:8000` | Base URL of the running Laya Decision API server. |
| `VITE_LAYA_PROXY_PATH` | `/laya-api` | Local Vite proxy prefix used to bypass browser CORS preflight during development. |

---

## 🧠 Running the Local Laya AI Server

The project includes a FastAPI backend server powered by **Laya** located in the `python_server/` directory.

### 1. Create and Activate a Python Virtual Environment

```bash
# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.\.venv\Scripts\activate

# On Windows (Command Prompt):
.\.venv\Scripts\activate.bat

# On Linux / macOS:
source .venv/bin/activate
```

### 2. Install Python Dependencies

```bash
pip install -r python_server/requirements.txt
```

### 3. Start the Laya Server

```bash
python python_server/server.py
```

*Alternatively, using uvicorn directly:*

```bash
uvicorn python_server.server:app --host 127.0.0.1 --port 8000
```

### 4. Verify Server Health

Once started, verify the server is active:
- **Health check**: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **Interactive API Docs (Swagger)**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

> **Note**: If the Laya server is offline, you can still play regular Sudoku manually! The AI panel in the app will indicate offline status until the server starts.

---

## 💻 Running the Frontend Application

Start the Vite development server:

```bash
npm run dev
```

Open your browser and navigate to **`http://localhost:5173`**.

---

## 📦 Available Scripts

- `npm run dev`: Launch the local development server with Hot Module Replacement (HMR).
- `npm run build`: Type-check with `tsc` and create an optimized production build in `dist/`.
- `npm run preview`: Locally serve the production build to preview performance.
- `npm run lint`: Fast code linting using [Oxlint](https://oxc.rs).

---

## 📁 Project Architecture

```
sudoku_game/
├── .env.example             # Example environment configuration
├── .gitignore               # Ignored files (including local .env & .venv)
├── index.html               # App entry HTML
├── package.json             # Scripts & dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite config with dynamic API proxy forwarding
├── python_server/           # Laya local decision API server
│   ├── requirements.txt     # Python server dependencies
│   └── server.py            # FastAPI server entrypoint
└── src/
    ├── App.tsx              # Main application view & layout
    ├── index.css            # Custom CSS & design system tokens
    ├── main.tsx             # React root mount
    ├── types.ts             # Shared game & AI controller types
    ├── vite-env.d.ts        # Typed Vite environment definitions
    ├── components/
    │   ├── Board.tsx        # Responsive Sudoku board renderer
    │   ├── Cell.tsx         # Individual cell component (conflict & highlight states)
    │   ├── Controls.tsx     # Number pads, action buttons, & timer
    │   ├── Header.tsx       # Difficulty & grid selector header
    │   └── LayaPanel.tsx    # Laya AI control & real-time telemetry card
    ├── services/
    │   └── layaService.ts   # Laya API integration, pipelining, & autoplay state machine
    └── sudoku/
        ├── config.ts        # Board dimensions & block rules (4x4, 6x6, 9x9)
        ├── generator.ts     # Sudoku puzzle generation & backtracking solver
        └── validator.ts     # Rule validation & candidate extraction
```
