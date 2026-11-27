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

### Lancer l’application

```bash
docker compose up --build
```

Démarre la base, le backend et le frontend, puis ouvrir **http://localhost:5173**.

| Adresse | Contenu |
| --- | --- |
| http://localhost:5173 | Application (carte) |
| http://localhost:8000/api/docs/ | Documentation interactive de l’API (Swagger) |
| http://localhost:8000/api/health/ | État du backend et de PostGIS |

Si le backend redémarre pendant que la page est ouverte, recharger la page : les filtres (domaines, villes) ne sont chargés qu’à l’ouverture.

Sans Docker pour le frontend (backend toujours dans Docker) :

```bash
cd frontend
npm install
API_PROXY_TARGET=http://localhost:8000 npm run dev
```

### Explorer les équipements

- La carte charge les équipements de la zone affichée ; un déplacement ou un zoom charge les zones manquantes. À l’échelle de toute la Bretagne (vue initiale), cela représente environ 130 000 points : le premier affichage prend plusieurs secondes. Zoomer sur une ville est beaucoup plus rapide.
- **Filtres** : domaines BPE sur trois niveaux (OU entre branches cochées) et villes (OU entre villes) ; les deux se combinent par un ET.
- **Barre de recherche** :
  - le texte saisi filtre les équipements affichés par **nom** ;
  - **Entrée** localise une **adresse ou une ville** (service de géocodage de la Géoplateforme IGN), centre la carte dessus et la marque d’un point rouge. Une alerte s’affiche si l’adresse est hors Bretagne, car seuls les équipements bretons sont importés.
- Cliquer sur un équipement ouvre sa fiche (adresse, département, SIRET).

### Gérer ses implantations

Les implantations sont des points privés : chaque utilisateur ne voit que les siens.

1. Créer un compte (l’interface ne propose que la connexion) :

   ```bash
   curl -X POST http://localhost:8000/api/auth/register/ \
     -H 'Content-Type: application/json' \
     -d '{"username":"lea","password":"UnMotDePasseSolide-2026!"}'
   ```

2. Onglet **Implantations** → se connecter.
3. **Ajouter un emplacement** : saisir un nom, une **adresse** (géocodée automatiquement), un domaine BPE facultatif et un commentaire.
4. **Déplacer** : glisser-déposer le marqueur ★ sur la carte ; la nouvelle position est enregistrée aussitôt (en cas d’échec, le marqueur revient à sa place).
5. **Modifier / Supprimer** : depuis la fiche du marqueur ou la liste de l’onglet. En modification, laisser l’adresse vide conserve la position actuelle.

La session dure 30 minutes et se renouvelle automatiquement pendant 7 jours.

### API

Routes, paramètres et exemples : [docs/api.md](docs/api.md). Modèle de données : [docs/modele-donnees.md](docs/modele-donnees.md).