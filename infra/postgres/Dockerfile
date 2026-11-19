# Resmi postgres imajı çok mimarili (Apple Silicon dahil); PostGIS PGDG deposundan kurulur.
# CI'da aynı sürümler için resmi postgis/postgis:18-3.6 imajı kullanılır.
FROM postgres:18-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-18-postgis-3 \
  && rm -rf /var/lib/apt/lists/*

COPY init/ /docker-entrypoint-initdb.d/
