from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import upload, kpis, insights, forecasting, chat, alerts, compare

app = FastAPI(
    title="RevenueRadar API",
    description="AI-Powered Revenue Intelligence Platform",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["Upload"])
app.include_router(kpis.router, prefix="/api", tags=["KPIs"])
app.include_router(insights.router, prefix="/api", tags=["Insights"])
app.include_router(forecasting.router, prefix="/api", tags=["Forecasting"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(alerts.router, prefix="/api", tags=["Alerts"])
app.include_router(compare.router, prefix="/api", tags=["Compare"])

@app.get("/")
def root():
    return {"message": "RevenueRadar API is running", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}
