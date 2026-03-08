"""
CSV Security Utility
====================
Provides sanitization functions for CSV export to prevent
formula injection attacks (OWASP A03).

Spreadsheet apps (Excel, Google Sheets) execute formulas when cells
start with: = + - @ \t \r \n
"""


def sanitize_csv_field(value) -> str:
    """
    Sanitize a single CSV field value to prevent formula injection.

    Prefixes dangerous leading characters with a single-quote so
    spreadsheet applications treat the cell as a literal string.
    """
    if value is None:
        return ""

    text = str(value)
    if not text:
        return text

    # Characters that trigger formula execution in spreadsheet apps
    if text[0] in ("=", "+", "-", "@", "\t", "\r", "\n"):
        return f"'{text}"

    return text


def sanitize_csv_row(row: list) -> list:
    """Sanitize every field in a CSV row."""
    return [sanitize_csv_field(field) for field in row]
