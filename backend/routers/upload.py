from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import io
import re
from services.datastore import set_dataframe

router = APIRouter()

def clean_column_name(col: str) -> str:
    col = col.lower().strip()
    col = re.sub(r'[^a-z0-9_]', '_', col)
    col = re.sub(r'_+', '_', col)
    return col.strip('_')

def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    # Rename columns to snake_case
    df.columns = [clean_column_name(c) for c in df.columns]

    # Drop fully empty rows
    df = df.dropna(how='all')

    # Fill numeric NaNs with median
    for col in df.select_dtypes(include='number').columns:
        df[col] = df[col].fillna(df[col].median())

    # Fill string NaNs with 'Unknown'
    for col in df.select_dtypes(include='object').columns:
        df[col] = df[col].fillna('Unknown')

    # Try to detect month/date column
    for col in df.columns:
        if 'date' in col or 'month' in col or 'time' in col:
            try:
                df[col] = pd.to_datetime(df[col])
                df['month'] = df[col].dt.strftime('%Y-%m-%d')
                df['year'] = df[col].dt.year
                df['month_num'] = df[col].dt.month
            except Exception:
                pass

    # Ensure revenue column exists
    if 'revenue' not in df.columns:
        # Try to find it
        for col in df.columns:
            if 'revenue' in col or 'sales' in col or 'income' in col:
                df['revenue'] = df[col]
                break

    return df

@router.post("/upload-csv")
async def upload_csv(file: UploadFile = File(...)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        content = await file.read()
        df = pd.read_csv(io.StringIO(content.decode('utf-8')))
        df = clean_dataframe(df)
        set_dataframe(df)

        return {
            "success": True,
            "message": f"Successfully uploaded {len(df)} records",
            "columns": list(df.columns),
            "rows": len(df),
            "preview": df.head(5).to_dict(orient='records')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
