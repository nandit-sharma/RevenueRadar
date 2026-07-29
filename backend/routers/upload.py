from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import io
import re
from services.datastore import set_dataframe, get_dataframe, clear_dataframe, get_session_metadata
from services.rag_engine import build_rag_index, has_index, reset_rag_index

router = APIRouter()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean_column_name(col: str) -> str:
    col = col.lower().strip()
    col = re.sub(r'[^a-z0-9_]', '_', col)
    col = re.sub(r'_+', '_', col)
    return col.strip('_')


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    # Rename columns to snake_case
    df.columns = [clean_column_name(c) for c in df.columns]

    # Drop fully empty rows / columns
    df = df.dropna(how='all')
    df = df.dropna(axis=1, how='all')

    # Fill numeric NaNs with median
    for col in df.select_dtypes(include='number').columns:
        df[col] = df[col].fillna(df[col].median())

    # Fill string NaNs with 'Unknown'
    for col in df.select_dtypes(include='object').columns:
        df[col] = df[col].fillna('Unknown')

    # 1. Map Revenue / Sales
    if 'revenue' not in df.columns:
        revenue_kws = ('revenue', 'sales', 'income', 'amount', 'total', 'price', 'turnover', 'earnings', 'val', 'cost', 'grand_total', 'gross', 'net')
        found_rev = False
        for col in df.columns:
            if any(kw in col for kw in revenue_kws):
                df['revenue'] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                found_rev = True
                break
        if not found_rev:
            num_cols = df.select_dtypes(include='number').columns
            if len(num_cols) > 0:
                df['revenue'] = df[num_cols[0]]
            else:
                df['revenue'] = 100.0

    # Ensure revenue is numeric and positive
    df['revenue'] = pd.to_numeric(df['revenue'], errors='coerce').fillna(0).abs()

    # 2. Map Location / Branch / Store / City / Region
    if 'location' not in df.columns:
        loc_kws = ('location', 'city', 'branch', 'store', 'region', 'country', 'site', 'address', 'state', 'zone', 'area', 'place')
        found_loc = False
        for col in df.columns:
            if any(kw in col for kw in loc_kws):
                df['location'] = df[col].astype(str)
                found_loc = True
                break
        if not found_loc:
            str_cols = [c for c in df.select_dtypes(include='object').columns if c not in ('revenue', 'location')]
            if str_cols:
                df['location'] = df[str_cols[0]].astype(str)
            else:
                df['location'] = 'Main Location'

    # 3. Map Cuisine / Category / Product / Type
    if 'cuisine' not in df.columns:
        cuis_kws = ('cuisine', 'category', 'product', 'type', 'segment', 'item', 'department', 'group', 'genre', 'service', 'kind')
        found_cuis = False
        for col in df.columns:
            if any(kw in col for kw in cuis_kws):
                df['cuisine'] = df[col].astype(str)
                found_cuis = True
                break
        if not found_cuis:
            str_cols = [c for c in df.select_dtypes(include='object').columns if c not in ('revenue', 'location', 'cuisine')]
            if str_cols:
                df['cuisine'] = df[str_cols[0]].astype(str)
            else:
                df['cuisine'] = 'General'

    # 4. Map Name / Entity
    if 'name' not in df.columns:
        name_kws = ('name', 'store_name', 'product_name', 'restaurant', 'customer', 'title', 'entity', 'item_name')
        found_name = False
        for col in df.columns:
            if any(kw in col for kw in name_kws):
                df['name'] = df[col].astype(str)
                found_name = True
                break
        if not found_name:
            df['name'] = df['location'] + ' - ' + df['cuisine']

    # 5. Map Date / Month
    has_date = False
    date_kws = ('date', 'month', 'time', 'period', 'year', 'timestamp', 'created', 'day')
    for col in df.columns:
        if col in ('month', 'year', 'month_num'):
            continue
        if any(kw in col for kw in date_kws):
            try:
                parsed = pd.to_datetime(df[col], errors='coerce')
                if parsed.notna().sum() > len(df) * 0.3:
                    df['month'] = parsed.dt.strftime('%Y-%m-%d')
                    df['year'] = parsed.dt.year
                    df['month_num'] = parsed.dt.month
                    has_date = True
                    break
            except Exception:
                pass

    if not has_date or 'month' not in df.columns:
        # Generate synthetic dates across recent months for trend/forecast/seasonality analysis
        num_rows = len(df)
        base_dates = pd.date_range(end=pd.Timestamp.now(), periods=max(num_rows, 12), freq='MS')
        df['month'] = [base_dates[i % len(base_dates)].strftime('%Y-%m-%d') for i in range(num_rows)]
        df['year'] = [base_dates[i % len(base_dates)].year for i in range(num_rows)]
        df['month_num'] = [base_dates[i % len(base_dates)].month for i in range(num_rows)]

    # 6. Map Rating & Service Quality
    if 'rating' not in df.columns:
        df['rating'] = 4.5
    else:
        df['rating'] = pd.to_numeric(df['rating'], errors='coerce').fillna(4.5)

    if 'service_quality_score' not in df.columns:
        df['service_quality_score'] = 8.5
    else:
        df['service_quality_score'] = pd.to_numeric(df['service_quality_score'], errors='coerce').fillna(8.5)

    return df


def _parse_csv(content: bytes) -> pd.DataFrame:
    """Try multiple encodings and delimiters to parse a CSV flexibly."""
    # 1. Try common encodings and explicit delimiters
    for encoding in ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'utf-16']:
        for sep in [',', ';', '\t', '|']:
            try:
                df = pd.read_csv(io.BytesIO(content), encoding=encoding, sep=sep, on_bad_lines='skip')
                if not df.empty and len(df.columns) > 1:
                    print(f"[Upload] Parsed CSV with encoding={encoding}, sep='{sep}' ({len(df)} rows, {len(df.columns)} cols)")
                    return df
            except Exception:
                continue

    # 2. Try python auto-sniffer
    for encoding in ['utf-8', 'latin-1', 'cp1252']:
        try:
            df = pd.read_csv(io.BytesIO(content), encoding=encoding, sep=None, engine='python', on_bad_lines='skip')
            if not df.empty:
                print(f"[Upload] Parsed CSV via python sniffer with encoding={encoding} ({len(df)} rows, {len(df.columns)} cols)")
                return df
        except Exception:
            continue

    # 3. Fallback: standard CSV default
    try:
        df = pd.read_csv(io.BytesIO(content), on_bad_lines='skip')
        if not df.empty:
            return df
    except Exception:
        pass

    raise ValueError("Could not parse CSV file format. Please ensure valid CSV structure.")



def _parse_xml(content: bytes) -> pd.DataFrame:
    """Flexibly parse XML files into a DataFrame."""
    errors = []

    # Strategy 1: pandas read_xml (handles simple flat XML)
    try:
        df = pd.read_xml(io.BytesIO(content))
        if not df.empty and len(df.columns) > 0:
            print("[Upload] Parsed XML via pandas read_xml")
            return df
    except Exception as e:
        errors.append(f"pandas read_xml: {e}")

    # Strategy 2: lxml etree — manually walk element tree
    try:
        from lxml import etree
        root = etree.fromstring(content)

        tag_counts: dict = {}
        for child in root:
            tag = etree.QName(child.tag).localname
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

        if not tag_counts:
            raise ValueError("XML root has no children")

        row_tag = max(tag_counts, key=tag_counts.get)
        rows = root.findall(f'.//{row_tag}')

        records = []
        for row in rows:
            record = {}
            for attr_name, attr_val in row.attrib.items():
                record[attr_name] = attr_val
            for child in row:
                local = etree.QName(child.tag).localname
                val = (child.text or '').strip()
                if local in record:
                    record[f"{local}_2"] = val
                else:
                    record[local] = val
            if record:
                records.append(record)

        if records:
            df = pd.DataFrame(records)
            for col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='ignore')
            print(f"[Upload] Parsed XML via lxml etree: {len(records)} rows, tag=<{row_tag}>")
            return df
        else:
            raise ValueError("No records found under row tag")

    except Exception as e:
        errors.append(f"lxml etree: {e}")

    raise ValueError(f"Could not parse XML file. Errors: {'; '.join(errors)}")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload-csv")
@router.post("/start-session")
async def start_analysis_session(file: UploadFile = File(...)):
    """Upload CSV/XML and start active analysis session."""
    filename_lower = (file.filename or '').lower()
    is_csv = filename_lower.endswith('.csv')
    is_xml = filename_lower.endswith('.xml')

    if not (is_csv or is_xml):
        raise HTTPException(
            status_code=400,
            detail="Only CSV (.csv) and XML (.xml) files are supported"
        )

    try:
        content = await file.read()

        if not content:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")

        df = _parse_csv(content) if is_csv else _parse_xml(content)

        if df is None or df.empty:
            raise HTTPException(status_code=400, detail="File parsed but contains no data rows")

        df = clean_dataframe(df)

        if 'revenue' not in df.columns:
            numeric_cols = df.select_dtypes(include='number').columns
            if len(numeric_cols) > 0:
                df['revenue'] = df[numeric_cols[0]]
            else:
                raise HTTPException(
                    status_code=400,
                    detail="File must contain a revenue/sales/amount column or at least one numeric column"
                )

        # Set active session dataframe
        set_dataframe(df, filename=file.filename or "uploaded_data")

        # Build RAG index
        num_chunks = build_rag_index(df)

        # Convert preview to JSON-serializable format (convert numpy/pandas types to Python native types)
        import numpy as np
        preview_data = df.head(5).to_dict(orient='records')
        for record in preview_data:
            for key, val in record.items():
                if isinstance(val, (np.integer, np.floating)):
                    record[key] = val.item()
                elif isinstance(val, (pd.Timestamp, pd.NaT)):
                    record[key] = str(val) if pd.notna(val) else None

        file_type = "CSV" if is_csv else "XML"
        return {
            "success": True,
            "message": f"Started analysis session for {file.filename} ({len(df)} records)",
            "file_type": file_type,
            "columns": list(df.columns),
            "rows": len(df),
            "rag_chunks": num_chunks,
            "filename": file.filename,
            "session": get_session_metadata(),
            "preview": preview_data
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        import traceback
        print(f"[Upload] Error: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to process file: {str(e)}")


@router.post("/end-session")
async def end_analysis_session():
    """End active session, clear memory dataframe and RAG index."""
    clear_dataframe()
    reset_rag_index()
    return {
        "success": True,
        "message": "Analysis session ended. Memory and index cleared."
    }


@router.get("/upload-status")
@router.get("/session-status")
async def session_status():
    """Check if session is active and RAG index is ready."""
    meta = get_session_metadata()
    df = get_dataframe()
    has_data = df is not None and not df.empty
    return {
        "has_data": has_data,
        "active": meta.get("active", False),
        "filename": meta.get("filename", ""),
        "rows": meta.get("rows", 0 if not has_data else len(df)),
        "columns": meta.get("columns", [] if not has_data else list(df.columns)),
        "rag_ready": has_index() if has_data else False,
    }


@router.get("/dataset/rows")
async def get_dataset_rows(page: int = 1, limit: int = 50, search: str = ""):
    """Get paginated dataset rows for live data table explorer."""
    from services.datastore import get_paginated_rows
    return get_paginated_rows(page=page, limit=limit, search=search)


@router.get("/dataset/schema")
async def get_dataset_schema_route():
    """Get dataset schema and summary column metrics."""
    from services.datastore import get_dataset_schema
    return {"schema": get_dataset_schema()}


@router.get("/dataset/columns")
async def get_dataset_columns():
    """Get all column names split into numeric and categorical lists for column selector UI."""
    from services.datastore import get_dataframe
    import pandas as pd
    df = get_dataframe()
    if df is None or df.empty:
        return {"numeric": [], "categorical": [], "all": []}
    numeric_cols = [c for c in df.columns if pd.api.types.is_numeric_dtype(df[c])]
    categorical_cols = [c for c in df.columns if not pd.api.types.is_numeric_dtype(df[c])]
    return {
        "numeric": numeric_cols,
        "categorical": categorical_cols,
        "all": list(df.columns),
    }

