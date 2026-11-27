from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from .models import Implantation
from .permissions import IsImplantationOwner
from .serializers import ImplantationSerializer


class ImplantationListCreateView(generics.ListCreateAPIView):
    serializer_class = ImplantationSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Implantation.objects.none()
        return (
            Implantation.objects.filter(user=self.request.user)
            .select_related('domaine3')
            .order_by('id')
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class ImplantationDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ImplantationSerializer
    permission_classes = (IsAuthenticated, IsImplantationOwner)
    lookup_field = 'pk'

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Implantation.objects.none()
        return (
            Implantation.objects.filter(user=self.request.user)
            .select_related('domaine3')
        )
