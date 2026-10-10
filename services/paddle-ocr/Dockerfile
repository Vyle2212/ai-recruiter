FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
WORKDIR /worker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY worker.py .
RUN useradd --create-home ocr
USER ocr
ENV PORT=8080
EXPOSE 8080
CMD ["python", "worker.py"]
