import os
from dotenv import load_dotenv

load_dotenv()

# BigQuery Config
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID", "your-gcp-project-id")
BIGQUERY_DATASET = os.getenv("BIGQUERY_DATASET", "revenue_radar")
BIGQUERY_TABLE = os.getenv("BIGQUERY_TABLE", "sales_data")

# AI Config
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Use in-memory store when BigQuery is not configured
USE_MOCK_DATA = os.getenv("USE_MOCK_DATA", "true").lower() == "true"

FULL_TABLE_ID = f"{GCP_PROJECT_ID}.{BIGQUERY_DATASET}.{BIGQUERY_TABLE}"
