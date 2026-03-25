from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from django.db.models import Count
from django_filters.rest_framework import DjangoFilterBackend

from .models import SectionFeedback, FeedbackReply, FeedbackAttachment
from .serializers import (
    SectionFeedbackListSerializer,
    SectionFeedbackDetailSerializer,
    SectionFeedbackCreateSerializer,
    SectionFeedbackStatusSerializer,
    FeedbackReplySerializer,
    FeedbackReplyCreateSerializer,
    FeedbackAttachmentSerializer,
)

MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024  # 10 MB


class IsAuthorOrStaff(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        return obj.author == request.user or request.user.is_staff


class SectionFeedbackViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['section', 'status']

    def get_queryset(self):
        qs = SectionFeedback.objects.select_related('author').prefetch_related('attachments')
        if self.action == 'list':
            qs = qs.annotate(
                _reply_count=Count('replies'),
                _attachment_count=Count('attachments'),
            )
        elif self.action == 'retrieve':
            qs = qs.prefetch_related(
                'replies__author',
                'replies__attachments',
            )
        return qs

    def get_serializer_class(self):
        if self.action == 'create':
            return SectionFeedbackCreateSerializer
        if self.action == 'retrieve':
            return SectionFeedbackDetailSerializer
        if self.action in ('partial_update', 'update'):
            return SectionFeedbackStatusSerializer
        return SectionFeedbackListSerializer

    def get_permissions(self):
        if self.action in ('update', 'partial_update'):
            return [permissions.IsAuthenticated(), permissions.IsAdminUser()]
        if self.action == 'destroy':
            return [permissions.IsAuthenticated(), IsAuthorOrStaff()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    @action(detail=True, methods=['post'], parser_classes=[MultiPartParser])
    def upload_attachment(self, request, pk=None):
        feedback = self.get_object()
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'Файл не передан'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file.size > MAX_ATTACHMENT_SIZE:
            return Response(
                {'error': 'Файл слишком большой (макс. 10 МБ)'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        attachment = FeedbackAttachment.objects.create(
            feedback=feedback,
            file=file,
            original_filename=file.name,
        )
        serializer = FeedbackAttachmentSerializer(
            attachment, context={'request': request}
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'post'], url_path='replies')
    def replies(self, request, pk=None):
        feedback = self.get_object()
        if request.method == 'GET':
            replies = feedback.replies.select_related('author').prefetch_related('attachments')
            serializer = FeedbackReplySerializer(
                replies, many=True, context={'request': request}
            )
            return Response(serializer.data)
        # POST
        serializer = FeedbackReplyCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reply = serializer.save(feedback=feedback, author=request.user)
        out = FeedbackReplySerializer(reply, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        qs = SectionFeedback.objects.values('section', 'status').annotate(
            count=Count('id')
        )
        result = {}
        for row in qs:
            section = row['section']
            if section not in result:
                result[section] = {
                    'section': section,
                    'total': 0,
                    'new': 0,
                    'in_progress': 0,
                    'resolved': 0,
                }
            result[section][row['status']] = row['count']
            result[section]['total'] += row['count']
        return Response(list(result.values()))


class FeedbackReplyAttachmentView(viewsets.GenericViewSet):
    """Загрузка вложений к ответам"""
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser]

    @action(detail=True, methods=['post'], url_path='upload-attachment')
    def upload_attachment(self, request, pk=None):
        try:
            reply = FeedbackReply.objects.get(pk=pk)
        except FeedbackReply.DoesNotExist:
            return Response(
                {'error': 'Ответ не найден'},
                status=status.HTTP_404_NOT_FOUND,
            )
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'error': 'Файл не передан'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if file.size > MAX_ATTACHMENT_SIZE:
            return Response(
                {'error': 'Файл слишком большой (макс. 10 МБ)'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        attachment = FeedbackAttachment.objects.create(
            reply=reply,
            file=file,
            original_filename=file.name,
        )
        serializer = FeedbackAttachmentSerializer(
            attachment, context={'request': request}
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)
