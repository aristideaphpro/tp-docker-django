import math
import uuid
from collections import Counter

import pyarrow.parquet as pq
from django.contrib.gis.geos import Point
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from bpe.models import Dept, Domaine1, Domaine2, Domaine3, Equipement, Region

# Le parquet ne contient que les codes : on ajoute les libellés
REGIONS = {
    "24": "Centre-Val de Loire",
    "27": "Bourgogne-Franche-Comté",
    "28": "Normandie",
    "52": "Pays de la Loire",
    "53": "Bretagne",
}
DEPTS = {
    "22": "Côtes-d'Armor",
    "29": "Finistère",
    "35": "Ille-et-Vilaine",
    "56": "Morbihan",
}

COLONNES = [
    "_id", "nom", "adresse", "codepostal", "ville", "dept", "region",
    "domaine1_code", "domaine1_libelle", "domaine2_code", "domaine2_libelle",
    "domaine3_code", "domaine3_libelle", "SIRET", "lon", "lat",
]


def texte(valeur):
    """Transforme une valeur vide (None ou NaN) en chaîne vide."""
    if valeur is None or (isinstance(valeur, float) and math.isnan(valeur)):
        return ""
    return str(valeur).strip()


def nombre(valeur):
    if valeur is None or (isinstance(valeur, float) and math.isnan(valeur)):
        return None
    return float(valeur)


class Command(BaseCommand):
    help = "Importe les équipements BPE d'une région depuis un fichier parquet."

    def add_arguments(self, parser):
        parser.add_argument("fichier")
        parser.add_argument("--region", required=True)
        parser.add_argument("--batch-size", type=int, default=5000)

    def handle(self, *args, **options):
        region = options["region"]
        taille_lot = options["batch_size"]

        # 1. Extraction : lecture du parquet filtré sur la région
        try:
            table = pq.read_table(
                options["fichier"], columns=COLONNES, filters=[("region", "=", region)]
            )
        except FileNotFoundError:
            raise CommandError(f"Fichier introuvable : {options['fichier']}")

        lignes = table.to_pylist()
        self.stdout.write(f"Lignes lues pour la région {region} : {len(lignes)}")
        if not lignes:
            raise CommandError("Aucune ligne pour cette région.")

        # 2. Transformation : validation et nettoyage ligne par ligne
        rejets = Counter()
        noms_remplaces = 0
        ids_vus = set()
        depts, dom1, dom2, dom3 = {}, {}, {}, {}
        equipements = []

        for ligne in lignes:
            try:
                id_equipement = uuid.UUID(texte(ligne["_id"]))
            except ValueError:
                rejets["_id manquant ou invalide"] += 1
                continue
            if id_equipement in ids_vus:
                rejets["_id en double dans le fichier"] += 1
                continue

            lon, lat = nombre(ligne["lon"]), nombre(ligne["lat"])
            if lon is None or lat is None:
                rejets["coordonnées manquantes"] += 1
                continue
            if not (-180 <= lon <= 180 and -90 <= lat <= 90):
                rejets["coordonnées hors limites"] += 1
                continue

            code1 = texte(ligne["domaine1_code"])
            code2 = texte(ligne["domaine2_code"])
            code3 = texte(ligne["domaine3_code"])
            if not (code1 and code2 and code3):
                rejets["domaine manquant"] += 1
                continue

            code_dept = texte(ligne["dept"])
            if not code_dept:
                rejets["département manquant"] += 1
                continue

            nom = texte(ligne["nom"])
            if not nom:
                nom = texte(ligne["domaine3_libelle"]) or code3
                noms_remplaces += 1

            siret = texte(ligne["SIRET"])
            if not (siret.isdigit() and len(siret) == 14):
                siret = ""

            codepostal = texte(ligne["codepostal"])
            if len(codepostal) > 5:
                codepostal = ""

            ids_vus.add(id_equipement)
            depts[code_dept] = DEPTS.get(code_dept, code_dept)
            dom1[code1] = texte(ligne["domaine1_libelle"])
            dom2[code2] = (code1, texte(ligne["domaine2_libelle"]))
            dom3[code3] = (code2, texte(ligne["domaine3_libelle"]))

            equipements.append(
                Equipement(
                    id=id_equipement,
                    domaine3_id=code3,
                    nom=nom[:255],
                    adresse=texte(ligne["adresse"])[:255],
                    codepostal=codepostal,
                    ville=texte(ligne["ville"])[:255],
                    dept_id=code_dept,
                    siret=siret,
                    geom=Point(lon, lat, srid=4326),
                )
            )

        # 3. Chargement : tables de référence d'abord (ordre des clés étrangères)
        # update_conflicts = si la ligne existe déjà, on la met à jour (pas de doublon)
        with transaction.atomic():
            Region.objects.bulk_create(
                [Region(id_region=region, libelle=REGIONS.get(region, region))],
                update_conflicts=True, unique_fields=["id_region"], update_fields=["libelle"],
            )
            Dept.objects.bulk_create(
                [Dept(id_dept=c, region_id=region, libelle=l) for c, l in depts.items()],
                update_conflicts=True, unique_fields=["id_dept"], update_fields=["region", "libelle"],
            )
            Domaine1.objects.bulk_create(
                [Domaine1(code=c, libelle=l) for c, l in dom1.items()],
                update_conflicts=True, unique_fields=["code"], update_fields=["libelle"],
            )
            Domaine2.objects.bulk_create(
                [Domaine2(code=c, domaine1_id=p, libelle=l) for c, (p, l) in dom2.items()],
                update_conflicts=True, unique_fields=["code"], update_fields=["domaine1", "libelle"],
            )
            Domaine3.objects.bulk_create(
                [Domaine3(code=c, domaine2_id=p, libelle=l) for c, (p, l) in dom3.items()],
                update_conflicts=True, unique_fields=["code"], update_fields=["domaine2", "libelle"],
            )

        # Puis les équipements, par lots
        champs = ["domaine3", "nom", "adresse", "codepostal", "ville", "dept", "siret", "geom"]
        for debut in range(0, len(equipements), taille_lot):
            lot = equipements[debut:debut + taille_lot]
            with transaction.atomic():
                Equipement.objects.bulk_create(
                    lot, update_conflicts=True, unique_fields=["id"], update_fields=champs
                )
            self.stdout.write(f"  {debut + len(lot)} / {len(equipements)}")

        # Bilan
        self.stdout.write(self.style.SUCCESS(f"Équipements importés : {len(equipements)}"))
        self.stdout.write(f"Noms vides remplacés par le libellé du domaine : {noms_remplaces}")
        self.stdout.write(f"Rejets : {sum(rejets.values())}")
        for motif, nb in rejets.most_common():
            self.stdout.write(f"  - {motif} : {nb}")
        total = Equipement.objects.filter(dept__region_id=region).count()
        self.stdout.write(f"Total en base pour la région {region} : {total}")