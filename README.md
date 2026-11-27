# tp-docker-django

# GeoProspector

Carte des équipements BPE 2025 (INSEE) de la région Bretagne, avec gestion d'implantations commerciales privées.

Stack : Django + GeoDjango, PostgreSQL/PostGIS, React, Docker Compose.

## Installation

Prérequis : Docker Desktop lancé, Git.

```bash
git clone https://github.com/aristideaphpro/tp-docker-django.git
cd tp-docker-django
cp .env.example .env
docker compose up --build db backend
```

Les migrations s'appliquent au démarrage. Vérification :

```bash
curl http://localhost:8000/api/health/
# {"status": "ok", "postgis": "3.6 ..."}
```

## Import des données

1. Télécharger https://data.atontour.info/bpe25.parquet.zip, le dézipper et placer `bpe25_clean.parquet` dans `data/` (ignoré par Git).
2. Lancer l'import (backend démarré) :

```bash
docker compose exec backend python manage.py import_bpe /data/bpe25_clean.parquet --region 53
```

Résultat attendu pour la Bretagne : 134 810 lignes lues, 130 508 équipements importés, 4 302 rejetés (sans coordonnées). L'import peut être relancé sans créer de doublons.

Vérifications :

```bash
# Équipements par département (22, 29, 35, 56)
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT dept_id, COUNT(*) FROM bpe_equipement GROUP BY dept_id ORDER BY dept_id;"'

# Absence de doublons (les deux nombres doivent être égaux)
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT COUNT(*), COUNT(DISTINCT id) FROM bpe_equipement;"'
```

## Utilisation

À compléter (frontend, API).