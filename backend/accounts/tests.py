from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class RegistrationTests(APITestCase):
    def test_register_creates_user_with_hashed_password(self):
        password = 'GeoBretagne!2026-Securite'
        response = self.client.post(
            reverse('accounts:register'),
            {'username': 'lea', 'password': password},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn('password', response.data)
        user = User.objects.get(username='lea')
        self.assertTrue(check_password(password, user.password))

    def test_register_rejects_password_that_fails_django_validators(self):
        response = self.client.post(
            reverse('accounts:register'),
            {'username': 'lea', 'password': '12345678'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password', response.data)
        self.assertFalse(User.objects.filter(username='lea').exists())


class JwtTokenTests(APITestCase):
    def setUp(self):
        self.password = 'GeoBretagne!2026-Securite'
        User.objects.create_user(username='lea', password=self.password)

    def test_token_pair_and_refresh_endpoints(self):
        token_response = self.client.post(
            reverse('accounts:token_obtain_pair'),
            {'username': 'lea', 'password': self.password},
            format='json',
        )

        self.assertEqual(token_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', token_response.data)
        self.assertIn('refresh', token_response.data)

        refresh_response = self.client.post(
            reverse('accounts:token_refresh'),
            {'refresh': token_response.data['refresh']},
            format='json',
        )

        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_response.data)
