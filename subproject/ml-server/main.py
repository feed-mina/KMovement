from fastapi import FastAPI

app = FastAPI(title="KMovement ML Service")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "KMovement ML service is running"}
