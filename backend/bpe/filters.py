import math

from django.contrib.gis.geos import Polygon
from rest_framework.exceptions import ValidationError


FILTER_LOOKUPS = {
    'domaine1': 'domaine3__domaine2__domaine1__code__in',
    'domaine2': 'domaine3__domaine2__code__in',
    'domaine3': 'domaine3__code__in',
    'ville': 'ville__in',
}


def bbox_polygon(query_params):
    values = query_params.getlist('in_bbox')
    if len(values) != 1 or not values[0].strip():
        raise ValidationError({
            'in_bbox': 'Paramètre obligatoire au format ouest,sud,est,nord.'
        })

    parts = values[0].split(',')
    if len(parts) != 4:
        raise ValidationError({
            'in_bbox': 'Utilisez quatre nombres : ouest,sud,est,nord.'
        })

    try:
        west, south, east, north = (float(part.strip()) for part in parts)
    except ValueError as exc:
        raise ValidationError({
            'in_bbox': 'Les coordonnées de la bbox doivent être numériques.'
        }) from exc

    if not all(math.isfinite(value) for value in (west, south, east, north)):
        raise ValidationError({'in_bbox': 'Les coordonnées doivent être finies.'})
    if not (-180 <= west < east <= 180):
        raise ValidationError({
            'in_bbox': 'Les longitudes doivent respecter -180 <= ouest < est <= 180.'
        })
    if not (-90 <= south < north <= 90):
        raise ValidationError({
            'in_bbox': 'Les latitudes doivent respecter -90 <= sud < nord <= 90.'
        })

    return Polygon.from_bbox((west, south, east, north))


def apply_equipement_filters(queryset, query_params):
    for parameter, lookup in FILTER_LOOKUPS.items():
        values = [
            value.strip()
            for value in query_params.getlist(parameter)
            if value.strip()
        ]
        if values:
            queryset = queryset.filter(**{lookup: values})
    return queryset
