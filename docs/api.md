# API GeoProspector

Cette page décrit les routes disponibles pour le frontend. La documentation interactive est disponible sur [`/api/docs/`](http://localhost:8000/api/docs/) et le schéma OpenAPI sur `/api/schema/`.

Dans le navigateur, le frontend utilise des chemins relatifs, par exemple `/api/equipements/`. Vite relaie `/api/` vers le service Django `backend:8000`. Les commandes `curl` ci-dessous utilisent `http://localhost:8000`.

Toutes les géométries GeoJSON utilisent le SRID 4326 et l’ordre `[longitude, latitude]`. Les codes de domaines et les codes géographiques sont des chaînes.

## Authentification

### Inscription

```bash
curl -X POST http://localhost:8000/api/auth/register/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"lea","password":"UnMotDePasseSolide-2026!"}'
```

Réponse `201 Created` :

```json
{"username":"lea"}
```

Le mot de passe est vérifié par les validateurs configurés dans Django et n’est jamais renvoyé.

### Obtenir les jetons

```bash
curl -X POST http://localhost:8000/api/auth/token/ \
  -H 'Content-Type: application/json' \
  -d '{"username":"lea","password":"UnMotDePasseSolide-2026!"}'
```

Réponse `200 OK` :

```json
{"refresh":"<refresh>","access":"<access>"}
```

Les routes privées attendent le jeton d’accès :

```http
Authorization: Bearer <access>
```

### Renouveler le jeton d’accès

```bash
curl -X POST http://localhost:8000/api/auth/token/refresh/ \
  -H 'Content-Type: application/json' \
  -d '{"refresh":"<refresh>"}'
```

La réponse contient un nouveau jeton `access`.

## Équipements BPE

### Lister dans une zone

```http
GET /api/equipements/?in_bbox=-5.5,47.0,0.0,49.0&ville=Rennes&ville=Brest&domaine1=B
```

`in_bbox` est obligatoire et suit l’ordre `ouest,sud,est,nord`. Une bbox absente ou invalide renvoie `400 Bad Request`.

Les valeurs répétées d’un même filtre se combinent avec OU (`ville=Rennes&ville=Brest`). Des filtres différents se combinent avec ET. Les filtres facultatifs sont `domaine1`, `domaine2`, `domaine3` et `ville`.

La réponse est directement une `FeatureCollection`, sans enveloppe `results` :

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "id": "b1f96e28-f812-4c85-8d0e-ca454fd55553",
      "geometry": {"type": "Point", "coordinates": [-1.6778, 48.1173]},
      "properties": {
        "nom": "Équipement de démonstration",
        "domaine3": "B203"
      }
    }
  ]
}
```

La liste conserve seulement les propriétés utiles à l’affichage cartographique : `nom` et `domaine3`.

### Obtenir le détail

```http
GET /api/equipements/<uuid>/
```

Le détail ne demande pas `in_bbox`. Il renvoie une GeoJSON `Feature` avec les propriétés de la liste et `adresse`, `codepostal`, `ville`, `dept` et `siret`.

### Domaines et villes

```http
GET /api/domaines/
GET /api/villes/
```

`/api/domaines/` renvoie l’arbre des domaines (`code`, `libelle`, `enfants`). `/api/villes/` renvoie un tableau de noms distincts, par exemple `["Brest", "Rennes"]`.

## Implantations privées

Toutes les routes d’implantations exigent une authentification JWT. Chaque utilisateur ne voit que ses propres points. Un autre utilisateur qui connaît l’identifiant d’un point reçoit `404 Not Found` pour le lire, le modifier ou le supprimer.

### Lister et créer

```http
GET /api/implantations/
POST /api/implantations/
Authorization: Bearer <access>
```

Pour créer un point, envoyer une Feature :

```json
{
  "type": "Feature",
  "geometry": {"type": "Point", "coordinates": [-1.6778, 48.1173]},
  "properties": {
    "titre": "Agence de Rennes",
    "commentaire": "Ouverture prévue en septembre.",
    "domaine3": "B203"
  }
}
```

`domaine3` reçoit un code sous forme de chaîne ou `null`. Le serveur attribue le point à l’utilisateur du jeton; le client ne choisit pas le propriétaire.

La création répond `201 Created` avec une Feature. L’identifiant entier est au niveau supérieur; `created_at` et `updated_at` sont dans `properties` :

```json
{
  "type": "Feature",
  "id": 42,
  "geometry": {"type": "Point", "coordinates": [-1.6778, 48.1173]},
  "properties": {
    "titre": "Agence de Rennes",
    "commentaire": "Ouverture prévue en septembre.",
    "domaine3": "B203",
    "created_at": "2026-11-27T10:00:00Z",
    "updated_at": "2026-11-27T10:00:00Z"
  }
}
```

La liste répond avec une `FeatureCollection` privée.

### Lire, modifier et supprimer

```http
GET /api/implantations/42/
PATCH /api/implantations/42/
DELETE /api/implantations/42/
Authorization: Bearer <access>
```

Pour déplacer un point sans modifier ses propriétés, envoyer seulement la géométrie :

```json
{
  "geometry": {"type": "Point", "coordinates": [-1.5, 48.2]}
}
```

Le titre, le commentaire et le domaine existants sont conservés. Pour modifier seulement des propriétés, envoyer uniquement celles-ci :

```json
{
  "properties": {"commentaire": "Nouvelle note"}
}
```

Une suppression réussie répond `204 No Content`. Une requête privée anonyme répond `401 Unauthorized`.
