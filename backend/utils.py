import math
import numpy as np
import pandas as pd
from typing import Any

def sanitize_for_json(obj: Any) -> Any:
    """
    Recursively sanitize objects (dicts, lists, floats, dataframes) to ensure
    100% JSON compliance (replaces NaN/Inf with None/0, converts numpy types to native Python types).
    """
    if obj is None:
        return None

    if isinstance(obj, (float, np.floating)):
        if math.isnan(obj) or math.isinf(obj):
            return 0.0
        return float(obj)

    if isinstance(obj, (int, np.integer)):
        return int(obj)

    if isinstance(obj, (bool, np.bool_)):
        return bool(obj)

    if isinstance(obj, (str, pd.Timestamp)):
        return str(obj)

    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}

    if isinstance(obj, (list, tuple, np.ndarray, pd.Series)):
        return [sanitize_for_json(v) for v in obj]

    return str(obj)
