Render deployment (single service for frontend + backend)

Overview
- This project uses a multi-stage Dockerfile: the first stage builds the Vite frontend, the second stage installs Python deps and runs the FastAPI app which serves the built `dist/` files.

Quick local test
1. Build the Docker image:
```bash
docker build -t secure-gig-guardian .
```
2. Run the container (set PORT):
```bash
docker run -p 10000:10000 -e PORT=10000 secure-gig-guardian
```
3. Visit http://localhost:10000/ for the frontend or POST to http://localhost:10000/predict

Deploy to Render
1. Push your repo to GitHub.
2. Create a new Web Service on Render and choose "Docker" as the environment.
3. Connect your GitHub repo and set the branch.
4. Render will build the Dockerfile and run the service. No extra build/start commands are needed.

Notes & caveats
- The Docker image installs build tools for scikit-learn; image size may be relatively large.
- If `model.joblib` is large, consider hosting it externally or using a private storage bucket and download it at startup.
- Tighten CORS or environment-based configuration before production.
