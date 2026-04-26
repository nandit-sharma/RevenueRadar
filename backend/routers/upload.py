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
    if not file.filename.lower().endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    try:
        content = await file.read()
        
        # Try different encodings
        df = None
        for encoding in ['utf-8', 'latin-1', 'cp1252', 'utf-16']:
            try:
                df = pd.read_csv(io.BytesIO(content), encoding=encoding)
                print(f"Successfully parsed CSV with {encoding} encoding")
                break
            except Exception:
                continue
        
        if df is None:
            raise Exception("Could not parse CSV with common encodings (UTF-8, Latin-1, etc.)")

        if df.empty:
            raise HTTPException(status_code=400, detail="The uploaded CSV file is empty")

        # Basic validation: check if there's at least one numeric column for revenue
        df = clean_dataframe(df)
        
        if 'revenue' not in df.columns:
            # Check if we can find any numeric column that might be revenue
            numeric_cols = df.select_dtypes(include='number').columns
            if len(numeric_cols) > 0:
                # Use the first numeric column as revenue if 'revenue' is not found
                df['revenue'] = df[numeric_cols[0]]
            else:
                raise HTTPException(status_code=400, detail="CSV must contain a 'revenue' column or at least one numeric column")

        set_dataframe(df)

        return {
            "success": True,
            "message": f"Successfully uploaded {len(df)} records",
            "columns": list(df.columns),
            "rows": len(df),
            "preview": df.head(5).to_dict(orient='records')
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print(f"Upload error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")
