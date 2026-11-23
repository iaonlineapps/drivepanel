FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DRIVE_DATA=/data
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY entrypoint.sh /entrypoint.sh
# el contenedor corre como usuario normal: el codigo tiene que ser legible
# aunque se haya copiado con permisos restrictivos (por ejemplo desde Windows)
RUN chmod -R a+rX /app && chmod 755 /entrypoint.sh

EXPOSE 8090
HEALTHCHECK --interval=60s --timeout=5s --retries=3 \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8090/static/style.css')" || exit 1
ENTRYPOINT ["/entrypoint.sh"]
# Un solo proceso: suficiente para la Pi y necesario para SQLite + caches en memoria
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8090", "--proxy-headers", "--forwarded-allow-ips", "*", "--no-access-log"]
