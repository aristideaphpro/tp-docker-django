from django.urls import path

from .views import (
    DomainesView,
    EquipementDetailView,
    EquipementListView,
    VillesView,
)


app_name = 'bpe'

urlpatterns = [
    path('equipements/', EquipementListView.as_view(), name='equipement-list'),
    path(
        'equipements/<uuid:id>/',
        EquipementDetailView.as_view(),
        name='equipement-detail',
    ),
    path('domaines/', DomainesView.as_view(), name='domaines'),
    path('villes/', VillesView.as_view(), name='villes'),
]
