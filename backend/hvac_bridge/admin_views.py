from django.contrib import admin
from django.views.decorators.csrf import csrf_exempt

from references.admin import ManufacturerAdmin, NewsResourceAdmin
from references.models import Manufacturer, NewsResource


manufacturer_admin = ManufacturerAdmin(Manufacturer, admin.site)
news_resource_admin = NewsResourceAdmin(NewsResource, admin.site)


@csrf_exempt
def discover_manufacturers_news(request):
    return manufacturer_admin.discover_manufacturers_news(request)


@csrf_exempt
def discover_manufacturers_status(request):
    return manufacturer_admin.get_manufacturers_discovery_status(request)


@csrf_exempt
def discover_manufacturers_info(request):
    return manufacturer_admin.discover_manufacturers_info(request)


@csrf_exempt
def discover_news(request):
    return news_resource_admin.discover_news(request)


@csrf_exempt
def discover_news_status(request):
    return news_resource_admin.get_discovery_status(request)


@csrf_exempt
def discover_news_info(request):
    return news_resource_admin.discover_news_info(request)
