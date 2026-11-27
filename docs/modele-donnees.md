# Modèle de données

Base PostgreSQL 18 + PostGIS 3.6. Tables de l'app `bpe` :

| Table | Clé primaire | Champs | Clés étrangères |
|---|---|---|---|
| `bpe_region` | `id_region` (varchar 3) | `libelle` | |
| `bpe_dept` | `id_dept` (varchar 3) | `libelle` | `region` → bpe_region |
| `bpe_domaine1` | `code` (varchar 1) | `libelle` | |
| `bpe_domaine2` | `code` (varchar 2) | `libelle` | `domaine1` → bpe_domaine1 |
| `bpe_domaine3` | `code` (varchar 4) | `libelle` | `domaine2` → bpe_domaine2 |
| `bpe_equipement` | `id` (UUID) | `nom`, `adresse`, `codepostal`, `ville`, `siret`, `geom` | `domaine3` → bpe_domaine3, `dept` → bpe_dept |

`geom` : point (longitude, latitude), SRID 4326, avec index spatial. Un index existe aussi sur `ville`.

## Passage du parquet au modèle relationnel

Le fichier parquet est une table plate. L'import (`import_bpe`) :
1. lit uniquement les lignes de la région demandée ;
2. rejette les lignes sans coordonnées, sans domaine, sans département ou avec un identifiant invalide ;
3. crée les régions, départements et domaines, puis les équipements par lots de 5 000 ;
4. met à jour les lignes existantes au lieu de les dupliquer (import relançable).

Les libellés des régions et départements ne sont pas dans le parquet : ils sont définis dans le script.