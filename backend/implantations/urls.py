from django.urls import path

from .views import ImplantationDetailView, ImplantationListCreateView


app_name = 'implantations'

urlpatterns = [
    path('', ImplantationListCreateView.as_view(), name='list-create'),
    path('<int:pk>/', ImplantationDetailView.as_view(), name='detail'),
]
