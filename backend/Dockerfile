FROM python:3.12-slim

ARG NIXPACKS_PATH
ENV PATH="${NIXPACKS_PATH:+$NIXPACKS_PATH:}$PATH"

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements-prod.txt .
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["python3", "start.py"]
