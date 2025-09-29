FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

# Use Gunicorn for production
CMD ["gunicorn", "app:app", "-w", "4", "--bind", "0.0.0.0:5000"]