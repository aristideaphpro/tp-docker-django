from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer

from bpe.models import Domaine3

from .models import Implantation


class ImplantationSerializer(GeoFeatureModelSerializer):
    domaine3 = serializers.PrimaryKeyRelatedField(
        queryset=Domaine3.objects.all(),
        allow_null=True,
        required=True,
    )
    commentaire = serializers.CharField(allow_blank=True, required=True)

    class Meta:
        model = Implantation
        geo_field = 'geom'
        fields = (
            'id',
            'titre',
            'commentaire',
            'domaine3',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def to_internal_value(self, data):
        if isinstance(data, dict):
            data = data.copy()
            properties = data.get('properties', {})
            if properties is None:
                properties = {}
            if not isinstance(properties, dict):
                raise serializers.ValidationError({
                    'properties': 'Ce champ doit être un objet GeoJSON.'
                })

            properties = properties.copy()
            properties.pop('user', None)
            properties.pop('owner', None)
            data.pop('user', None)
            data.pop('owner', None)
            if (
                'geometry' in data
                or 'properties' in data
                or data.get('type') == 'Feature'
            ):
                data['properties'] = properties
        return super().to_internal_value(data)
