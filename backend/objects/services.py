"""
objects/services.py — бизнес-логика для строительных объектов.

Вынесена из views.py для тонких view-обёрток.
"""
from __future__ import annotations


class PhotoUploadError(Exception):
    """Ошибка валидации загружаемого фото."""


def upload_object_photo(obj, photo):
    """
    Валидация и сохранение фото объекта.

    Raises:
        PhotoUploadError — если файл не передан или не является изображением.
    """
    if not photo:
        raise PhotoUploadError('Фотография не предоставлена')

    if not photo.content_type.startswith('image/'):
        raise PhotoUploadError('Файл должен быть изображением')

    if obj.photo:
        obj.photo.delete(save=False)

    obj.photo = photo
    obj.save(update_fields=['photo'])
