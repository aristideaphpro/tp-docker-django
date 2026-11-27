from django.contrib.auth import get_user_model
from django.contrib.gis.geos import Point
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from bpe.models import Domaine1, Domaine2, Domaine3
from .models import Implantation


User = get_user_model()


class ImplantationApiTests(APITestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username='alice', password='secret-a')
        self.user_b = User.objects.create_user(username='bob', password='secret-b')
        domaine1 = Domaine1.objects.create(code='B', libelle='Commerce')
        domaine2 = Domaine2.objects.create(
            code='B2',
            domaine1=domaine1,
            libelle='Commerce de détail',
        )
        self.domaine3 = Domaine3.objects.create(
            code='B203',
            domaine2=domaine2,
            libelle='Équipement de démonstration',
        )

    def creer_implantation(self, user, titre='Agence de Rennes'):
        return Implantation.objects.create(
            user=user,
            geom=Point(-1.6778, 48.1173, srid=4326),
            domaine3=self.domaine3,
            titre=titre,
            commentaire='Site ouvert en semaine.',
        )

    def test_requete_anonyme_renvoie_401(self):
        response = self.client.get(reverse('implantations:list-create'))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_un_utilisateur_ne_voit_que_ses_points(self):
        point_a = self.creer_implantation(self.user_a, 'Point A')
        self.creer_implantation(self.user_b, 'Point B')
        self.client.force_authenticate(user=self.user_a)

        response = self.client.get(reverse('implantations:list-create'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['type'], 'FeatureCollection')
        self.assertEqual(len(response.data['features']), 1)
        self.assertEqual(response.data['features'][0]['id'], point_a.id)
        self.assertEqual(response.data['features'][0]['properties']['titre'], 'Point A')

    def test_b_ne_peut_pas_lire_le_point_de_a(self):
        point_a = self.creer_implantation(self.user_a)
        self.client.force_authenticate(user=self.user_b)

        response = self.client.get(
            reverse('implantations:detail', kwargs={'pk': point_a.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_b_ne_peut_pas_modifier_le_point_de_a(self):
        point_a = self.creer_implantation(self.user_a)
        self.client.force_authenticate(user=self.user_b)

        response = self.client.patch(
            reverse('implantations:detail', kwargs={'pk': point_a.pk}),
            {
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [-2.0, 47.0]},
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        point_a.refresh_from_db()
        self.assertEqual(point_a.geom, Point(-1.6778, 48.1173, srid=4326))

    def test_b_ne_peut_pas_supprimer_le_point_de_a(self):
        point_a = self.creer_implantation(self.user_a)
        self.client.force_authenticate(user=self.user_b)

        response = self.client.delete(
            reverse('implantations:detail', kwargs={'pk': point_a.pk})
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Implantation.objects.filter(pk=point_a.pk).exists())

    def test_patch_geometry_seule_preserve_les_proprietes(self):
        point_a = self.creer_implantation(self.user_a)
        self.client.force_authenticate(user=self.user_a)

        response = self.client.patch(
            reverse('implantations:detail', kwargs={'pk': point_a.pk}),
            {
                'geometry': {'type': 'Point', 'coordinates': [-1.5, 48.2]},
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        point_a.refresh_from_db()
        self.assertAlmostEqual(point_a.geom.x, -1.5)
        self.assertAlmostEqual(point_a.geom.y, 48.2)
        self.assertEqual(point_a.titre, 'Agence de Rennes')
        self.assertEqual(point_a.commentaire, 'Site ouvert en semaine.')
        self.assertEqual(point_a.domaine3_id, 'B203')
        self.assertEqual(response.data['properties']['titre'], point_a.titre)
        self.assertEqual(response.data['properties']['commentaire'], point_a.commentaire)
        self.assertEqual(response.data['properties']['domaine3'], 'B203')

    def test_creation_attribue_le_point_a_lutilisateur_connecte(self):
        self.client.force_authenticate(user=self.user_a)

        response = self.client.post(
            reverse('implantations:list-create'),
            {
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [-1.5, 48.2]},
                'properties': {
                    'titre': 'Nouvelle agence',
                    'commentaire': 'Nouveau site.',
                    'domaine3': 'B203',
                    'user': self.user_b.pk,
                    'owner': self.user_b.pk,
                },
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        point = Implantation.objects.get(pk=response.data['id'])
        self.assertEqual(point.user_id, self.user_a.pk)
        self.assertNotIn('user', response.data['properties'])

    def test_creation_rejette_des_properties_non_objet(self):
        self.client.force_authenticate(user=self.user_a)

        response = self.client.post(
            reverse('implantations:list-create'),
            {
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [-1.5, 48.2]},
                'properties': ['valeur invalide'],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('properties', response.data)
