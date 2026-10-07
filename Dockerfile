FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10001 --create-home mmsm \
    && mkdir -p /app/data /app/Servers /app/Backups /app/dependencies && chown -R mmsm:mmsm /app
WORKDIR /app
COPY --chown=mmsm:mmsm mmsm/ /app/mmsm/
USER mmsm
ENV PYTHONUNBUFFERED=1 MMSM_DATA=/app/data MMSM_HOST=0.0.0.0
VOLUME ["/app/data", "/app/Servers", "/app/Backups", "/app/dependencies"]
EXPOSE 11015 25565
STOPSIGNAL SIGTERM
CMD ["python", "-m", "mmsm"]
