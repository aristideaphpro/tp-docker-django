from django.conf import settings
from django.contrib.gis.db import models


class Implantation(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='implantations',
    )
    geom = models.PointField(srid=4326, spatial_index=True)
    domaine3 = models.ForeignKey(
        'bpe.Domaine3',
        on_delete=models.SET_NULL,
        related_name='implantations',
        null=True,
        blank=True,
    )
    titre = models.CharField(max_length=255)
    commentaire = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.titre
