from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from .models import Domaine1, Domaine2, Domaine3, Equipement


class EquipementListSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Equipement
        geo_field = 'geom'
        fields = ('id', 'nom', 'domaine3')


class EquipementDetailSerializer(GeoFeatureModelSerializer):
    class Meta:
        model = Equipement
        geo_field = 'geom'
        fields = (
            'id',
            'nom',
            'domaine3',
            'adresse',
            'codepostal',
            'ville',
            'dept',
            'siret',
        )


class Domaine3Serializer(serializers.ModelSerializer):
    class Meta:
        model = Domaine3
        fields = ('code', 'libelle')


class Domaine2Serializer(serializers.ModelSerializer):
    enfants = Domaine3Serializer(many=True, read_only=True)

    class Meta:
        model = Domaine2
        fields = ('code', 'libelle', 'enfants')


class Domaine1Serializer(serializers.ModelSerializer):
    enfants = Domaine2Serializer(many=True, read_only=True)

    class Meta:
        model = Domaine1
        fields = ('code', 'libelle', 'enfants')
