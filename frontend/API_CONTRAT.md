# Contrat API consommé par le frontend

Le contrat de référence est [`../docs/api.md`](../docs/api.md); Swagger est disponible sur `/api/docs/` et le schéma OpenAPI sur `/api/schema/` lorsque le backend tourne.

Le navigateur appelle des chemins relatifs `/api/...`. Vite relaie `/api` vers `http://backend:8000` dans Docker. En local hors Docker, définir `API_PROXY_TARGET=http://localhost:8000`.

## Équipements

### Liste dans l’emprise visible

```http
GET /api/equipements/?in_bbox=ouest,sud,est,nord&ville=Rennes&ville=Brest&domaine3=B203
```

`in_bbox` est obligatoire et doit respecter l’ordre longitude ouest, latitude sud, longitude est, latitude nord. Les coordonnées GeoJSON restent `[longitude, latitude]` en SRID 4326.

Filtres disponibles : `domaine1`, `domaine2`, `domaine3` et `ville`. Les valeurs répétées d’un paramètre se combinent avec OU; les paramètres différents se combinent avec ET. La liste renvoie une `FeatureCollection` légère. L’UUID est `Feature.id`; les propriétés de liste sont `nom` et `domaine3` (code).

### Fiche complète

```http
GET /api/equipements/<uuid>/
```

La fiche renvoie une `Feature` avec le même `id`, la géométrie, `nom`, `domaine3` et les propriétés détaillées `adresse`, `codepostal`, `ville`, `dept` et `siret`. Le détail ne requiert pas de bbox; le frontend le charge seulement à la sélection d’un point.

### Référentiels

```http
GET /api/domaines/
GET /api/villes/
```

Les domaines sont un arbre `code`, `libelle`, `enfants` sur trois niveaux. Les villes sont un tableau de noms. Le frontend peut accepter les villes sous forme de chaînes.

L’arbre permet de sélectionner des domaines de profondeurs différentes. Le frontend ramène alors les branches sélectionnées à un seul niveau de paramètre; ainsi, il conserve le OU entre branches sans envoyer des filtres de niveaux différents qui seraient combinés en ET par l’API.

## Configuration frontend

`VITE_USE_MOCK=false` utilise l’API réelle. Le mode fictif reste accessible en choisissant explicitement `VITE_USE_MOCK=true` pour le développement.
