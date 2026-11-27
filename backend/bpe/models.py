from django.db import models

# Create your models here.

import uuid

from django.contrib.gis.db import models


class Region(models.Model):
    id_region = models.CharField(primary_key=True, max_length=3)
    libelle = models.CharField(max_length=255)

    def __str__(self):
        return self.libelle


class Dept(models.Model):
    id_dept = models.CharField(primary_key=True, max_length=3)
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name="depts")
    libelle = models.CharField(max_length=255)

    def __str__(self):
        return self.libelle


class Domaine1(models.Model):
    code = models.CharField(primary_key=True, max_length=1)
    libelle = models.CharField(max_length=255)

    def __str__(self):
        return self.libelle


class Domaine2(models.Model):
    code = models.CharField(primary_key=True, max_length=2)
    domaine1 = models.ForeignKey(Domaine1, on_delete=models.PROTECT, related_name="enfants")
    libelle = models.CharField(max_length=255)

    def __str__(self):
        return self.libelle


class Domaine3(models.Model):
    code = models.CharField(primary_key=True, max_length=4)
    domaine2 = models.ForeignKey(Domaine2, on_delete=models.PROTECT, related_name="enfants")
    libelle = models.CharField(max_length=255)

    def __str__(self):
        return self.libelle


class Equipement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    domaine3 = models.ForeignKey(Domaine3, on_delete=models.PROTECT, related_name="equipements")
    nom = models.CharField(max_length=255)
    adresse = models.CharField(max_length=255, blank=True)
    codepostal = models.CharField(max_length=5, blank=True)
    ville = models.CharField(max_length=255, db_index=True)
    dept = models.ForeignKey(Dept, on_delete=models.PROTECT, related_name="equipements")
    siret = models.CharField(max_length=14, blank=True)
    geom = models.PointField(srid=4326, spatial_index=True)

    def __str__(self):
        return self.nom