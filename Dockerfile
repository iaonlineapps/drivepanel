FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 DRIVE_DATA=/data
# Version que se ve en la web; la imagen publicada la recibe de la etiqueta (v1.2.3)
ARG DRIVEPANEL_VERSION=
ENV DRIVEPANEL_VERSION=${DRIVEPANEL_VERSION}
WORKDIR /app
COPY requirements.txt .
# En Raspberry Pi de 32 bits (armv7) no hay Pillow ya compilado: se compila aquí
# y luego se quitan las herramientas para que la imagen siga siendo pequeña.
ARG TARGETARCH
RUN if [ "$TARGETARCH" = "arm" ]; then \
      apt-get update && \
      apt-get install -y --no-install-recommends build-essential libjpeg62-turbo-dev zlib1g-dev \
        libwebp-dev libfreetype-dev && \
      pip install --no-cache-dir -r requirements.txt && \
      apt-get purge -y build-essential libjpeg62-turbo-dev zlib1g-dev libwebp-dev libfreetype-dev && \
      apt-get install -y --no-install-recommends libjpeg62-turbo zlib1g libwebp7 libwebpmux3 libwebpdemux2 libfreetype6 && \
      apt-get autoremove -y && rm -rf /var/lib/apt/lists/* ; \
    else \
      pip install --no-cache-dir -r requirements.txt ; \
    fi
COPY app ./app
# el contenedor corre como usuario normal: el codigo tiene que ser legible
# aunque se haya copiado con permisos restrictivos (por ejemplo desde Windows)
RUN chmod -R a+rX /app
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
