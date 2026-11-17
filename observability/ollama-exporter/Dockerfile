FROM python:3.12-alpine

WORKDIR /app
COPY exporter.py /app/exporter.py

ENV OLLAMA_HOST=http://ollama:11434
ENV LISTEN_ADDR=0.0.0.0:11435
ENV POLL_INTERVAL_SECONDS=15

EXPOSE 11435
CMD ["python", "-u", "/app/exporter.py"]
