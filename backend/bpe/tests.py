from django.contrib.gis.geos import Point
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Dept, Domaine1, Domaine2, Domaine3, Equipement, Region


class BpeApiTests(APITestCase):
    def setUp(self):
        self.region = Region.objects.create(id_region='53', libelle='Bretagne')
        self.departement = Dept.objects.create(
            id_dept='35',
            region=self.region,
            libelle='Ille-et-Vilaine',
        )
        self.domaine1 = Domaine1.objects.create(code='B', libelle='Commerce')
        self.domaine2 = Domaine2.objects.create(
            code='B2',
            domaine1=self.domaine1,
            libelle='Commerce de détail',
        )
        self.domaine3 = Domaine3.objects.create(
            code='B203',
            domaine2=self.domaine2,
            libelle='Équipement de démonstration',
        )

    def creer_equipement(self, nom, ville, longitude, latitude):
        return Equipement.objects.create(
            domaine3=self.domaine3,
            nom=nom,
            adresse='1 rue de Bretagne',
            codepostal='35000',
            ville=ville,
            dept=self.departement,
            siret='12345678901234',
            geom=Point(longitude, latitude, srid=4326),
        )

    def test_bbox_absente_renvoie_400(self):
        response = self.client.get(reverse('bpe:equipement-list'))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('in_bbox', response.data)

    def test_bbox_invalide_renvoie_400(self):
        response = self.client.get(
            reverse('bpe:equipement-list'),
            {'in_bbox': '-1.5,48.2,-1.8,48.0'},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('in_bbox', response.data)

    def test_liste_exclut_les_points_hors_bbox(self):
        dedans = self.creer_equipement('Point de Rennes', 'Rennes', -1.68, 48.11)
        self.creer_equipement('Point de Brest', 'Brest', -4.49, 48.39)

        response = self.client.get(
            reverse('bpe:equipement-list'),
            {'in_bbox': '-1.8,48.0,-1.5,48.2'},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['type'], 'FeatureCollection')
        self.assertEqual(len(response.data['features']), 1)
        self.assertEqual(str(response.data['features'][0]['id']), str(dedans.id))
        self.assertEqual(
            set(response.data['features'][0]['properties']),
            {'nom', 'domaine3'},
        )

    def test_villes_repetees_sont_combinees_avec_ou(self):
        self.creer_equipement('Équipement Rennes', 'Rennes', -1.68, 48.11)
        self.creer_equipement('Équipement Brest', 'Brest', -4.49, 48.39)
        self.creer_equipement('Équipement Nantes', 'Nantes', -1.55, 47.22)
        url = (
            f"{reverse('bpe:equipement-list')}?"
            'in_bbox=-5.5,47.0,0.0,49.0&ville=Rennes&ville=Brest'
        )

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        noms = {feature['properties']['nom'] for feature in response.data['features']}
        self.assertEqual(noms, {'Équipement Rennes', 'Équipement Brest'})

    def test_detail_par_uuid_ne_demande_pas_de_bbox(self):
        equipement = self.creer_equipement(
            'Équipement Rennes',
            'Rennes',
            -1.68,
            48.11,
        )

        response = self.client.get(
            reverse('bpe:equipement-detail', kwargs={'id': equipement.id})
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['type'], 'Feature')
        self.assertEqual(str(response.data['id']), str(equipement.id))
        self.assertEqual(
            set(response.data['properties']),
            {'nom', 'domaine3', 'adresse', 'codepostal', 'ville', 'dept', 'siret'},
        )

    def test_domaines_sont_renvoyes_en_arbre(self):
        response = self.client.get(reverse('bpe:domaines'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data,
            [
                {
                    'code': 'B',
                    'libelle': 'Commerce',
                    'enfants': [
                        {
                            'code': 'B2',
                            'libelle': 'Commerce de détail',
                            'enfants': [
                                {
                                    'code': 'B203',
                                    'libelle': 'Équipement de démonstration',
                                }
                            ],
                        }
                    ],
                }
            ],
        )

    def test_villes_distinctes(self):
        self.creer_equipement('Équipement Rennes 1', 'Rennes', -1.68, 48.11)
        self.creer_equipement('Équipement Rennes 2', 'Rennes', -1.67, 48.12)
        self.creer_equipement('Équipement Brest', 'Brest', -4.49, 48.39)

        response = self.client.get(reverse('bpe:villes'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, ['Brest', 'Rennes'])
