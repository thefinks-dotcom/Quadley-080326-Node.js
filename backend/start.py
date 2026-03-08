import os
port = os.environ.get("PORT", "8000")
os.execvp("uvicorn", ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", port])
