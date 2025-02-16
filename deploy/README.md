# TGI Manager

A desktop application for managing and serving Hugging Face Text Generation Inference models locally.

## Features

- Configure and run TGI models with either CUDA or Llama.cpp backend
- Manage API keys for server access
- Automatic reverse proxy setup
- Support for gated models with Hugging Face tokens

## Installation

### Prerequisites

1. Node.js 16+ and npm
2. Python 3.8+
3. CUDA toolkit (for CUDA backend) or Llama.cpp (for CPU backend)

### Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Install Node.js dependencies:
```bash
npm install
```

3. Build the application:
```bash
npm run build
```

## Usage

1. Start the application:
```bash
npm start
```

2. Configure your model:
   - Enter the model ID (e.g., "meta-llama/Llama-2-7b-chat-hf")
   - Choose your backend (CUDA or Llama.cpp)
   - Enter your Hugging Face token if using gated models

3. Generate API keys:
   - Create new API keys for external access
   - Enable/disable keys as needed

4. Start the server:
   - Click "Start Server" to launch the TGI instance
   - The server will be accessible via the configured reverse proxy

## API Endpoints

The TGI server exposes the following endpoints:

- `POST /generate`: Generate text from the model
- `GET /health`: Check server health
- `GET /metrics`: Get server metrics

## Development

To run in development mode:

```bash
npm run dev
```

This will start both the Electron app and the FastAPI server with hot reloading.