# KMovement Cloud Run Deployment Notes

## Current Target

Cloud Run service:

```text
https://kmovement-46122739597.europe-west1.run.app/
```

As of 2026-06-29 this URL responds with the default Cloud Run placeholder page,
so the service exists but the KMovement app is not deployed to it yet.

## Recommended Scope

Use Cloud Run for the CPU FastAPI gateway/API layer.

Keep heavy GPU generation on RunPod or another GPU runtime:

- Tora / CogVideoX
- GPT-SoVITS
- MusicGen
- AnimatedDrawings / TorchServe GPU

The FastAPI app can call those services through `RUNPOD_API_KEY`,
`RUNPOD_ENDPOINT_ID`, and `RUNPOD_TORA_ENDPOINT_ID`.

## FastAPI Container

Build from repository root with:

```text
Dockerfile path: Dockerfile
Build context: repository root
```

The root Dockerfile is for Cloud Run source builds. It honors Cloud Run's
injected `PORT` environment variable and defaults to `8080`. The
`src/api/Dockerfile` path remains available for the existing CI/GCP VM workflow
and local/API-specific builds.

Health check path:

```text
/api/health
```

Expected public health URL after a successful deployment:

```text
https://kmovement-46122739597.europe-west1.run.app/api/health
```

## Required Environment Variables

Minimum recommended Cloud Run env vars:

```text
TORCHSERVE_ENABLED=false
TORCHSERVE_FALLBACK=true
CHROMA_MODE=persistent
CHROMA_PATH=/app/chroma_db
KRIDE_MODELS_DIR=/app/dataset/models
KRIDE_RAW_DATA_DIR=/app/dataset/data/raw_ml
HF_HOME=/tmp/hf_cache
TRANSFORMERS_CACHE=/tmp/hf_cache/hub
```

Set these if the related features should be live:

```text
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
NEO4J_DATABASE
SUPABASE_URL
SUPABASE_KEY
GROQ_API_KEY
RUNPOD_API_KEY
RUNPOD_ENDPOINT_ID
RUNPOD_TORA_ENDPOINT_ID
FASTAPI_INTERNAL_API_KEY
```

## Recommended Runtime Settings

```text
Memory: 2Gi
CPU: 1
Timeout: 300 seconds
Concurrency: 10
Minimum instances: 0
Maximum instances: 3
```

The local ChromaDB snapshot is about 118 MB and `route_graph.pkl` is about
71 MB. The container also installs CPU Torch, so the default Cloud Run memory
setting is likely too small.

## Console Steps

1. Open Cloud Run service `kmovement`.
2. Click `Edit & deploy new revision`.
3. Use a container image built from `src/api/Dockerfile`, or configure the
   repository build to use the root Dockerfile:

```text
Dockerfile: Dockerfile
Context: repository root
```

4. Set container port to Cloud Run default or leave it managed. The container
   will listen on `$PORT`.
5. Add the environment variables above.
6. Deploy.
7. Verify:

```text
GET /api/health
GET /api/artists
GET /api/regions
```

## GitHub Actions Deploy

Workflow:

```text
.github/workflows/deploy-cloud-run.yml
```

The workflow builds the Docker image on the GitHub runner, pushes it to
Artifact Registry, then deploys that image to Cloud Run. This avoids the
`gcloud run deploy --source .` source-upload path that requires permission to
create a temporary Cloud Storage bucket.

Defaults:

```text
GCP_PROJECT_ID=quartz-kiba
GCP_REGION=europe-west1
CLOUD_RUN_SERVICE=kmovement
GAR_REPO=kmovement
CLOUD_RUN_MEMORY=2Gi
CLOUD_RUN_CPU=1
CLOUD_RUN_TIMEOUT=300s
CLOUD_RUN_CONCURRENCY=10
CLOUD_RUN_MIN_INSTANCES=0
CLOUD_RUN_MAX_INSTANCES=3
```

Set `GCP_SA_KEY` as a GitHub Actions secret for the active `quartz-kiba`
project. Optional repository variables can override the defaults above:

```text
GCP_PROJECT_ID
GCP_REGION
CLOUD_RUN_SERVICE
GAR_REPO
CLOUD_RUN_MEMORY
CLOUD_RUN_CPU
CLOUD_RUN_TIMEOUT
CLOUD_RUN_CONCURRENCY
CLOUD_RUN_MIN_INSTANCES
CLOUD_RUN_MAX_INSTANCES
```

Run the workflow manually from GitHub Actions, or push changes to `main` that
touch the FastAPI app, root Dockerfile, required dataset files, or
`.github/workflows/deploy-cloud-run.yml`.

Minimum roles for the GitHub deploy service account:

```text
roles/run.admin
roles/artifactregistry.admin
roles/iam.serviceAccountUser
```

`roles/cloudbuild.builds.editor` is only needed if you switch back to Cloud
Run source builds.

## EC2 Proxy Follow-up

If this Cloud Run service replaces the old GCP VM FastAPI endpoint, update EC2
Nginx and frontend/Spring env vars from:

```text
http://34.64.221.240:8000
```

to:

```text
https://kmovement-46122739597.europe-west1.run.app
```

Then `https://yerin.duckdns.org/kride-api/health` should proxy to:

```text
https://kmovement-46122739597.europe-west1.run.app/api/health
```
