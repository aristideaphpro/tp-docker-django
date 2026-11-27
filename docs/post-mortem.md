# Post-mortem — GeoProspector

## Objectif

Livrer en une journée, à trois, une application web Django/GeoDjango + PostGIS + React sous Docker : carte des équipements BPE 2025 de Bretagne (région 53), filtres par domaine et par ville, et gestion d'implantations privées par des utilisateurs connectés.

## Résultat

| Livrable | État |
|---|---|
| Docker (`docker-compose.yaml`, Dockerfiles backend et frontend) | Fait : trois services `db`, `backend`, `frontend` |
| Modèle de données PostGIS et migrations | Fait |
| Import des données BPE | Fait : 134 810 lignes lues, 130 508 importées, 4 302 rejetées (sans coordonnées), aucun doublon après deux exécutions |
| API (équipements, domaines, villes, comptes JWT, implantations) | Faite, avec tests et Swagger sur `/api/docs/` |
| Frontend | Fait : React 19 + TypeScript, Leaflet avec regroupement des marqueurs, filtres, recherche d'adresse, gestion des implantations par glisser-déposer |
| Documentation | README (installation, import, utilisation), modèle de données, API |

## Organisation

Trois tickets menés en parallèle :

1. **Aristide** : Docker, squelette Django, modèles BPE, import, documentation d'installation
2. **Zeeshane** : API, comptes, implantations, tests, documentation de l'API
3. **Mohamed** : frontend

Une branche par tâche, fusion dans `main` par pull request. Un contrat d'API (routes, paramètres, format GeoJSON) a été écrit en début de journée pour que le frontend avance sans attendre le backend, avec des données factices au départ.

## Ce qui a bien marché

- **Squelette livré tôt** : l'environnement Docker fonctionnait chez tout le monde dès la fin de matinée.
- **Modèles fusionnés avant l'import** : l'API a pu démarrer sans attendre les données.
- **Contrat d'API** : backend et frontend ont travaillé en parallèle sur la même base.
- **Import vérifié** : chiffres cohérents avec l'annexe du sujet, rejets comptés et justifiés, import relançable.
- **API testée** : tests automatisés sur l'inscription, les tokens et l'isolement des implantations entre utilisateurs.

## Problèmes rencontrés

| Problème | Cause | Solution |
|---|---|---|
| Commandes Docker refusées | Docker Desktop pas lancé | Lancer Docker Desktop avant tout |
| Options `--name` non reconnues | Tirets longs (—) insérés au copier-coller | Taper les commandes, désactiver les tirets intelligents de macOS |
| `No module named 'config.views'` | Fichier nommé `view.py` | Renommage en `views.py` |
| Parquet de 128 Mo ajouté à un commit | Une commande `echo >> .gitignore` a fusionné deux lignes et supprimé la règle `data/` | Push interrompu, commit annulé (`git reset HEAD~1`), `.gitignore` corrigé |
| 4 302 équipements sans coordonnées | Données source incomplètes | Rejet à l'import, compté et affiché |
| Simple JWT et drf-spectacular sans support déclaré de Django 6.1, DRF-GIS testé jusqu'à Python 3.13 | Versions récentes pas encore couvertes par ces bibliothèques | Conservées et testées, sans problème constaté |
| Implantations servies sur `/api/` au lieu de `/api/implantations/` | Préfixe oublié dans `config/urls.py` ; les tests utilisent `reverse()` et ne le voyaient pas | Préfixe corrigé |
| Recherche d'adresse en panne | L'API Adresse utilisée au départ a été décommissionnée | Passage au service de géocodage de la Géoplateforme IGN |
| Affichage lent à l'échelle de toute la Bretagne | Environ 130 000 marqueurs dans la vue initiale | Chargement des marqueurs par lots et regroupement ; zoomer sur une ville reste plus rapide |
| Vue JWT de développement acceptant tout mot de passe | Raccourci utilisé pendant le développement du frontend | Supprimée avant la livraison |

## Ce qu'on ferait autrement

- **Fixer les versions** des dépendances dès le premier build.
- **Vérifier `git status`** avant chaque commit, surtout avec des fichiers volumineux dans le dossier.
- **Tester les routes avec leur URL réelle** en plus de `reverse()`, pour détecter un mauvais préfixe.
- **Écrire un test automatique de l'import** (sur un petit parquet d'exemple).
- **Attribuer chaque fichier partagé** (`settings.py`, `urls.py`, README) à une seule personne dès le départ.

## Pistes d'amélioration

- Proposer l'inscription dans l'interface (aujourd'hui elle passe par l'API).
- Agréger les équipements côté serveur aux faibles niveaux de zoom, pour accélérer la vue régionale.
- Importer les libellés des régions et départements depuis un référentiel INSEE plutôt que de les écrire dans le script.
- Préparer une configuration de production : Gunicorn, `DEBUG=0`, clé secrète générée, port de la base non exposé.
