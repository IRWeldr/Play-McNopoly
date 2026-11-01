from django.urls import path
from . import views

urlpatterns = [
    path('', views.mcnopoly_home, name='mcnopoly_home'),
    path('mobile/', views.mcnopoly_mobile, name='mcnopoly_mobile'),
    path('api/upload/', views.upload_piece_photo, name='upload_piece_photo'),
    path('api/pieces/<int:piece_id>/update/', views.update_piece, name='update_piece'),
    path('api/adb/status/', views.adb_status, name='adb_status'),
    path('api/adb/redeem/', views.adb_redeem, name='adb_redeem'),
    path('api/adb/estop/', views.adb_estop, name='adb_estop'),
]

