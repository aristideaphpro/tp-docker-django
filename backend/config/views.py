from django.db import connection
from django.http import JsonResponse


def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT PostGIS_Version()")
            version = cursor.fetchone()[0]
    except Exception as exc:
        return JsonResponse({"status": "error", "detail": str(exc)}, status=503)
    return JsonResponse({"status": "ok", "postgis": version})