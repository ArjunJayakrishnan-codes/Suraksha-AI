# Multi-stage Dockerfile: build Vite frontend, then run FastAPI backend serving static files

### Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm install --silent
RUN npm run build

### Run Python app
FROM python:3.11-slim
WORKDIR /app

# system deps (scikit-learn may require build tools on some platforms)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy built frontend
COPY --from=frontend-build /app/dist ./dist

# Copy Python code and requirements (include model.joblib if present)
COPY requirements.txt ./
COPY api_server.py dynamic_pricing.py model.joblib* ./

RUN pip install --no-cache-dir -r requirements.txt

ENV PORT 10000
EXPOSE 10000

# Use Uvicorn to run FastAPI; Render sets $PORT at runtime.
CMD ["uvicorn", "api_server:app", "--host", "0.0.0.0", "--port", "${PORT}"]
