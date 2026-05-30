from fastapi import FastAPI

app = FastAPI()

@app.get("/api/ping_app")
async def ping():
    return {"status": "ok"}
