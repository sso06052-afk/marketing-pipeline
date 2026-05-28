FROM python:3.11-slim

WORKDIR /app

COPY pipeline/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY pipeline/ ./

EXPOSE 8000

CMD sh -c "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}"
