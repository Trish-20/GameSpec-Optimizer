FROM python:3.11-slim

WORKDIR /app

COPY ml-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY MODULES /app/MODULES
COPY ml-service/app.py /app/app.py

ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-8080} app:app"]