from django.urls import include, path

from . import admin_views


urlpatterns = [
    path('public/', include('hvac_bridge.public_urls')),
    path(
        'admin/references/manufacturer/discover-manufacturers-news/',
        admin_views.discover_manufacturers_news,
        name='hvac-admin-discover-manufacturers-news',
    ),
    path(
        'admin/references/manufacturer/discover-manufacturers-status/',
        admin_views.discover_manufacturers_status,
        name='hvac-admin-discover-manufacturers-status',
    ),
    path(
        'admin/references/manufacturer/discover-manufacturers-info/',
        admin_views.discover_manufacturers_info,
        name='hvac-admin-discover-manufacturers-info',
    ),
    path(
        'admin/references/newsresource/discover-news/',
        admin_views.discover_news,
        name='hvac-admin-discover-news',
    ),
    path(
        'admin/references/newsresource/discover-news-status/',
        admin_views.discover_news_status,
        name='hvac-admin-discover-news-status',
    ),
    path(
        'admin/references/newsresource/discover-news-info/',
        admin_views.discover_news_info,
        name='hvac-admin-discover-news-info',
    ),
]
