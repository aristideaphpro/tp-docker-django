from django.db.models import Prefetch
from drf_spectacular.utils import OpenApiParameter, OpenApiTypes, extend_schema
from rest_framework import generics
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import apply_equipement_filters, bbox_polygon
from .models import Domaine1, Domaine2, Domaine3, Equipement
from .serializers import (
    Domaine1Serializer,
    EquipementDetailSerializer,
    EquipementListSerializer,
)


@extend_schema(
    parameters=[
        OpenApiParameter(
            name='in_bbox',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            required=True,
            description='Emprise ouest,sud,est,nord en longitude/latitude.',
        ),
        OpenApiParameter(
            name='domaine1',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            many=True,
            description='Code domaine de niveau 1; répéter le paramètre pour un OU.',
        ),
        OpenApiParameter(
            name='domaine2',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            many=True,
            description='Code domaine de niveau 2; répéter le paramètre pour un OU.',
        ),
        OpenApiParameter(
            name='domaine3',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            many=True,
            description='Code domaine de niveau 3; répéter le paramètre pour un OU.',
        ),
        OpenApiParameter(
            name='ville',
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            many=True,
            description='Ville; répéter le paramètre pour un OU.',
        ),
    ],
    responses=EquipementListSerializer(many=True),
)
class EquipementListView(generics.ListAPIView):
    serializer_class = EquipementListSerializer
    permission_classes = (AllowAny,)

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Equipement.objects.none()
        area = bbox_polygon(self.request.query_params)
        queryset = Equipement.objects.select_related(
            'domaine3__domaine2__domaine1',
            'dept',
        ).filter(geom__intersects=area)
        queryset = apply_equipement_filters(queryset, self.request.query_params)
        return queryset.order_by('id')


@extend_schema(responses=EquipementDetailSerializer)
class EquipementDetailView(generics.RetrieveAPIView):
    queryset = Equipement.objects.select_related(
        'domaine3__domaine2__domaine1',
        'dept',
    )
    serializer_class = EquipementDetailSerializer
    permission_classes = (AllowAny,)
    lookup_field = 'id'


@extend_schema(responses=Domaine1Serializer(many=True))
class DomainesView(generics.ListAPIView):
    serializer_class = Domaine1Serializer
    permission_classes = (AllowAny,)

    def get_queryset(self):
        domaines2 = Domaine2.objects.order_by('code').prefetch_related(
            Prefetch(
                'enfants',
                queryset=Domaine3.objects.order_by('code'),
            )
        )
        return Domaine1.objects.order_by('code').prefetch_related(
            Prefetch('enfants', queryset=domaines2)
        )


class VillesView(APIView):
    permission_classes = (AllowAny,)

    @extend_schema(
        responses={200: {'type': 'array', 'items': {'type': 'string'}}}
    )
    def get(self, request):
        villes = (
            Equipement.objects.exclude(ville='')
            .order_by('ville')
            .values_list('ville', flat=True)
            .distinct()
        )
        return Response(list(villes))
